from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import ReservationEventType, ReservationStatus
from app.models.reservation import Reservation
from app.models.reservation_event import ReservationEvent
from app.services import inventory_service
from app.services.time_utils import category_for_party_size, end_time_for
from app.ws.manager import broadcast_slot_update


class BookingConflictError(Exception):
    """Raised when the requested slot has no remaining capacity."""


class DelayConflictError(Exception):
    """Raised when a delay cannot find capacity in the new window; needs admin reassignment."""


async def _log_event(session: AsyncSession, reservation_id: UUID, event_type: str, payload: dict) -> None:
    session.add(ReservationEvent(reservation_id=reservation_id, event_type=event_type, payload=payload))


def _schedule_reminders(reservation_id: UUID, start_time: datetime) -> None:
    from app.workers.celery_app import celery_app

    for kind, before in (("24h", timedelta(hours=24)), ("2h", timedelta(hours=2))):
        eta = start_time - before
        if eta > datetime.now(start_time.tzinfo):
            celery_app.send_task(
                "app.workers.tasks.send_reminder", args=[str(reservation_id), kind], eta=eta
            )


async def _broadcast_range(session: AsyncSession, start_time: datetime, end_time: datetime) -> None:
    day = start_time.date()
    slots = await inventory_service.get_slots(session, day, settings.restaurant_timezone)
    for slot in slots:
        if start_time <= slot["time"] < end_time:
            await broadcast_slot_update(day, slot)


async def create_reservation(
    session: AsyncSession,
    guest_name: str,
    guest_email: str,
    guest_phone: str,
    party_size: int,
    start_time: datetime,
    idempotency_key: str,
) -> Reservation:
    existing = await session.scalar(
        select(Reservation).where(Reservation.idempotency_key == idempotency_key)
    )
    if existing is not None:
        return existing

    category = category_for_party_size(party_size)
    end_time = end_time_for(start_time)

    ok = await inventory_service.decrement_range(
        session, category, start_time, end_time, settings.max_arrivals_per_bucket
    )
    if not ok:
        await session.rollback()
        raise BookingConflictError("No capacity for the requested slot")

    reservation = Reservation(
        guest_name=guest_name,
        guest_email=guest_email,
        guest_phone=guest_phone,
        party_size=party_size,
        table_category=category,
        start_time=start_time,
        end_time=end_time,
        status=ReservationStatus.BOOKED,
        idempotency_key=idempotency_key,
    )
    session.add(reservation)
    await session.flush()
    await _log_event(
        session,
        reservation.id,
        ReservationEventType.CREATED.value,
        {"party_size": party_size, "start_time": start_time.isoformat()},
    )

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(
            select(Reservation).where(Reservation.idempotency_key == idempotency_key)
        )
        if existing is not None:
            return existing
        raise

    await _broadcast_range(session, start_time, end_time)
    _schedule_reminders(reservation.id, start_time)
    return reservation


async def cancel_reservation(session: AsyncSession, reservation: Reservation, reason: str = "") -> Reservation:
    if reservation.status in (ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.COMPLETED):
        return reservation

    await inventory_service.increment_range(
        session, reservation.table_category, reservation.start_time, reservation.end_time
    )
    reservation.status = ReservationStatus.CANCELLED
    await _log_event(
        session, reservation.id, ReservationEventType.STATUS_CHANGED.value, {"status": "cancelled", "reason": reason}
    )
    await session.commit()
    await _broadcast_range(session, reservation.start_time, reservation.end_time)
    return reservation


async def mark_no_show(session: AsyncSession, reservation: Reservation) -> Reservation:
    if reservation.status != ReservationStatus.BOOKED:
        return reservation

    await inventory_service.increment_range(
        session, reservation.table_category, reservation.start_time, reservation.end_time
    )
    reservation.status = ReservationStatus.NO_SHOW
    await _log_event(session, reservation.id, ReservationEventType.STATUS_CHANGED.value, {"status": "no_show"})
    await session.commit()
    await _broadcast_range(session, reservation.start_time, reservation.end_time)
    return reservation


async def seat_reservation(session: AsyncSession, reservation: Reservation, table_id: int) -> Reservation:
    reservation.status = ReservationStatus.SEATED
    reservation.assigned_table_id = table_id
    await _log_event(
        session, reservation.id, ReservationEventType.STATUS_CHANGED.value, {"status": "seated", "table_id": table_id}
    )
    await session.commit()
    return reservation


async def complete_early(session: AsyncSession, reservation: Reservation, completed_at: datetime) -> Reservation:
    """Free the remaining tail buckets when a party leaves before their booked end_time."""
    if reservation.status != ReservationStatus.SEATED:
        return reservation

    if completed_at < reservation.end_time:
        await inventory_service.increment_range(
            session, reservation.table_category, completed_at, reservation.end_time
        )
    reservation.status = ReservationStatus.COMPLETED
    await _log_event(
        session,
        reservation.id,
        ReservationEventType.STATUS_CHANGED.value,
        {"status": "completed", "completed_at": completed_at.isoformat()},
    )
    await session.commit()
    await _broadcast_range(session, completed_at, reservation.end_time)
    return reservation


async def delay_reservation(session: AsyncSession, reservation: Reservation, minutes: int) -> Reservation:
    """Shift a reservation forward. Both range adjustments happen in one transaction:
    if the new window lacks capacity, the whole delay is rejected and nothing changes.
    """
    if reservation.status != ReservationStatus.BOOKED:
        raise DelayConflictError("Only booked reservations can be delayed")

    old_start, old_end = reservation.start_time, reservation.end_time
    new_start = old_start + timedelta(minutes=minutes)
    new_end = end_time_for(new_start)

    await inventory_service.increment_range(session, reservation.table_category, old_start, old_end)

    ok = await inventory_service.decrement_range(
        session, reservation.table_category, new_start, new_end, settings.max_arrivals_per_bucket
    )
    if not ok:
        await session.rollback()
        raise DelayConflictError("New slot has no capacity; reassign the table instead")

    reservation.start_time = new_start
    reservation.end_time = new_end
    await _log_event(
        session,
        reservation.id,
        ReservationEventType.DELAYED.value,
        {"minutes": minutes, "old_start": old_start.isoformat(), "new_start": new_start.isoformat()},
    )
    await session.commit()
    await _broadcast_range(session, old_start, max(old_end, new_end))
    return reservation

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.dining_table import DiningTable
from app.models.enums import ReservationEventType, ReservationStatus, TableCategory
from app.models.reservation import Reservation
from app.models.reservation_event import ReservationEvent
from app.services import availability_service
from app.services.time_utils import category_for_party_size, end_time_for
from app.ws.manager import broadcast_slot_update

_ACTIVE_STATUSES = (ReservationStatus.BOOKED, ReservationStatus.SEATED)


class BookingConflictError(Exception):
    """Raised when no table of the required category is free for the requested window."""


class BookingWindowError(Exception):
    """Raised when the requested day is outside the allowed booking window."""


class UserConflictError(Exception):
    """Raised when the user already has a conflicting active reservation."""


class DelayConflictError(Exception):
    """Raised when a delay would overlap another active reservation on the same table."""


class RevertError(Exception):
    """Raised when a status change can't be undone, or its table has since been taken."""


_REVERT_TARGET = {
    ReservationStatus.SEATED: ReservationStatus.BOOKED,
    ReservationStatus.COMPLETED: ReservationStatus.SEATED,
    ReservationStatus.CANCELLED: ReservationStatus.BOOKED,
    ReservationStatus.NO_SHOW: ReservationStatus.BOOKED,
}


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


async def _broadcast_range(
    session: AsyncSession, restaurant_id: int, start_time: datetime, end_time: datetime
) -> None:
    """Push the affected slots to every watcher. Both party-size views are broadcast, not just
    the booked table's own: each payload carries the whole dining room, so a client picking
    2-seaters still needs to see a 4-seater go dark on its floor plan.
    """
    day = start_time.date()
    for slot_category in TableCategory:
        slots = await availability_service.get_slots_for_category(session, restaurant_id, slot_category, day)
        for slot in slots:
            if start_time <= slot["time"] < end_time:
                await broadcast_slot_update(restaurant_id, day, slot_category, slot)


def _check_booking_window(day: date, tzinfo) -> None:
    today = datetime.now(tzinfo).date()
    if not (today <= day <= today + timedelta(days=settings.booking_max_days_ahead)):
        raise BookingWindowError(
            f"Reservations can only be made between today and {settings.booking_max_days_ahead} days ahead"
        )


async def _check_user_conflicts(
    session: AsyncSession, user_id: int, restaurant_id: int, start_time: datetime, end_time: datetime
) -> None:
    day = start_time.date()
    day_start = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    conflict = await session.scalar(
        select(Reservation.id)
        .where(
            Reservation.user_id == user_id,
            Reservation.status.in_(_ACTIVE_STATUSES),
            Reservation.start_time >= day_start,
            Reservation.start_time < day_end,
        )
        .where(
            or_(
                Reservation.restaurant_id == restaurant_id,
                (Reservation.start_time < end_time) & (Reservation.end_time > start_time),
            )
        )
    )
    if conflict is not None:
        raise UserConflictError(
            "You already have an active reservation at this restaurant today, or an overlapping "
            "reservation at another restaurant - cancel it first"
        )


async def create_reservation(
    session: AsyncSession,
    user_id: int,
    restaurant_id: int,
    guest_name: str,
    guest_email: str,
    guest_phone: str,
    party_size: int,
    start_time: datetime,
    idempotency_key: str,
    table_id: int | None = None,
) -> Reservation:
    existing = await session.scalar(
        select(Reservation).where(Reservation.idempotency_key == idempotency_key)
    )
    if existing is not None:
        return existing

    _check_booking_window(start_time.date(), start_time.tzinfo)

    category = category_for_party_size(party_size)
    end_time = end_time_for(start_time)

    await _check_user_conflicts(session, user_id, restaurant_id, start_time, end_time)

    # Lock candidate tables one row at a time (SKIP LOCKED) so concurrent bookings for the
    # same restaurant/category/window serialize on table rows instead of racing a read-then-write.
    overlap_exists = exists(
        select(Reservation.id).where(
            Reservation.assigned_table_id == DiningTable.id,
            Reservation.status.in_(_ACTIVE_STATUSES),
            Reservation.start_time < end_time,
            Reservation.end_time > start_time,
        )
    )
    table = await session.scalar(
        select(DiningTable)
        .where(
            DiningTable.restaurant_id == restaurant_id,
            DiningTable.category == category,
            DiningTable.is_active.is_(True),
            *( [DiningTable.id == table_id] if table_id is not None else [] ),
            ~overlap_exists,
        )
        .order_by(DiningTable.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if table is None:
        await session.rollback()
        raise BookingConflictError("Selected table is unavailable for this time and party size")

    reservation = Reservation(
        restaurant_id=restaurant_id,
        user_id=user_id,
        guest_name=guest_name,
        guest_email=guest_email,
        guest_phone=guest_phone,
        party_size=party_size,
        table_category=category,
        start_time=start_time,
        end_time=end_time,
        status=ReservationStatus.BOOKED,
        assigned_table_id=table.id,
        idempotency_key=idempotency_key,
    )
    session.add(reservation)
    await session.flush()
    await _log_event(
        session,
        reservation.id,
        ReservationEventType.CREATED.value,
        {"party_size": party_size, "start_time": start_time.isoformat(), "assigned_table_id": table.id},
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

    await _broadcast_range(session, restaurant_id, start_time, end_time)
    _schedule_reminders(reservation.id, start_time)
    return reservation


async def cancel_reservation(session: AsyncSession, reservation: Reservation, reason: str = "") -> Reservation:
    if reservation.status in (ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.COMPLETED):
        return reservation

    reservation.status = ReservationStatus.CANCELLED
    await _log_event(
        session, reservation.id, ReservationEventType.STATUS_CHANGED.value, {"status": "cancelled", "reason": reason}
    )
    await session.commit()
    await _broadcast_range(
        session, reservation.restaurant_id, reservation.start_time, reservation.end_time
    )
    return reservation


async def mark_no_show(session: AsyncSession, reservation: Reservation) -> Reservation:
    if reservation.status != ReservationStatus.BOOKED:
        return reservation

    reservation.status = ReservationStatus.NO_SHOW
    await _log_event(session, reservation.id, ReservationEventType.STATUS_CHANGED.value, {"status": "no_show"})
    await session.commit()
    await _broadcast_range(
        session, reservation.restaurant_id, reservation.start_time, reservation.end_time
    )
    return reservation


async def seat_reservation(session: AsyncSession, reservation: Reservation) -> Reservation:
    reservation.status = ReservationStatus.SEATED
    await _log_event(session, reservation.id, ReservationEventType.STATUS_CHANGED.value, {"status": "seated"})
    await session.commit()
    return reservation


async def complete_early(session: AsyncSession, reservation: Reservation, completed_at: datetime) -> Reservation:
    if reservation.status != ReservationStatus.SEATED:
        return reservation

    reservation.status = ReservationStatus.COMPLETED
    await _log_event(
        session,
        reservation.id,
        ReservationEventType.STATUS_CHANGED.value,
        {"status": "completed", "completed_at": completed_at.isoformat()},
    )
    await session.commit()
    await _broadcast_range(session, reservation.restaurant_id, completed_at, reservation.end_time)
    return reservation


async def revert_status(session: AsyncSession, reservation: Reservation) -> Reservation:
    """Undo the last status change (seated -> booked, completed -> seated,
    cancelled/no_show -> booked). Re-checks the table is still free before reoccupying it,
    since cancelling or completing a reservation may have let someone else take that slot.
    """
    target = _REVERT_TARGET.get(reservation.status)
    if target is None:
        raise RevertError(f"A {reservation.status.value} reservation can't be undone")

    if target in _ACTIVE_STATUSES:
        conflict = await session.scalar(
            select(Reservation.id)
            .where(
                Reservation.assigned_table_id == reservation.assigned_table_id,
                Reservation.id != reservation.id,
                Reservation.status.in_(_ACTIVE_STATUSES),
                Reservation.start_time < reservation.end_time,
                Reservation.end_time > reservation.start_time,
            )
            .with_for_update()
        )
        if conflict is not None:
            raise RevertError("This table has since been booked for that time - can't undo")

    previous_status = reservation.status
    reservation.status = target
    await _log_event(
        session,
        reservation.id,
        ReservationEventType.STATUS_CHANGED.value,
        {"status": target.value, "source": "admin_undo", "previous_status": previous_status.value},
    )
    await session.commit()
    await _broadcast_range(
        session, reservation.restaurant_id, reservation.start_time, reservation.end_time
    )
    return reservation


async def delay_reservation(session: AsyncSession, reservation: Reservation, minutes: int) -> Reservation:
    """Shift a reservation forward, keeping the same assigned table - only allowed if that
    exact table has no other active reservation overlapping the new window.
    """
    if reservation.status != ReservationStatus.BOOKED:
        raise DelayConflictError("Only booked reservations can be delayed")

    old_start, old_end = reservation.start_time, reservation.end_time
    new_start = old_start + timedelta(minutes=minutes)
    new_end = end_time_for(new_start)

    conflict = await session.scalar(
        select(Reservation.id)
        .where(
            Reservation.assigned_table_id == reservation.assigned_table_id,
            Reservation.id != reservation.id,
            Reservation.status.in_(_ACTIVE_STATUSES),
            Reservation.start_time < new_end,
            Reservation.end_time > new_start,
        )
        .with_for_update()
    )
    if conflict is not None:
        raise DelayConflictError("Table is booked during the new window; reassign manually instead")

    reservation.start_time = new_start
    reservation.end_time = new_end
    await _log_event(
        session,
        reservation.id,
        ReservationEventType.DELAYED.value,
        {"minutes": minutes, "old_start": old_start.isoformat(), "new_start": new_start.isoformat()},
    )
    await session.commit()
    await _broadcast_range(session, reservation.restaurant_id, old_start, max(old_end, new_end))
    return reservation

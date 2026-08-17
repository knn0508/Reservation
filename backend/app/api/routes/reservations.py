from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_reservation_or_404
from app.core.config import settings
from app.core.db import get_session
from app.models.reservation import Reservation
from app.schemas.reservation import ReservationCreate, ReservationDelay, ReservationOut
from app.services import booking_service
from app.services.time_utils import floor_to_bucket, local_time_of_day

router = APIRouter(prefix="/api/reservations", tags=["reservations"])


def _validate_slot_time(start_time: datetime) -> datetime:
    aligned = floor_to_bucket(start_time)
    open_t, close_t = settings.service_open_time, settings.service_close_time
    local_time = local_time_of_day(aligned)
    if not (open_t <= local_time < close_t):
        raise HTTPException(status_code=422, detail="Requested time is outside service hours")
    return aligned


@router.post("", response_model=ReservationOut, status_code=201)
async def create_reservation(payload: ReservationCreate, session: AsyncSession = Depends(get_session)):
    start_time = _validate_slot_time(payload.start_time)
    try:
        reservation = await booking_service.create_reservation(
            session,
            guest_name=payload.guest_name,
            guest_email=payload.guest_email,
            guest_phone=payload.guest_phone,
            party_size=payload.party_size,
            start_time=start_time,
            idempotency_key=payload.idempotency_key,
        )
    except booking_service.BookingConflictError:
        raise HTTPException(status_code=409, detail="No tables available for this time and party size")
    return reservation


@router.get("/{reservation_id}", response_model=ReservationOut)
async def get_reservation(reservation: Reservation = Depends(get_reservation_or_404)):
    return reservation


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
async def cancel_reservation(
    reservation: Reservation = Depends(get_reservation_or_404), session: AsyncSession = Depends(get_session)
):
    return await booking_service.cancel_reservation(session, reservation)


@router.post("/{reservation_id}/no-show", response_model=ReservationOut)
async def no_show_reservation(
    reservation: Reservation = Depends(get_reservation_or_404), session: AsyncSession = Depends(get_session)
):
    return await booking_service.mark_no_show(session, reservation)


@router.post("/{reservation_id}/seat", response_model=ReservationOut)
async def seat_reservation(
    table_id: int,
    reservation: Reservation = Depends(get_reservation_or_404),
    session: AsyncSession = Depends(get_session),
):
    return await booking_service.seat_reservation(session, reservation, table_id)


@router.post("/{reservation_id}/complete", response_model=ReservationOut)
async def complete_reservation(
    reservation: Reservation = Depends(get_reservation_or_404), session: AsyncSession = Depends(get_session)
):
    return await booking_service.complete_early(session, reservation, datetime.now(reservation.start_time.tzinfo))


@router.post("/{reservation_id}/delay", response_model=ReservationOut)
async def delay_reservation(
    payload: ReservationDelay,
    reservation: Reservation = Depends(get_reservation_or_404),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await booking_service.delay_reservation(session, reservation, payload.minutes)
    except booking_service.DelayConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

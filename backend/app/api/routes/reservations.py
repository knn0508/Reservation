from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user, get_reservation_or_404
from app.core.config import settings
from app.core.db import get_session
from app.models.enums import UserRole
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import PreorderCreate, ReservationCreate, ReservationDelay, ReservationOut
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


def _require_owner_or_admin(reservation: Reservation, user: User) -> None:
    is_owner = reservation.user_id == user.id
    is_restaurant_admin = user.role == UserRole.ADMIN and user.restaurant_id == reservation.restaurant_id
    if not (is_owner or is_restaurant_admin):
        raise HTTPException(status_code=403, detail="Not allowed to modify this reservation")


def _require_restaurant_admin(reservation: Reservation, admin: User) -> None:
    if admin.restaurant_id != reservation.restaurant_id:
        raise HTTPException(status_code=404, detail="Reservation not found")


@router.post("", response_model=ReservationOut, status_code=201)
async def create_reservation(
    payload: ReservationCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    start_time = _validate_slot_time(payload.start_time)
    try:
        reservation = await booking_service.create_reservation(
            session,
            user_id=user.id,
            restaurant_id=payload.restaurant_id,
            guest_name=payload.guest_name,
            guest_email=payload.guest_email,
            guest_phone=payload.guest_phone,
            party_size=payload.party_size,
            start_time=start_time,
            idempotency_key=payload.idempotency_key,
        )
    except booking_service.BookingWindowError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except booking_service.UserConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except booking_service.BookingConflictError:
        raise HTTPException(status_code=409, detail="No tables available for this time and party size")
    return reservation


@router.get("/me", response_model=list[ReservationOut])
async def list_my_reservations(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    result = await session.scalars(
        select(Reservation).where(Reservation.user_id == user.id).order_by(Reservation.start_time.desc())
    )
    return list(result)


@router.get("/{reservation_id}", response_model=ReservationOut)
async def get_reservation(reservation: Reservation = Depends(get_reservation_or_404)):
    return reservation


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
async def cancel_reservation(
    reservation: Reservation = Depends(get_reservation_or_404),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _require_owner_or_admin(reservation, user)
    return await booking_service.cancel_reservation(session, reservation)


@router.post("/{reservation_id}/preorder", response_model=ReservationOut)
async def create_preorder(
    payload: PreorderCreate,
    reservation: Reservation = Depends(get_reservation_or_404),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _require_owner_or_admin(reservation, user)
    if payload.restaurant_id != reservation.restaurant_id:
        raise HTTPException(status_code=422, detail="This reservation is at a different restaurant")
    try:
        return await booking_service.request_preorder(
            session, reservation, [item.model_dump() for item in payload.items]
        )
    except booking_service.PreorderError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/{reservation_id}/no-show", response_model=ReservationOut)
async def no_show_reservation(
    reservation: Reservation = Depends(get_reservation_or_404),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    _require_restaurant_admin(reservation, admin)
    return await booking_service.mark_no_show(session, reservation)


@router.post("/{reservation_id}/seat", response_model=ReservationOut)
async def seat_reservation(
    reservation: Reservation = Depends(get_reservation_or_404),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    _require_restaurant_admin(reservation, admin)
    return await booking_service.seat_reservation(session, reservation)


@router.post("/{reservation_id}/complete", response_model=ReservationOut)
async def complete_reservation(
    reservation: Reservation = Depends(get_reservation_or_404),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    _require_restaurant_admin(reservation, admin)
    return await booking_service.complete_early(session, reservation, datetime.now(reservation.start_time.tzinfo))


@router.post("/{reservation_id}/revert", response_model=ReservationOut)
async def revert_reservation_status(
    reservation: Reservation = Depends(get_reservation_or_404),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    _require_restaurant_admin(reservation, admin)
    try:
        return await booking_service.revert_status(session, reservation)
    except booking_service.RevertError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/{reservation_id}/delay", response_model=ReservationOut)
async def delay_reservation(
    payload: ReservationDelay,
    reservation: Reservation = Depends(get_reservation_or_404),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    _require_restaurant_admin(reservation, admin)
    try:
        return await booking_service.delay_reservation(session, reservation, payload.minutes)
    except booking_service.DelayConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

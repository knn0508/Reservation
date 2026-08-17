from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models.dining_table import DiningTable
from app.models.reservation import Reservation
from app.schemas.reservation import ReservationOut
from app.services import inventory_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/tables")
async def list_tables(session: AsyncSession = Depends(get_session)):
    result = await session.scalars(select(DiningTable).where(DiningTable.is_active.is_(True)))
    return list(result)


@router.get("/reservations", response_model=list[ReservationOut])
async def list_reservations_for_day(day: date, session: AsyncSession = Depends(get_session)):
    from datetime import datetime, timedelta

    import pytz

    from app.core.config import settings

    tz = pytz.timezone(settings.restaurant_timezone)
    day_start = tz.localize(datetime(day.year, day.month, day.day))
    day_end = day_start + timedelta(days=1)
    result = await session.scalars(
        select(Reservation)
        .where(Reservation.start_time >= day_start, Reservation.start_time < day_end)
        .order_by(Reservation.start_time)
    )
    return list(result)


@router.post("/seed-day", status_code=201)
async def seed_day(day: date, session: AsyncSession = Depends(get_session)):
    count = await inventory_service.seed_day(session, day)
    return {"buckets_created_or_existing": count}

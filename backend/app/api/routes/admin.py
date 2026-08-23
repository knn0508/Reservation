from datetime import date, datetime, timedelta

import pytz
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.config import settings
from app.core.db import get_session
from app.models.dining_table import DiningTable
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.dashboard import (
    CategoryProducts,
    CategoryShare,
    ClientsSeries,
    SalesSeries,
)
from app.schemas.reservation import ReservationOut
from app.services import dashboard_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/tables")
async def list_tables(admin: User = Depends(get_current_admin), session: AsyncSession = Depends(get_session)):
    result = await session.scalars(
        select(DiningTable).where(
            DiningTable.restaurant_id == admin.restaurant_id, DiningTable.is_active.is_(True)
        )
    )
    return list(result)


@router.get("/reservations", response_model=list[ReservationOut])
async def list_reservations_for_day(
    day: date, admin: User = Depends(get_current_admin), session: AsyncSession = Depends(get_session)
):
    tz = pytz.timezone(settings.restaurant_timezone)
    day_start = tz.localize(datetime(day.year, day.month, day.day))
    day_end = day_start + timedelta(days=1)
    result = await session.scalars(
        select(Reservation)
        .where(
            Reservation.restaurant_id == admin.restaurant_id,
            Reservation.start_time >= day_start,
            Reservation.start_time < day_end,
        )
        .order_by(Reservation.start_time)
    )
    return list(result)


@router.get("/dashboard/sales", response_model=SalesSeries)
async def dashboard_sales(
    range: str = "this_month",
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await dashboard_service.get_sales_series(session, admin.restaurant_id, range)
    except dashboard_service.InvalidRangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/dashboard/clients", response_model=ClientsSeries)
async def dashboard_clients(
    range: str = "this_month",
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await dashboard_service.get_clients_series(session, admin.restaurant_id, range)
    except dashboard_service.InvalidRangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/dashboard/categories", response_model=list[CategoryShare])
async def dashboard_categories(
    range: str = "this_month",
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await dashboard_service.get_category_shares(session, admin.restaurant_id, range)
    except dashboard_service.InvalidRangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/dashboard/categories/{category_id}/products", response_model=CategoryProducts)
async def dashboard_category_products(
    category_id: int,
    range: str = "this_month",
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await dashboard_service.get_category_products(session, admin.restaurant_id, range, category_id)
    except dashboard_service.InvalidRangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

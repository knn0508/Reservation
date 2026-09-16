"""The owner dashboard's REST surface.

Read-only views of one restaurant's delivery operation, plus the one write a dispatcher
needs: assigning an order by hand. Everything is scoped to `admin.restaurant_id`.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.db import get_session
from app.models.delivery import Courier
from app.models.user import User
from app.schemas.fleet import (
    AssignInput,
    BoardOrder,
    CourierKpi,
    FleetCourier,
    FleetSummary,
    OriginCell,
)
from app.services import delivery_service, fleet_service

router = APIRouter(prefix="/api/admin/fleet", tags=["admin-fleet"])


@router.get("/summary", response_model=FleetSummary)
async def fleet_summary(
    admin: User = Depends(get_current_admin), session: AsyncSession = Depends(get_session)
):
    return await fleet_service.summary(session, admin.restaurant_id)


@router.get("/couriers", response_model=list[FleetCourier])
async def fleet_couriers(
    admin: User = Depends(get_current_admin), session: AsyncSession = Depends(get_session)
):
    """Initial map state. The dashboard calls this once on load and then listens on the
    socket - bootstrapping live state through the socket alone leaves an empty map whenever
    the connection drops during load."""
    return await fleet_service.list_couriers(session, admin.restaurant_id)


@router.get("/orders", response_model=list[BoardOrder])
async def fleet_orders(
    include_finished: bool = Query(default=False),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    return await fleet_service.list_board_orders(
        session, admin.restaurant_id, include_finished=include_finished
    )


@router.post("/orders/{order_id}/assign", response_model=BoardOrder)
async def assign_order(
    order_id: UUID,
    payload: AssignInput,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    order = await delivery_service.get_order(session, order_id)
    if order is None or order.restaurant_id != admin.restaurant_id:
        raise HTTPException(status_code=404, detail="Order not found")

    courier = await session.get(Courier, payload.courier_id)
    if courier is None or courier.restaurant_id != admin.restaurant_id:
        raise HTTPException(status_code=404, detail="Courier not found")

    try:
        order = await delivery_service.assign_order(session, order, courier, admin.id)
    except delivery_service.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    courier_user = await session.get(User, courier.user_id)
    return fleet_service.order_row(order, courier_user.full_name if courier_user else None)


@router.get("/analytics/origins", response_model=list[OriginCell])
async def analytics_origins(
    days: int = Query(default=30, ge=1, le=365),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    return await fleet_service.origin_cells(session, admin.restaurant_id, days)


@router.get("/analytics/couriers", response_model=list[CourierKpi])
async def analytics_couriers(
    days: int = Query(default=30, ge=1, le=365),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    return await fleet_service.courier_kpis(session, admin.restaurant_id, days)

"""Customer-facing delivery ordering + tracking.

The courier side lives in routes/courier.py - same models, different authorisation boundary.
"""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_session
from app.models.delivery import Courier, DeliveryOrder
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.delivery import CourierSummary, DeliveryOrderCreate, DeliveryOrderOut
from app.schemas.tracking import TrackingOut
from app.services import delivery_service, tracking_service

router = APIRouter(prefix="/api/delivery", tags=["delivery"])


async def _to_out(session: AsyncSession, order: DeliveryOrder) -> DeliveryOrderOut:
    """Attaches the courier snapshot the tracking screen shows once someone is assigned."""
    out = DeliveryOrderOut.model_validate(order)
    if order.courier_id is not None:
        courier = await session.get(Courier, order.courier_id)
        courier_user = await session.get(User, order.courier_id)
        if courier is not None and courier_user is not None:
            out.courier = CourierSummary(
                id=courier.user_id,
                full_name=courier_user.full_name,
                vehicle_type=courier.vehicle_type,
                plate_number=courier.plate_number,
            )
    return out


@router.get("/quote")
async def delivery_quote(subtotal: float = 0):
    """What the checkout page shows before the order exists."""
    fee = delivery_service.delivery_fee_for(Decimal(str(subtotal)))
    return {
        "delivery_fee": float(fee),
        "free_over": settings.delivery_free_over,
        "currency": "AZN",
    }


@router.post("/orders", response_model=DeliveryOrderOut, status_code=201)
async def create_delivery_order(
    payload: DeliveryOrderCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customer accounts can order delivery")
    try:
        order = await delivery_service.create_order(
            session,
            customer=user,
            restaurant_id=payload.restaurant_id,
            recipient_name=payload.recipient_name,
            recipient_phone=payload.recipient_phone,
            lat=payload.lat,
            lng=payload.lng,
            address_text=payload.address_text,
            building=payload.building,
            entrance=payload.entrance,
            floor=payload.floor,
            apartment=payload.apartment,
            courier_note=payload.courier_note,
            payment_method=payload.payment_method,
            items=[i.model_dump() for i in payload.items],
        )
    except delivery_service.DeliveryError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return await _to_out(session, order)


@router.get("/orders/me", response_model=list[DeliveryOrderOut])
async def list_my_delivery_orders(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    orders = await delivery_service.list_customer_orders(session, user.id)
    return [await _to_out(session, o) for o in orders]


@router.get("/orders/{order_id}", response_model=DeliveryOrderOut)
async def get_delivery_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    order = await delivery_service.get_order(session, order_id)
    # 404 rather than 403 for someone else's order: whether an id exists is not their business.
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _to_out(session, order)


@router.get("/orders/{order_id}/tracking", response_model=TrackingOut | None)
async def track_delivery_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Where the courier is right now.

    The tracking screen calls this once on open and then listens on the socket. Bootstrapping
    live state over the socket instead would leave the screen blank whenever the connection
    drops during load.

    Returns null rather than 404 when the courier has gone quiet - no position key means no
    signal, which is a normal state (tunnel, dead battery), not an error.
    """
    order = await delivery_service.get_order(session, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.courier_id is None or order.status not in (
        delivery_service.DeliveryStatus.ACCEPTED,
        delivery_service.DeliveryStatus.PICKED_UP,
    ):
        return None
    return await tracking_service.tracking_snapshot(
        courier_id=order.courier_id, drop_lat=order.lat, drop_lng=order.lng
    )


@router.post("/orders/{order_id}/cancel", response_model=DeliveryOrderOut)
async def cancel_delivery_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    order = await delivery_service.get_order(session, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        order = await delivery_service.cancel_order(session, order)
    except delivery_service.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return await _to_out(session, order)

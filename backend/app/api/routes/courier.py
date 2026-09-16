"""The courier board: claim an order, mark pickup, mark delivered.

A courier only ever sees orders of their own restaurant, and only the unclaimed ones plus
their own runs. Everything else is invisible to them - the restaurant filter is applied in
the service query, never assembled from a client-supplied id.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_courier, get_current_user
from app.core.db import get_session
from app.models.delivery import Courier
from app.models.user import User
from app.schemas.delivery import (
    CourierProfileOut,
    CourierShiftUpdate,
    DeliveryOrderOut,
)
from app.schemas.tracking import CourierPing, CourierPingAck
from app.services import delivery_service, tracking_service

router = APIRouter(prefix="/api/courier", tags=["courier"])


@router.get("/me", response_model=CourierProfileOut)
async def courier_profile(
    courier: Courier = Depends(get_current_courier), user: User = Depends(get_current_user)
):
    return CourierProfileOut(
        user_id=courier.user_id,
        restaurant_id=courier.restaurant_id,
        full_name=user.full_name,
        vehicle_type=courier.vehicle_type,
        plate_number=courier.plate_number,
        is_on_shift=courier.is_on_shift,
    )


@router.post("/me/shift", response_model=CourierProfileOut)
async def set_shift(
    payload: CourierShiftUpdate,
    courier: Courier = Depends(get_current_courier),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    courier = await delivery_service.set_shift(session, courier, payload.is_on_shift)
    return CourierProfileOut(
        user_id=courier.user_id,
        restaurant_id=courier.restaurant_id,
        full_name=user.full_name,
        vehicle_type=courier.vehicle_type,
        plate_number=courier.plate_number,
        is_on_shift=courier.is_on_shift,
    )


@router.post("/me/location", response_model=CourierPingAck)
async def report_location(
    ping: CourierPing,
    courier: Courier = Depends(get_current_courier),
    session: AsyncSession = Depends(get_session),
):
    """The courier device's position report.

    Deliberately does no database work. The courier row is not updated, no event is written
    and the order is not re-read from Postgres on this path - a ping arrives every few
    seconds per courier, and making it a database write turns tracking latency into database
    latency at exactly the busiest hour. Redis takes the write; the flush task persists it.

    The one thing that must be checked is that the courier is reporting against an order they
    actually hold, so a courier cannot inject position into someone else's delivery. That is
    a cheap indexed read and it is the authorisation boundary, so it stays.
    """
    order_id = None
    # Captured as a local so the publish below cannot come to depend on a name that only
    # exists when the branch above ran.
    drop: tuple[float, float] | None = None
    if ping.order_id:
        try:
            candidate = UUID(ping.order_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Malformed order id")
        order = await delivery_service.get_order(session, candidate)
        if order is None or order.courier_id != courier.user_id:
            raise HTTPException(status_code=404, detail="Order not found")
        order_id = candidate
        drop = (order.lat, order.lng)

    try:
        payload = await tracking_service.record_ping(
            courier_id=courier.user_id,
            lat=ping.lat,
            lng=ping.lng,
            heading=ping.heading,
            speed_mps=ping.speed_mps,
            accuracy_m=ping.accuracy_m,
            order_id=order_id,
        )
    except tracking_service.PingRejected as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if order_id is not None and drop is not None:
        # Same builder the REST bootstrap uses, so the screen cannot receive two different
        # shapes for the same event.
        await tracking_service.publish(
            order_id,
            "loc:update",
            tracking_service.customer_payload(payload, drop[0], drop[1]),
        )

    # The owner's dashboard tracks couriers, not orders, so this fires on every ping -
    # including while a courier is idle between runs, which is exactly when a dispatcher
    # wants to see where they are.
    await tracking_service.publish_fleet(
        courier.restaurant_id,
        {
            "c": courier.user_id,
            "lat": payload["lat"],
            "lng": payload["lng"],
            "h": payload.get("h"),
            "s": payload.get("s"),
            "t": payload["t"],
            "order_id": str(order_id) if order_id else None,
        },
    )
    return CourierPingAck()


@router.get("/orders/available", response_model=list[DeliveryOrderOut])
async def available_orders(
    courier: Courier = Depends(get_current_courier), session: AsyncSession = Depends(get_session)
):
    return await delivery_service.list_open_orders(session, courier.restaurant_id)


@router.get("/orders/mine", response_model=list[DeliveryOrderOut])
async def my_orders(
    courier: Courier = Depends(get_current_courier), session: AsyncSession = Depends(get_session)
):
    return await delivery_service.list_courier_orders(session, courier.user_id)


async def _load_for_courier(session: AsyncSession, order_id: UUID, courier: Courier):
    order = await delivery_service.get_order(session, order_id)
    if order is None or order.restaurant_id != courier.restaurant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/orders/{order_id}/accept", response_model=DeliveryOrderOut)
async def accept_order(
    order_id: UUID,
    courier: Courier = Depends(get_current_courier),
    session: AsyncSession = Depends(get_session),
):
    order = await _load_for_courier(session, order_id, courier)
    try:
        return await delivery_service.accept_order(session, order, courier)
    except delivery_service.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/orders/{order_id}/pickup", response_model=DeliveryOrderOut)
async def pickup_order(
    order_id: UUID,
    courier: Courier = Depends(get_current_courier),
    session: AsyncSession = Depends(get_session),
):
    order = await _load_for_courier(session, order_id, courier)
    try:
        return await delivery_service.mark_picked_up(session, order, courier.user_id)
    except delivery_service.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/orders/{order_id}/deliver", response_model=DeliveryOrderOut)
async def deliver_order(
    order_id: UUID,
    courier: Courier = Depends(get_current_courier),
    session: AsyncSession = Depends(get_session),
):
    order = await _load_for_courier(session, order_id, courier)
    try:
        return await delivery_service.mark_delivered(session, order, courier.user_id)
    except delivery_service.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

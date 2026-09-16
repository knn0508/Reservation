import asyncio
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import decode_access_token
from app.models.enums import DeliveryStatus
from app.services import delivery_service, tracking_service
from app.models.enums import UserRole
from app.models.user import User
from app.ws.manager import (
    dashboard_manager,
    delivery_listener,
    delivery_manager,
    fleet_listener,
    manager,
    redis_listener,
)

router = APIRouter()

_listener_tasks: dict[str, asyncio.Task] = {}
_delivery_listener_tasks: dict[str, asyncio.Task] = {}
_fleet_listener_tasks: dict[str, asyncio.Task] = {}

# The only statuses during which a customer may watch a courier move. Before `accepted`
# nobody is carrying the order; after `delivered` the food has arrived and the room is
# revoked - a customer must not be able to keep watching a courier's position afterwards.
_TRACKABLE = (DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP)


def _ensure_listener(restaurant_id: int, day: date) -> None:
    key = f"{restaurant_id}:{day.isoformat()}"
    task = _listener_tasks.get(key)
    if task is None or task.done():
        _listener_tasks[key] = asyncio.create_task(redis_listener(restaurant_id, day))


def _ensure_delivery_listener(order_id: str) -> None:
    task = _delivery_listener_tasks.get(order_id)
    if task is None or task.done():
        _delivery_listener_tasks[order_id] = asyncio.create_task(delivery_listener(order_id))


def _ensure_fleet_listener(restaurant_id: int) -> None:
    key = str(restaurant_id)
    task = _fleet_listener_tasks.get(key)
    if task is None or task.done():
        _fleet_listener_tasks[key] = asyncio.create_task(fleet_listener(restaurant_id))


@router.websocket("/ws/fleet/{restaurant_id}")
async def fleet_ws(
    websocket: WebSocket,
    restaurant_id: int,
    token: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Live courier positions for one restaurant's dashboard, batched once per second.

    Authorised before `accept()`, like the customer tracking socket: the caller must be an
    admin *of this restaurant*. The restaurant id in the path is never trusted on its own -
    it is checked against the admin's own `restaurant_id`, or one owner could watch another's
    couriers by editing the URL.
    """
    if token is None:
        await websocket.close(code=4401)
        return
    try:
        payload = decode_access_token(token)
    except JWTError:
        await websocket.close(code=4401)
        return

    user = await session.get(User, int(payload["sub"]))
    if user is None or user.role != UserRole.ADMIN or user.restaurant_id != restaurant_id:
        await websocket.close(code=4403)
        return

    key = str(restaurant_id)
    _ensure_fleet_listener(restaurant_id)
    await dashboard_manager.connect(key, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await dashboard_manager.disconnect(key, websocket)


@router.websocket("/ws/availability/{restaurant_id}/{day}")
async def availability_ws(websocket: WebSocket, restaurant_id: int, day: date):
    _ensure_listener(restaurant_id, day)
    await manager.connect(restaurant_id, day, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(restaurant_id, day, websocket)


@router.websocket("/ws/delivery/{order_id}")
async def delivery_tracking_ws(
    websocket: WebSocket,
    order_id: UUID,
    token: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Live position of the courier carrying one order.

    Authorisation is the whole point of this endpoint, so it happens before `accept()`:
    the room name arrives from the client and is never trusted. The JWT subject must be the
    order's customer, and the order must currently be in a trackable state. Both are checked
    against the database, not against anything the client sent.

    The token rides in a query parameter because the browser WebSocket API cannot set an
    Authorization header. It is the same short-lived access token as REST.
    """
    if token is None:
        await websocket.close(code=4401)
        return
    try:
        payload = decode_access_token(token)
    except JWTError:
        await websocket.close(code=4401)
        return

    order = await delivery_service.get_order(session, order_id)
    if order is None or order.customer_id != int(payload["sub"]):
        # Same code for "no such order" and "not yours": whether an id exists is not the
        # caller's business.
        await websocket.close(code=4404)
        return
    if order.status not in _TRACKABLE:
        await websocket.close(code=4409)
        return

    key = str(order_id)
    _ensure_delivery_listener(key)
    await delivery_manager.connect(key, websocket)
    try:
        # Bootstrap: the socket only carries *changes*, so without this the screen would sit
        # empty until the courier's next ping.
        if order.courier_id is not None:
            snapshot = await tracking_service.tracking_snapshot(
                courier_id=order.courier_id, drop_lat=order.lat, drop_lng=order.lng
            )
            if snapshot is not None:
                await websocket.send_json({"event": "loc:update", "data": snapshot})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await delivery_manager.disconnect(key, websocket)

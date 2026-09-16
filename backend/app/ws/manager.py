import asyncio
import json
from datetime import date, datetime, timezone

from fastapi import WebSocket

from app.core.redis import get_redis
from app.models.enums import TableCategory

CHANNEL_PREFIX = "availability:"
# Must match app.services.tracking_service.channel(); the publisher lives there because it
# runs on the ping path, the subscriber lives here because it owns the sockets.
DELIVERY_CHANNEL_PREFIX = "delivery:"
FLEET_CHANNEL_PREFIX = "fleet:"
# How often the dashboard is sent a position batch. 30 couriers pinging every 3 s is ten
# messages a second per open dashboard, and React re-renders itself to death; coalescing to
# one message per second is one render instead.
FLEET_BATCH_SECONDS = 1.0


def _channel(restaurant_id: int, day: date) -> str:
    return f"{CHANNEL_PREFIX}{restaurant_id}:{day.isoformat()}"


def _conn_key(restaurant_id: int, day: date) -> str:
    return f"{restaurant_id}:{day.isoformat()}"


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, restaurant_id: int, day: date, websocket: WebSocket) -> None:
        await websocket.accept()
        key = _conn_key(restaurant_id, day)
        async with self._lock:
            self._connections.setdefault(key, set()).add(websocket)

    async def disconnect(self, restaurant_id: int, day: date, websocket: WebSocket) -> None:
        key = _conn_key(restaurant_id, day)
        async with self._lock:
            self._connections.get(key, set()).discard(websocket)

    async def send_to_day(self, restaurant_id: int, day: date, message: dict) -> None:
        key = _conn_key(restaurant_id, day)
        dead = []
        for ws in self._connections.get(key, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.get(key, set()).discard(ws)


manager = ConnectionManager()


def _iso_z(value: datetime) -> str:
    """Match FastAPI/Pydantic's 'Z'-suffixed datetime JSON encoding so REST payloads
    and WebSocket pushes use identical time strings for frontend cache-key matching."""
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


async def broadcast_slot_update(restaurant_id: int, day: date, category: TableCategory, slot: dict) -> None:
    """Publish a zero-PII availability delta: real free-table count for one category/slot."""
    payload = {
        "time": _iso_z(slot["time"]) if isinstance(slot["time"], datetime) else slot["time"],
        "category": category.value,
        "available_count": slot["available_count"],
    }
    redis = get_redis()
    await redis.publish(_channel(restaurant_id, day), json.dumps(payload))


async def redis_listener(restaurant_id: int, day: date) -> None:
    """Background task: relay Redis pub/sub messages for one restaurant/day to local WebSocket clients.

    Using Redis pub/sub (not direct in-process broadcast) lets multiple FastAPI
    worker processes share one source of truth for availability events.
    """
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(_channel(restaurant_id, day))
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            await manager.send_to_day(restaurant_id, day, data)
    finally:
        await pubsub.unsubscribe(_channel(restaurant_id, day))
        await pubsub.close()


class DeliveryConnectionManager:
    """Sockets watching one delivery order.

    Separate from the availability manager because the unit of subscription is different:
    availability is per restaurant/day and public, a delivery room is per order and private
    to that order's customer. Keeping them apart means a bug in one cannot leak into the
    other's fan-out.
    """

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, order_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(order_id, set()).add(websocket)

    async def disconnect(self, order_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.get(order_id, set()).discard(websocket)

    async def send_to_order(self, order_id: str, message: dict) -> None:
        dead = []
        for ws in self._connections.get(order_id, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.get(order_id, set()).discard(ws)


delivery_manager = DeliveryConnectionManager()


class DashboardConnectionManager:
    """Sockets watching one restaurant's whole fleet."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, restaurant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(restaurant_id, set()).add(websocket)

    async def disconnect(self, restaurant_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.get(restaurant_id, set()).discard(websocket)

    async def send_to_restaurant(self, restaurant_id: str, message: dict) -> None:
        dead = []
        for ws in self._connections.get(restaurant_id, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.get(restaurant_id, set()).discard(ws)


dashboard_manager = DashboardConnectionManager()


async def fleet_listener(restaurant_id: int) -> None:
    """Relay one restaurant's courier positions to its dashboards, one batch per second.

    Pings are collected into a dict keyed by courier, so a courier that pinged five times
    inside the window contributes one entry with its newest position - the older ones are
    worthless the moment a newer fix exists.
    """
    redis = get_redis()
    pubsub = redis.pubsub()
    channel = f"{FLEET_CHANNEL_PREFIX}{restaurant_id}"
    await pubsub.subscribe(channel)
    pending: dict[int, dict] = {}
    key = str(restaurant_id)

    async def flush_loop() -> None:
        while True:
            await asyncio.sleep(FLEET_BATCH_SECONDS)
            if not pending:
                continue
            batch = list(pending.values())
            pending.clear()
            await dashboard_manager.send_to_restaurant(key, {"event": "loc:batch", "data": batch})

    flusher = asyncio.create_task(flush_loop())
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            item = json.loads(message["data"])
            pending[item["c"]] = item
    finally:
        flusher.cancel()
        await pubsub.unsubscribe(channel)
        await pubsub.close()


async def delivery_listener(order_id: str) -> None:
    """Relay one order's Redis channel to the sockets watching it in this process.

    Via Redis rather than an in-process call for the same reason as availability: the ping
    that moves the marker may be handled by a different uvicorn worker than the one holding
    the customer's socket.
    """
    redis = get_redis()
    pubsub = redis.pubsub()
    channel = f"{DELIVERY_CHANNEL_PREFIX}{order_id}"
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            await delivery_manager.send_to_order(order_id, json.loads(message["data"]))
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()

import asyncio
import json
from datetime import date, datetime, timezone

from fastapi import WebSocket

from app.core.redis import get_redis
from app.models.enums import TableCategory

CHANNEL_PREFIX = "availability:"


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

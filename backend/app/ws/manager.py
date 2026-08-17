import asyncio
import json
from datetime import date, datetime, timezone

from fastapi import WebSocket

from app.core.redis import get_redis

CHANNEL_PREFIX = "availability:"


def _channel(day: date) -> str:
    return f"{CHANNEL_PREFIX}{day.isoformat()}"


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, day: date, websocket: WebSocket) -> None:
        await websocket.accept()
        key = day.isoformat()
        async with self._lock:
            self._connections.setdefault(key, set()).add(websocket)

    async def disconnect(self, day: date, websocket: WebSocket) -> None:
        key = day.isoformat()
        async with self._lock:
            self._connections.get(key, set()).discard(websocket)

    async def send_to_day(self, day: date, message: dict) -> None:
        key = day.isoformat()
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


async def broadcast_slot_update(day: date, slot: dict) -> None:
    """Publish a zero-PII availability delta: raw free-table counts only."""
    payload = {
        "time": _iso_z(slot["time"]) if isinstance(slot["time"], datetime) else slot["time"],
        "tables_2_free": slot["tables_2_free"],
        "tables_4_free": slot["tables_4_free"],
    }
    redis = get_redis()
    await redis.publish(_channel(day), json.dumps(payload))


async def redis_listener(day: date) -> None:
    """Background task: relay Redis pub/sub messages for one day to local WebSocket clients.

    Using Redis pub/sub (not direct in-process broadcast) lets multiple FastAPI
    worker processes share one source of truth for availability events.
    """
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(_channel(day))
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            await manager.send_to_day(day, data)
    finally:
        await pubsub.unsubscribe(_channel(day))
        await pubsub.close()

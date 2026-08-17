import asyncio
from datetime import date

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import manager, redis_listener

router = APIRouter()

_listener_tasks: dict[str, asyncio.Task] = {}


def _ensure_listener(restaurant_id: int, day: date) -> None:
    key = f"{restaurant_id}:{day.isoformat()}"
    task = _listener_tasks.get(key)
    if task is None or task.done():
        _listener_tasks[key] = asyncio.create_task(redis_listener(restaurant_id, day))


@router.websocket("/ws/availability/{restaurant_id}/{day}")
async def availability_ws(websocket: WebSocket, restaurant_id: int, day: date):
    _ensure_listener(restaurant_id, day)
    await manager.connect(restaurant_id, day, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(restaurant_id, day, websocket)

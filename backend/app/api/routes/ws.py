import asyncio
from datetime import date

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import manager, redis_listener

router = APIRouter()

_listener_tasks: dict[str, asyncio.Task] = {}


def _ensure_listener(day: date) -> None:
    key = day.isoformat()
    task = _listener_tasks.get(key)
    if task is None or task.done():
        _listener_tasks[key] = asyncio.create_task(redis_listener(day))


@router.websocket("/ws/availability/{day}")
async def availability_ws(websocket: WebSocket, day: date):
    _ensure_listener(day)
    await manager.connect(day, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(day, websocket)

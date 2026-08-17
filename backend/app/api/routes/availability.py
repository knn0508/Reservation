from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_session
from app.schemas.reservation import AvailabilitySlot
from app.services import inventory_service

router = APIRouter(prefix="/api/availability", tags=["availability"])


@router.get("", response_model=list[AvailabilitySlot])
async def get_availability(day: date, session: AsyncSession = Depends(get_session)):
    slots = await inventory_service.get_slots(session, day, settings.restaurant_timezone)
    return slots

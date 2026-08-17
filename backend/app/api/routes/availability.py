from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_session
from app.schemas.reservation import AvailabilitySlot
from app.services import availability_service

router = APIRouter(prefix="/api/availability", tags=["availability"])


@router.get("", response_model=list[AvailabilitySlot])
async def get_availability(
    restaurant_id: int, day: date, party_size: int, session: AsyncSession = Depends(get_session)
):
    today = date.today()
    if not (today <= day <= today + timedelta(days=settings.booking_max_days_ahead)):
        raise HTTPException(
            status_code=422,
            detail=f"Reservations can only be made between today and {settings.booking_max_days_ahead} days ahead",
        )
    return await availability_service.get_slots(session, restaurant_id, day, party_size)

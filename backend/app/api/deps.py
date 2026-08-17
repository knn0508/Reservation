from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models.reservation import Reservation


async def get_reservation_or_404(reservation_id: UUID, session: AsyncSession = Depends(get_session)) -> Reservation:
    reservation = await session.scalar(select(Reservation).where(Reservation.id == reservation_id))
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return reservation

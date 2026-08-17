from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models.restaurant import Restaurant
from app.schemas.restaurant import RestaurantOut

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])


@router.get("", response_model=list[RestaurantOut])
async def list_restaurants(session: AsyncSession = Depends(get_session)):
    result = await session.scalars(select(Restaurant).order_by(Restaurant.id))
    return list(result)

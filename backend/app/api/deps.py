from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import decode_access_token
from app.models.enums import UserRole
from app.models.reservation import Reservation
from app.models.user import User

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_reservation_or_404(reservation_id: UUID, session: AsyncSession = Depends(get_session)) -> Reservation:
    reservation = await session.scalar(select(Reservation).where(Reservation.id == reservation_id))
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return reservation


async def get_current_user(
    token: str | None = Depends(_oauth2_scheme), session: AsyncSession = Depends(get_session)
) -> User:
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await session.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN or user.restaurant_id is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

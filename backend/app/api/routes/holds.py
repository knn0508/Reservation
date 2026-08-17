from fastapi import APIRouter

from app.schemas.reservation import HoldCreate, HoldOut
from app.services import hold_service

router = APIRouter(prefix="/api/holds", tags=["holds"])


@router.post("", response_model=HoldOut)
async def create_hold(payload: HoldCreate):
    hold_id, expires_at = await hold_service.create_hold(payload.party_size, payload.start_time)
    return HoldOut(hold_id=hold_id, expires_at=expires_at)


@router.delete("/{hold_id}", status_code=204)
async def release_hold(hold_id: str, party_size: int, start_time: str):
    from datetime import datetime

    await hold_service.release_hold(party_size, datetime.fromisoformat(start_time), hold_id)

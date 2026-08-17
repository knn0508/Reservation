import uuid
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.redis import get_redis
from app.models.enums import TableCategory
from app.services.time_utils import category_for_party_size


def _hold_key(restaurant_id: int, category: TableCategory, start_time: datetime, hold_id: str) -> str:
    return f"hold:{restaurant_id}:{category.value}:{start_time.isoformat()}:{hold_id}"


async def create_hold(restaurant_id: int, party_size: int, start_time: datetime) -> tuple[str, datetime]:
    category = category_for_party_size(party_size)
    hold_id = uuid.uuid4().hex
    redis = get_redis()
    key = _hold_key(restaurant_id, category, start_time, hold_id)
    await redis.set(key, "1", ex=settings.hold_ttl_seconds)
    expires_at = datetime.now(start_time.tzinfo) + timedelta(seconds=settings.hold_ttl_seconds)
    return hold_id, expires_at


async def release_hold(restaurant_id: int, party_size: int, start_time: datetime, hold_id: str) -> None:
    category = category_for_party_size(party_size)
    redis = get_redis()
    await redis.delete(_hold_key(restaurant_id, category, start_time, hold_id))


async def count_active_holds(restaurant_id: int, category: TableCategory, start_time: datetime) -> int:
    redis = get_redis()
    pattern = f"hold:{restaurant_id}:{category.value}:{start_time.isoformat()}:*"
    count = 0
    async for _ in redis.scan_iter(match=pattern):
        count += 1
    return count

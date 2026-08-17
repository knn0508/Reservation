from datetime import datetime, time, timedelta

import pytz

from app.core.config import settings

RESTAURANT_TZ = pytz.timezone(settings.restaurant_timezone)


def local_time_of_day(dt: datetime) -> time:
    return dt.astimezone(RESTAURANT_TZ).time()


def category_for_party_size(party_size: int) -> str:
    from app.models.enums import TableCategory

    return TableCategory.SEATER_2 if party_size <= 2 else TableCategory.SEATER_4


def floor_to_bucket(dt: datetime) -> datetime:
    minutes = (dt.minute // settings.bucket_minutes) * settings.bucket_minutes
    return dt.replace(minute=0, second=0, microsecond=0) + timedelta(minutes=minutes)


def end_time_for(start_time: datetime) -> datetime:
    span_minutes = settings.turn_buckets * settings.bucket_minutes
    return start_time + timedelta(minutes=span_minutes)


def bucket_range(start_time: datetime) -> list[datetime]:
    return [
        start_time + timedelta(minutes=i * settings.bucket_minutes)
        for i in range(settings.turn_buckets)
    ]

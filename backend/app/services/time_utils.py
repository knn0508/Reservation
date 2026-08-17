from datetime import date, datetime, time, timedelta

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


def slot_times_for_day(day: date) -> list[datetime]:
    """Every bookable slot start time for a service day, from open to close."""
    open_t, close_t = settings.service_open_time, settings.service_close_time
    cursor = RESTAURANT_TZ.localize(datetime(day.year, day.month, day.day, open_t.hour, open_t.minute))
    day_close = RESTAURANT_TZ.localize(datetime(day.year, day.month, day.day, close_t.hour, close_t.minute))
    times = []
    while cursor < day_close:
        times.append(cursor)
        cursor += timedelta(minutes=settings.bucket_minutes)
    return times

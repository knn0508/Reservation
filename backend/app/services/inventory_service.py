from datetime import date, datetime, timedelta

import pytz
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import TableCategory

CATEGORY_COLUMN = {
    TableCategory.SEATER_2: "tables_2_free",
    TableCategory.SEATER_4: "tables_4_free",
}


async def decrement_range(
    session: AsyncSession,
    category: TableCategory,
    start_time: datetime,
    end_time: datetime,
    max_arrivals: int,
) -> bool:
    """Atomically decrement free-table count across every bucket in [start_time, end_time).

    Index-ordered ranged UPDATE: a single statement, capacity-filtered in the WHERE
    clause, so concurrent callers serialize on the row locks instead of racing a
    read-then-write. If fewer rows update than buckets requested, the whole booking
    is infeasible and the caller must roll back.
    """
    column = CATEGORY_COLUMN[category]
    query = text(
        f"""
        UPDATE inventory_bucket
        SET {column} = {column} - 1,
            arrivals_count = arrivals_count + 1
        WHERE bucket_time >= :start_time
          AND bucket_time < :end_time
          AND {column} > 0
          AND arrivals_count < :max_arrivals
        """
    )
    result = await session.execute(
        query,
        {"start_time": start_time, "end_time": end_time, "max_arrivals": max_arrivals},
    )
    expected_buckets = settings.turn_buckets
    return result.rowcount == expected_buckets


async def increment_range(
    session: AsyncSession,
    category: TableCategory,
    start_time: datetime,
    end_time: datetime,
) -> None:
    column = CATEGORY_COLUMN[category]
    query = text(
        f"""
        UPDATE inventory_bucket
        SET {column} = {column} + 1,
            arrivals_count = GREATEST(arrivals_count - 1, 0)
        WHERE bucket_time >= :start_time
          AND bucket_time < :end_time
        """
    )
    await session.execute(query, {"start_time": start_time, "end_time": end_time})


async def get_slots(
    session: AsyncSession, day: date, tz_name: str
) -> list[dict]:
    query = text(
        """
        SELECT bucket_time, tables_2_free, tables_4_free
        FROM inventory_bucket
        WHERE bucket_time >= :day_start AND bucket_time < :day_end
        ORDER BY bucket_time
        """
    )
    tz = pytz.timezone(tz_name)
    day_start = tz.localize(datetime(day.year, day.month, day.day))
    day_end = day_start + timedelta(days=1)
    result = await session.execute(query, {"day_start": day_start, "day_end": day_end})
    return [
        {"time": row.bucket_time, "tables_2_free": row.tables_2_free, "tables_4_free": row.tables_4_free}
        for row in result
    ]


async def seed_day(session: AsyncSession, day: date) -> int:
    """Generate empty inventory buckets for one service day. Idempotent (ON CONFLICT DO NOTHING)."""
    tz = pytz.timezone(settings.restaurant_timezone)
    open_t = settings.service_open_time
    close_t = settings.service_close_time
    cursor = tz.localize(datetime(day.year, day.month, day.day, open_t.hour, open_t.minute))
    day_close = tz.localize(datetime(day.year, day.month, day.day, close_t.hour, close_t.minute))

    rows = []
    while cursor < day_close:
        rows.append(cursor)
        cursor += timedelta(minutes=settings.bucket_minutes)

    query = text(
        """
        INSERT INTO inventory_bucket (bucket_time, tables_2_free, tables_4_free, arrivals_count)
        VALUES (:bucket_time, :t2, :t4, 0)
        ON CONFLICT (bucket_time) DO NOTHING
        """
    )
    for bucket_time in rows:
        await session.execute(
            query,
            {
                "bucket_time": bucket_time,
                "t2": settings.tables_2_seater_count,
                "t4": settings.tables_4_seater_count,
            },
        )
    await session.commit()
    return len(rows)

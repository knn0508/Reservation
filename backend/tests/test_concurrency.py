"""Concurrency proof: fire 40 simultaneous bookings at 5 four-seater tables and 19:00.
Exactly 5 must succeed (201-equivalent), 35 must fail, and tables_4_free must land at 0.
"""
import asyncio
from datetime import datetime

import pytest
import pytz
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.core.config import settings
from app.services import inventory_service

pytestmark = pytest.mark.asyncio


async def _attempt_booking(session_factory: async_sessionmaker, start_time: datetime, end_time: datetime) -> bool:
    async with session_factory() as session:
        from app.models.enums import TableCategory

        ok = await inventory_service.decrement_range(
            session, TableCategory.SEATER_4, start_time, end_time, max_arrivals=999
        )
        if ok:
            await session.commit()
        else:
            await session.rollback()
        return ok


async def test_exactly_five_of_forty_succeed(engine, session_factory, seeded_day, monkeypatch):
    monkeypatch.setattr(settings, "tables_4_seater_count", 5)

    tz = pytz.timezone(settings.restaurant_timezone)
    start_time = tz.localize(datetime(seeded_day.year, seeded_day.month, seeded_day.day, 19, 0))

    from app.services.time_utils import end_time_for

    end_time = end_time_for(start_time)

    async with session_factory() as session:
        from sqlalchemy import text

        await session.execute(
            text("UPDATE inventory_bucket SET tables_4_free = 5 WHERE bucket_time >= :s AND bucket_time < :e"),
            {"s": start_time, "e": end_time},
        )
        await session.commit()

    results = await asyncio.gather(
        *[_attempt_booking(session_factory, start_time, end_time) for _ in range(40)]
    )

    successes = sum(results)
    assert successes == 5
    assert results.count(False) == 35

    async with session_factory() as session:
        from sqlalchemy import text

        row = (
            await session.execute(
                text("SELECT tables_4_free FROM inventory_bucket WHERE bucket_time = :t"), {"t": start_time}
            )
        ).first()
        assert row.tables_4_free == 0

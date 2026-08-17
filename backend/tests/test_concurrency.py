"""Concurrency proof: fire 40 simultaneous bookings at 5 four-seater tables and 19:00.
Exactly 5 must succeed, 35 must fail with BookingConflictError, and all 5 successes must land
on distinct tables (proving no table gets double-booked under concurrency).
"""
import uuid
from datetime import datetime

import pytest
import pytz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import settings
from app.models.dining_table import DiningTable
from app.models.enums import TableCategory, UserRole
from app.models.user import User
from app.services import booking_service

pytestmark = pytest.mark.asyncio


async def _attempt_booking(
    session_factory: async_sessionmaker, restaurant_id: int, user_id: int, start_time: datetime
) -> int | None:
    async with session_factory() as session:
        try:
            reservation = await booking_service.create_reservation(
                session,
                user_id=user_id,
                restaurant_id=restaurant_id,
                guest_name="Guest",
                guest_email="guest@example.com",
                guest_phone="+994000000000",
                party_size=4,
                start_time=start_time,
                idempotency_key=uuid.uuid4().hex,
            )
            return reservation.assigned_table_id
        except booking_service.BookingConflictError:
            return None


async def test_exactly_five_of_forty_succeed(engine, session_factory, restaurant):
    async with session_factory() as session:
        for i in range(5):
            session.add(
                DiningTable(
                    restaurant_id=restaurant.id, table_number=f"T4-{i}", category=TableCategory.SEATER_4, zone="main"
                )
            )
        for i in range(40):
            session.add(
                User(
                    email=f"guest{i}@example.com",
                    password_hash="x",
                    full_name=f"Guest {i}",
                    phone="+994000000000",
                    role=UserRole.CUSTOMER,
                )
            )
        await session.commit()
        user_ids = list(await session.scalars(select(User.id).order_by(User.id)))

    tz = pytz.timezone(settings.restaurant_timezone)
    today = datetime.now(tz).date()
    start_time = tz.localize(datetime(today.year, today.month, today.day, 19, 0))

    import asyncio

    results = await asyncio.gather(
        *[_attempt_booking(session_factory, restaurant.id, user_id, start_time) for user_id in user_ids]
    )

    successes = [table_id for table_id in results if table_id is not None]
    assert len(successes) == 5
    assert results.count(None) == 35
    assert len(set(successes)) == 5  # every success got a distinct table

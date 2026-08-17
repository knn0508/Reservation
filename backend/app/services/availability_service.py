from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dining_table import DiningTable
from app.models.enums import ReservationStatus, TableCategory
from app.models.reservation import Reservation
from app.services.time_utils import category_for_party_size, end_time_for, slot_times_for_day

_OCCUPYING_STATUSES = (ReservationStatus.BOOKED, ReservationStatus.SEATED)


async def _count_active_tables(session: AsyncSession, restaurant_id: int, category: TableCategory) -> int:
    return await session.scalar(
        select(func.count()).select_from(DiningTable).where(
            DiningTable.restaurant_id == restaurant_id,
            DiningTable.category == category,
            DiningTable.is_active.is_(True),
        )
    )


async def get_slots_for_category(
    session: AsyncSession, restaurant_id: int, category: TableCategory, day: date
) -> list[dict]:
    """Real per-slot availability: total active tables of this category minus however many
    have an overlapping booked/seated reservation. Cancelled/no-show/completed never occupy.
    """
    times = slot_times_for_day(day)
    if not times:
        return []

    total = await _count_active_tables(session, restaurant_id, category)
    window_start, window_end = times[0], end_time_for(times[-1])

    result = await session.execute(
        select(Reservation.start_time, Reservation.end_time).where(
            Reservation.restaurant_id == restaurant_id,
            Reservation.table_category == category,
            Reservation.status.in_(_OCCUPYING_STATUSES),
            Reservation.start_time < window_end,
            Reservation.end_time > window_start,
        )
    )
    active_windows = result.all()

    slots = []
    for slot_time in times:
        slot_end = end_time_for(slot_time)
        occupied = sum(1 for r in active_windows if r.start_time < slot_end and r.end_time > slot_time)
        slots.append({"time": slot_time, "available_count": max(total - occupied, 0)})
    return slots


async def get_slots(
    session: AsyncSession, restaurant_id: int, day: date, party_size: int
) -> list[dict]:
    category = category_for_party_size(party_size)
    return await get_slots_for_category(session, restaurant_id, category, day)

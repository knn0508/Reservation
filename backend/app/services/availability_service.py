from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dining_table import DiningTable
from app.models.enums import ReservationStatus, TableCategory
from app.models.reservation import Reservation
from app.services.time_utils import (
    category_for_party_size,
    end_time_for,
    slot_times_for_day,
    tables_needed_for_party_size,
)

_OCCUPYING_STATUSES = (ReservationStatus.BOOKED, ReservationStatus.SEATED)

_SEATS = {TableCategory.SEATER_2: 2, TableCategory.SEATER_4: 4}


async def _active_tables(session: AsyncSession, restaurant_id: int) -> list[DiningTable]:
    return list(await session.scalars(
        select(DiningTable).where(
            DiningTable.restaurant_id == restaurant_id,
            DiningTable.is_active.is_(True),
        ).order_by(DiningTable.id)
    ))


async def get_slots_for_category(
    session: AsyncSession, restaurant_id: int, category: TableCategory, day: date
) -> list[dict]:
    """Real per-slot availability for the whole dining room.

    Every active table is returned with its floor position so the client can draw the room;
    `fits` marks the ones that match the requested party size, and `available_count` only
    counts those. A table is occupied when a booked/seated reservation overlaps the slot -
    cancelled/no-show/completed never occupy.
    """
    times = slot_times_for_day(day)
    if not times:
        return []

    tables = await _active_tables(session, restaurant_id)
    window_start, window_end = times[0], end_time_for(times[-1])

    result = await session.execute(
        select(
            Reservation.assigned_table_id,
            Reservation.start_time,
            Reservation.end_time,
            Reservation.merged_table_ids,
        ).where(
            Reservation.restaurant_id == restaurant_id,
            Reservation.status.in_(_OCCUPYING_STATUSES),
            Reservation.start_time < window_end,
            Reservation.end_time > window_start,
        )
    )
    active_windows = result.all()

    slots = []
    for slot_time in times:
        slot_end = end_time_for(slot_time)
        # A reservation occupies its assigned table plus whichever tables were merged onto it,
        # so a party of 7 spanning two four-tops marks both tables occupied here, not just one.
        occupied: set[int] = set()
        for r in active_windows:
            if r.start_time < slot_end and r.end_time > slot_time:
                occupied.add(r.assigned_table_id)
                occupied.update(r.merged_table_ids or [])
        slot_tables = [
            {
                "id": table.id,
                "table_number": table.table_number,
                "zone": table.zone,
                "seats": _SEATS[table.category],
                "pos_x": table.pos_x,
                "pos_y": table.pos_y,
                "fits": table.category == category,
                "available": table.id not in occupied,
            }
            for table in tables
        ]
        slots.append(
            {
                "time": slot_time,
                "available_count": sum(1 for t in slot_tables if t["fits"] and t["available"]),
                "tables": slot_tables,
            }
        )
    return slots


async def get_slots(
    session: AsyncSession, restaurant_id: int, day: date, party_size: int
) -> list[dict]:
    category = category_for_party_size(party_size)
    tables_needed = tables_needed_for_party_size(party_size)
    slots = await get_slots_for_category(session, restaurant_id, category, day)
    if tables_needed <= 1:
        return slots
    # Party needs several merged tables - a slot is only bookable if that many free tables
    # of this category can be merged together for the whole window.
    return [
        {"time": s["time"], "available_count": s["available_count"] // tables_needed}
        for s in slots
    ]

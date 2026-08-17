"""Seeds dining tables and today+tomorrow's inventory buckets. Run: python -m scripts.seed"""
import asyncio
from datetime import date, timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.models.dining_table import DiningTable
from app.models.enums import TableCategory
from app.services.inventory_service import seed_day


async def main() -> None:
    async with AsyncSessionLocal() as session:
        existing = await session.scalar(select(DiningTable).limit(1))
        if existing is None:
            for i in range(1, settings.tables_2_seater_count + 1):
                session.add(DiningTable(table_number=f"T2-{i}", category=TableCategory.SEATER_2, zone="main"))
            for i in range(1, settings.tables_4_seater_count + 1):
                session.add(DiningTable(table_number=f"T4-{i}", category=TableCategory.SEATER_4, zone="main"))
            await session.commit()
            print("Seeded dining tables")

        for offset in range(2):
            day = date.today() + timedelta(days=offset)
            count = await seed_day(session, day)
            print(f"Seeded {count} buckets for {day}")


if __name__ == "__main__":
    asyncio.run(main())

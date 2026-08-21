"""Seeds two restaurants, their dining room layouts, and one admin account each. Run: python -m scripts.seed

Table positions are percentages (0-100) of the dining room floor, so the same layout renders
at any size on the floor plan. Re-running syncs zone/position of existing tables in place -
table rows are never recreated, so reservations pointing at them stay valid.
"""
import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import hash_password
from app.models.dining_table import DiningTable
from app.models.enums import TableCategory, UserRole
from app.models.restaurant import Restaurant
from app.models.user import User

T2, T4 = TableCategory.SEATER_2, TableCategory.SEATER_4

# (table_number, category, zone, pos_x, pos_y)
MUGAM_LAYOUT = [
    ("T2-1", T2, "window", 12, 10),
    ("T2-2", T2, "window", 37, 10),
    ("T2-3", T2, "window", 62, 10),
    ("T2-4", T2, "window", 87, 10),
    ("T4-1", T4, "hall", 16, 38),
    ("T4-2", T4, "hall", 50, 38),
    ("T4-3", T4, "hall", 84, 38),
    ("T4-4", T4, "hall", 16, 66),
    ("T4-5", T4, "hall", 50, 66),
    ("T4-6", T4, "hall", 84, 66),
    ("T2-5", T2, "lounge", 12, 95),
    ("T2-6", T2, "lounge", 37, 95),
    ("T2-7", T2, "lounge", 62, 95),
    ("T2-8", T2, "lounge", 87, 95),
]

NAR_LAYOUT = [
    ("T2-1", T2, "window", 10, 8),
    ("T2-2", T2, "window", 33, 8),
    ("T2-3", T2, "window", 56, 8),
    ("T2-4", T2, "window", 79, 8),
    ("T4-1", T4, "hall", 14, 36),
    ("T4-2", T4, "hall", 48, 31),
    ("T4-3", T4, "hall", 82, 36),
    ("T4-4", T4, "hall", 14, 66),
    ("T4-5", T4, "hall", 48, 71),
    ("T4-6", T4, "hall", 82, 66),
    ("T2-5", T2, "lounge", 10, 96),
    ("T2-6", T2, "lounge", 33, 96),
    ("T2-7", T2, "lounge", 56, 96),
    ("T2-8", T2, "lounge", 79, 96),
]

RESTAURANTS = [
    {
        "slug": "mamajan-georgian-cuisine",
        "name": "Mamajan Georgian Cuisine",
        "admin_email": "admin@mamajan-georgian-cuisine-demo.com",
        "admin_password": "admin12345",
        "layout": MUGAM_LAYOUT,
    },
    {
        "slug": "nar-bagi",
        "name": "Nar Bağı",
        "admin_email": "admin@narbagi-demo.com",
        "admin_password": "admin12345",
        "layout": NAR_LAYOUT,
    },
]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        for spec in RESTAURANTS:
            restaurant = await session.scalar(select(Restaurant).where(Restaurant.slug == spec["slug"]))
            if restaurant is None:
                restaurant = Restaurant(slug=spec["slug"], name=spec["name"])
                session.add(restaurant)
                await session.flush()
                print(f"Seeded restaurant: {spec['name']}")

            existing = {
                table.table_number: table
                for table in await session.scalars(
                    select(DiningTable).where(DiningTable.restaurant_id == restaurant.id)
                )
            }
            created = updated = 0
            for table_number, category, zone, pos_x, pos_y in spec["layout"]:
                table = existing.get(table_number)
                if table is None:
                    session.add(
                        DiningTable(
                            restaurant_id=restaurant.id,
                            table_number=table_number,
                            category=category,
                            zone=zone,
                            pos_x=pos_x,
                            pos_y=pos_y,
                        )
                    )
                    created += 1
                elif (table.zone, table.pos_x, table.pos_y) != (zone, pos_x, pos_y):
                    table.zone, table.pos_x, table.pos_y = zone, pos_x, pos_y
                    updated += 1
            if created or updated:
                print(f"{spec['name']} layout: {created} tables added, {updated} repositioned")

            admin = await session.scalar(select(User).where(User.email == spec["admin_email"]))
            if admin is None:
                session.add(
                    User(
                        email=spec["admin_email"],
                        password_hash=hash_password(spec["admin_password"]),
                        full_name=f"{spec['name']} Admin",
                        phone="+994000000000",
                        role=UserRole.ADMIN,
                        restaurant_id=restaurant.id,
                    )
                )
                print(f"Seeded admin for {spec['name']}: {spec['admin_email']} / {spec['admin_password']}")

        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())

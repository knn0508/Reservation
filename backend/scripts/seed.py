"""Seeds two restaurants, their dining tables, and one admin + one courier account each.
Run: python -m scripts.seed"""
import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.security import hash_password
from app.models.delivery import Courier
from app.models.dining_table import DiningTable
from app.models.enums import TableCategory, UserRole
from app.models.restaurant import Restaurant
from app.models.user import User

RESTAURANTS = [
    {
        "slug": "mamajan-georgian-cuisine",
        "name": "Mamajan Georgian Cuisine",
        "admin_email": "admin@mamajan-georgian-cuisine-demo.com",
        "admin_password": "admin12345",
        "courier_email": "courier@mamajan-georgian-cuisine-demo.com",
        "courier_password": "courier12345",
        "courier_name": "Elvin Mammadov",
        "courier_plate": "10-AA-123",
    },
    {
        "slug": "nar-bagi",
        "name": "Nar Bağı",
        "admin_email": "admin@narbagi-demo.com",
        "admin_password": "admin12345",
        "courier_email": "courier@narbagi-demo.com",
        "courier_password": "courier12345",
        "courier_name": "Rashad Aliyev",
        "courier_plate": "90-BB-456",
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

            existing_table = await session.scalar(
                select(DiningTable).where(DiningTable.restaurant_id == restaurant.id).limit(1)
            )
            if existing_table is None:
                for i in range(1, settings.tables_2_seater_count + 1):
                    session.add(
                        DiningTable(
                            restaurant_id=restaurant.id,
                            table_number=f"T2-{i}",
                            category=TableCategory.SEATER_2,
                            zone="main",
                        )
                    )
                for i in range(1, settings.tables_4_seater_count + 1):
                    session.add(
                        DiningTable(
                            restaurant_id=restaurant.id,
                            table_number=f"T4-{i}",
                            category=TableCategory.SEATER_4,
                            zone="main",
                        )
                    )
                print(f"Seeded tables for: {spec['name']}")

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

            courier_user = await session.scalar(select(User).where(User.email == spec["courier_email"]))
            if courier_user is None:
                courier_user = User(
                    email=spec["courier_email"],
                    password_hash=hash_password(spec["courier_password"]),
                    full_name=spec["courier_name"],
                    phone="+994500000000",
                    role=UserRole.COURIER,
                    restaurant_id=restaurant.id,
                )
                session.add(courier_user)
                await session.flush()
                session.add(
                    Courier(
                        user_id=courier_user.id,
                        restaurant_id=restaurant.id,
                        vehicle_type="motorbike",
                        plate_number=spec["courier_plate"],
                    )
                )
                print(
                    f"Seeded courier for {spec['name']}: "
                    f"{spec['courier_email']} / {spec['courier_password']}"
                )

        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())

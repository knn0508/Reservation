"""Seeds synthetic sales history (SaleRecord + TableVisit) for the admin dashboard.

There's no POS yet, so this stands in for what a POS would eventually report for
in-person ("restaurant") sales, alongside a plausible history of online pre-orders. It's
generated from the restaurant's real (seeded) menu so product/category names in the
dashboard match what customers actually see. Deterministic (fixed RNG seed) so re-running
against an already-seeded restaurant is a safe no-op.

Run: python -m scripts.seed_sales
"""
import asyncio
import random
import sys
from datetime import datetime, timedelta

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.models.enums import SaleChannel
from app.models.menu import Product
from app.models.restaurant import Restaurant
from app.models.sales import SaleRecord, TableVisit
from app.services.time_utils import RESTAURANT_TZ

DAYS_BACK = 420  # ~14 months of history
SEED = 20260823

# weight, party_size
PARTY_SIZE_WEIGHTS = [(20, 1), (30, 2), (18, 3), (15, 4), (8, 5), (5, 6), (3, 7), (1, 8)]


def _tables_needed(party_size: int) -> int:
    return 1 if party_size <= 2 else -(-party_size // 4)


async def seed_sales_for(session, restaurant: Restaurant, rng: random.Random) -> None:
    products = list((await session.scalars(select(Product).where(Product.restaurant_id == restaurant.id))).all())
    if not products:
        print(f"Skipping {restaurant.name}: no products seeded yet")
        return

    sizes = [s for _, s in PARTY_SIZE_WEIGHTS]
    size_weights = [w for w, _ in PARTY_SIZE_WEIGHTS]

    today_local = datetime.now(RESTAURANT_TZ).date()
    start_day = today_local - timedelta(days=DAYS_BACK)

    day = start_day
    while day <= today_local:
        is_weekend = day.weekday() in (4, 5)  # Friday, Saturday
        base_online = rng.randint(4, 9)
        base_restaurant = rng.randint(8, 16)
        online_visits = round(base_online * (1.4 if is_weekend else 1.0))
        restaurant_visits = round(base_restaurant * (1.5 if is_weekend else 1.0))

        for channel, visit_count in (
            (SaleChannel.ONLINE, online_visits),
            (SaleChannel.RESTAURANT, restaurant_visits),
        ):
            for _ in range(visit_count):
                party_size = rng.choices(sizes, weights=size_weights, k=1)[0]
                hour = rng.randint(12, 22)
                minute = rng.choice([0, 15, 30, 45])
                occurred_local = RESTAURANT_TZ.localize(
                    datetime(day.year, day.month, day.day, hour, minute)
                )

                session.add(
                    TableVisit(
                        restaurant_id=restaurant.id,
                        channel=channel,
                        table_count=_tables_needed(party_size),
                        party_size=party_size,
                        occurred_at=occurred_local,
                    )
                )

                item_count = rng.randint(1, min(4, max(1, party_size - 1) + 1))
                chosen = rng.sample(products, k=min(item_count, len(products)))
                for product in chosen:
                    session.add(
                        SaleRecord(
                            restaurant_id=restaurant.id,
                            product_id=product.id,
                            channel=channel,
                            quantity=rng.randint(1, 3),
                            unit_price=product.price,
                            occurred_at=occurred_local,
                        )
                    )

        day += timedelta(days=1)

    await session.commit()
    print(f"Seeded synthetic sales history for: {restaurant.name}")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        restaurants = list((await session.scalars(select(Restaurant))).all())
        for restaurant in restaurants:
            existing = await session.scalar(
                select(SaleRecord.id).where(SaleRecord.restaurant_id == restaurant.id).limit(1)
            )
            if existing is not None:
                print(f"Skipping {restaurant.name}: sales history already seeded")
                continue
            rng = random.Random(f"{SEED}:{restaurant.slug}")
            await seed_sales_for(session, restaurant, rng)


if __name__ == "__main__":
    asyncio.run(main())

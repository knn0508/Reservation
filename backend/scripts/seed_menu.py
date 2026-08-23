"""Seeds Category/Product rows for a restaurant from a menu JSON file (see
data_mamajan_menu.json, parsed once from the frontend's static mamajanMenu.ts so the two
stay in sync at seed time). Run: python -m scripts.seed_menu
"""
import asyncio
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.models.enums import MenuGroup
from app.models.menu import Category, Product
from app.models.restaurant import Restaurant

DATA_DIR = Path(__file__).parent
MENU_FILES = {
    "mamajan-georgian-cuisine": DATA_DIR / "data_mamajan_menu.json",
}


async def seed_menu_for(session, restaurant: Restaurant, menu_path: Path) -> None:
    categories = json.loads(menu_path.read_text(encoding="utf-8"))

    for order, cat_spec in enumerate(categories):
        category = await session.scalar(
            select(Category).where(Category.restaurant_id == restaurant.id, Category.name == cat_spec["name"])
        )
        if category is None:
            category = Category(
                restaurant_id=restaurant.id,
                name=cat_spec["name"],
                group=MenuGroup(cat_spec["group"]),
                sort_order=order,
            )
            session.add(category)
            await session.flush()
            print(f"  Seeded category: {cat_spec['name']}")

        for item_order, item in enumerate(cat_spec["items"]):
            existing = await session.scalar(
                select(Product).where(Product.restaurant_id == restaurant.id, Product.name == item["name"])
            )
            if existing is None:
                session.add(
                    Product(
                        restaurant_id=restaurant.id,
                        category_id=category.id,
                        name=item["name"],
                        price=item["price"],
                        sort_order=item_order,
                    )
                )

    await session.commit()


async def main() -> None:
    async with AsyncSessionLocal() as session:
        for slug, menu_path in MENU_FILES.items():
            if not menu_path.exists():
                print(f"Skipping {slug}: {menu_path} not found")
                continue
            restaurant = await session.scalar(select(Restaurant).where(Restaurant.slug == slug))
            if restaurant is None:
                print(f"Skipping {slug}: restaurant not seeded yet")
                continue
            print(f"Seeding menu for: {restaurant.name}")
            await seed_menu_for(session, restaurant, menu_path)


if __name__ == "__main__":
    asyncio.run(main())

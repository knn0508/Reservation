from collections import defaultdict
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SaleChannel
from app.models.menu import Category, Product
from app.models.sales import SaleRecord, TableVisit
from app.services.time_utils import RESTAURANT_TZ

RangeKey = Literal["this_month", "last_2_months", "this_year"]


class InvalidRangeError(Exception):
    pass


def resolve_range(range_key: str) -> tuple[datetime, datetime, str]:
    now_local = datetime.now(RESTAURANT_TZ)
    end = now_local

    if range_key == "this_month":
        start = RESTAURANT_TZ.localize(datetime(now_local.year, now_local.month, 1))
        granularity = "day"
    elif range_key == "last_2_months":
        year, month = now_local.year, now_local.month - 1
        if month == 0:
            month, year = 12, year - 1
        start = RESTAURANT_TZ.localize(datetime(year, month, 1))
        granularity = "day"
    elif range_key == "this_year":
        start = RESTAURANT_TZ.localize(datetime(now_local.year, 1, 1))
        granularity = "month"
    else:
        raise InvalidRangeError(f"Unknown range: {range_key}")

    return start, end, granularity


def _period_key(dt: datetime, granularity: str) -> str:
    local = dt.astimezone(RESTAURANT_TZ)
    return local.strftime("%Y-%m-%d") if granularity == "day" else local.strftime("%Y-%m")


def _period_sequence(start: datetime, end: datetime, granularity: str) -> list[str]:
    periods = []
    if granularity == "day":
        cursor = start.date()
        end_date = end.date()
        while cursor <= end_date:
            periods.append(cursor.strftime("%Y-%m-%d"))
            cursor += timedelta(days=1)
    else:
        year, month = start.year, start.month
        while (year, month) <= (end.year, end.month):
            periods.append(f"{year:04d}-{month:02d}")
            month += 1
            if month == 13:
                month, year = 1, year + 1
    return periods


async def get_sales_series(session: AsyncSession, restaurant_id: int, range_key: str) -> dict:
    start, end, granularity = resolve_range(range_key)

    rows = (
        await session.execute(
            select(SaleRecord.channel, SaleRecord.quantity, SaleRecord.unit_price, SaleRecord.occurred_at).where(
                SaleRecord.restaurant_id == restaurant_id,
                SaleRecord.occurred_at >= start,
                SaleRecord.occurred_at <= end,
            )
        )
    ).all()

    online_by_period: dict[str, float] = defaultdict(float)
    restaurant_by_period: dict[str, float] = defaultdict(float)
    for channel, quantity, unit_price, occurred_at in rows:
        key = _period_key(occurred_at, granularity)
        amount = float(quantity) * float(unit_price)
        if channel == SaleChannel.ONLINE:
            online_by_period[key] += amount
        else:
            restaurant_by_period[key] += amount

    points = []
    total_online = total_restaurant = 0.0
    for period in _period_sequence(start, end, granularity):
        online = round(online_by_period.get(period, 0.0), 2)
        restaurant = round(restaurant_by_period.get(period, 0.0), 2)
        total_online += online
        total_restaurant += restaurant
        points.append({"period": period, "online": online, "restaurant": restaurant, "total": round(online + restaurant, 2)})

    return {
        "granularity": granularity,
        "points": points,
        "totals": {
            "online": round(total_online, 2),
            "restaurant": round(total_restaurant, 2),
            "total": round(total_online + total_restaurant, 2),
        },
    }


async def get_clients_series(session: AsyncSession, restaurant_id: int, range_key: str) -> dict:
    start, end, granularity = resolve_range(range_key)

    rows = (
        await session.execute(
            select(TableVisit.channel, TableVisit.table_count, TableVisit.occurred_at).where(
                TableVisit.restaurant_id == restaurant_id,
                TableVisit.occurred_at >= start,
                TableVisit.occurred_at <= end,
            )
        )
    ).all()

    from_app_by_period: dict[str, int] = defaultdict(int)
    total_by_period: dict[str, int] = defaultdict(int)
    for channel, table_count, occurred_at in rows:
        key = _period_key(occurred_at, granularity)
        total_by_period[key] += table_count
        if channel == SaleChannel.ONLINE:
            from_app_by_period[key] += table_count

    points = []
    total_from_app = total_all = 0
    for period in _period_sequence(start, end, granularity):
        from_app = from_app_by_period.get(period, 0)
        total = total_by_period.get(period, 0)
        total_from_app += from_app
        total_all += total
        points.append({"period": period, "from_app": from_app, "total": total})

    return {
        "granularity": granularity,
        "points": points,
        "totals": {"from_app": total_from_app, "total": total_all},
    }


async def get_category_shares(session: AsyncSession, restaurant_id: int, range_key: str) -> list[dict]:
    start, end, _ = resolve_range(range_key)

    rows = (
        await session.execute(
            select(Category.id, Category.name, SaleRecord.quantity, SaleRecord.unit_price)
            .join(Product, Product.id == SaleRecord.product_id)
            .join(Category, Category.id == Product.category_id)
            .where(
                SaleRecord.restaurant_id == restaurant_id,
                SaleRecord.occurred_at >= start,
                SaleRecord.occurred_at <= end,
            )
        )
    ).all()

    revenue_by_category: dict[tuple[int, str], float] = defaultdict(float)
    for category_id, name, quantity, unit_price in rows:
        revenue_by_category[(category_id, name)] += float(quantity) * float(unit_price)

    grand_total = sum(revenue_by_category.values())
    shares = [
        {
            "category_id": category_id,
            "name": name,
            "revenue": round(revenue, 2),
            "percent": round(revenue / grand_total * 100, 1) if grand_total else 0.0,
        }
        for (category_id, name), revenue in revenue_by_category.items()
    ]
    shares.sort(key=lambda s: s["revenue"], reverse=True)
    return shares


async def get_category_products(
    session: AsyncSession, restaurant_id: int, range_key: str, category_id: int
) -> dict:
    start, end, _ = resolve_range(range_key)

    category = await session.get(Category, category_id)
    if category is None or category.restaurant_id != restaurant_id:
        return {"category_id": category_id, "name": "", "revenue": 0.0, "products": []}

    rows = (
        await session.execute(
            select(Product.id, Product.name, SaleRecord.quantity, SaleRecord.unit_price)
            .join(SaleRecord, SaleRecord.product_id == Product.id)
            .where(
                Product.category_id == category_id,
                SaleRecord.restaurant_id == restaurant_id,
                SaleRecord.occurred_at >= start,
                SaleRecord.occurred_at <= end,
            )
        )
    ).all()

    revenue_by_product: dict[tuple[int, str], float] = defaultdict(float)
    for product_id, name, quantity, unit_price in rows:
        revenue_by_product[(product_id, name)] += float(quantity) * float(unit_price)

    category_total = sum(revenue_by_product.values())
    products = [
        {
            "product_id": product_id,
            "name": name,
            "revenue": round(revenue, 2),
            "percent": round(revenue / category_total * 100, 1) if category_total else 0.0,
        }
        for (product_id, name), revenue in revenue_by_product.items()
    ]
    products.sort(key=lambda p: p["revenue"], reverse=True)

    return {
        "category_id": category_id,
        "name": category.name,
        "revenue": round(category_total, 2),
        "products": products,
    }

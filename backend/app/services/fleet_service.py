"""Owner-dashboard queries: the live fleet, the dispatch board and delivery analytics.

Every query is scoped by the `restaurant_id` of the authenticated admin. That filter is
applied here, never assembled from anything the client sent - the dashboard is the one screen
where a missing tenant filter would show one restaurant another's couriers and customers.

Transitions are not implemented here: `assign_order` lives in delivery_service with the rest
of the state machine so there is exactly one place an order's status can change.
"""

import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import Numeric, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.delivery import Courier, DeliveryOrder
from app.models.enums import DeliveryStatus
from app.models.user import User
from app.services import tracking_service

ACTIVE_STATUSES = (DeliveryStatus.PLACED, DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP)


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def order_row(order: DeliveryOrder, courier_name: str | None) -> dict:
    """Shapes one order for the board. Public because the assign route returns a single
    order and must not invent a second shape for it."""
    return {
        "id": order.id,
        "public_code": order.public_code,
        "status": order.status,
        "recipient_name": order.recipient_name,
        "recipient_phone": order.recipient_phone,
        "address_text": order.address_text,
        "lat": order.lat,
        "lng": order.lng,
        "total": float(order.total),
        "courier_id": order.courier_id,
        "courier_name": courier_name,
        "placed_at": order.placed_at,
        "accepted_at": order.accepted_at,
        "picked_up_at": order.picked_up_at,
        "delivered_at": order.delivered_at,
    }


async def list_board_orders(
    session: AsyncSession, restaurant_id: int, *, include_finished: bool = False
) -> list[dict]:
    """The dispatch board.

    Active orders come oldest-first because that is the order a dispatcher works them in -
    the one that has been waiting longest is the one about to become a complaint. History,
    when asked for, reads newest-first like every other log.
    """
    stmt = (
        select(DeliveryOrder, User.full_name)
        .outerjoin(User, User.id == DeliveryOrder.courier_id)
        .where(DeliveryOrder.restaurant_id == restaurant_id)
    )
    if include_finished:
        stmt = stmt.order_by(DeliveryOrder.placed_at.desc()).limit(100)
    else:
        stmt = stmt.where(DeliveryOrder.status.in_(ACTIVE_STATUSES)).order_by(
            DeliveryOrder.placed_at
        )
    rows = (await session.execute(stmt)).all()
    return [order_row(order, name) for order, name in rows]


async def list_couriers(session: AsyncSession, restaurant_id: int) -> list[dict]:
    """The roster, with whatever live position Redis still holds for each courier."""
    rows = (
        await session.execute(
            select(Courier, User.full_name)
            .join(User, User.id == Courier.user_id)
            .where(Courier.restaurant_id == restaurant_id)
            .order_by(User.full_name)
        )
    ).all()

    load_rows = (
        await session.execute(
            select(DeliveryOrder.courier_id, func.count())
            .where(
                DeliveryOrder.restaurant_id == restaurant_id,
                DeliveryOrder.courier_id.is_not(None),
                DeliveryOrder.status.in_(
                    (DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP)
                ),
            )
            .group_by(DeliveryOrder.courier_id)
        )
    ).all()
    loads = {courier_id: count for courier_id, count in load_rows}

    now = time.time()
    out = []
    for courier, full_name in rows:
        pos = await tracking_service.get_position(courier.user_id)
        recorded = pos.get("t") if pos else None
        out.append(
            {
                "id": courier.user_id,
                "full_name": full_name,
                "vehicle_type": courier.vehicle_type,
                "plate_number": courier.plate_number,
                "is_on_shift": courier.is_on_shift,
                "active_load": loads.get(courier.user_id, 0),
                "lat": pos["lat"] if pos else None,
                "lng": pos["lng"] if pos else None,
                "heading": pos.get("h") if pos else None,
                "speed_mps": pos.get("s") if pos else None,
                "age_s": max(0, int(now - recorded)) if recorded else None,
            }
        )
    return out


async def origin_cells(session: AsyncSession, restaurant_id: int, days: int) -> list[dict]:
    """Where delivered orders actually went, snapped to a grid.

    Aggregated in SQL rather than sending raw drop points to the browser - a busy month is
    thousands of coordinates and the map only ever draws the grid. Rounding to 3 decimals is
    roughly a 100 m cell at this latitude.

    The build guide reaches for a materialized view refreshed every 15 minutes. At pilot
    volume this GROUP BY runs in milliseconds; promote it to a matview when it stops doing so,
    and remember the unique index that `REFRESH ... CONCURRENTLY` requires.
    """
    lat_cell = func.round(cast(DeliveryOrder.lat, Numeric), 3).label("lat_cell")
    lng_cell = func.round(cast(DeliveryOrder.lng, Numeric), 3).label("lng_cell")
    rows = (
        await session.execute(
            select(
                lat_cell,
                lng_cell,
                func.count().label("orders"),
                func.coalesce(func.sum(DeliveryOrder.total), 0).label("revenue"),
            )
            .where(
                DeliveryOrder.restaurant_id == restaurant_id,
                DeliveryOrder.status == DeliveryStatus.DELIVERED,
                DeliveryOrder.placed_at >= _since(days),
            )
            .group_by(lat_cell, lng_cell)
            .order_by(func.count().desc())
            .limit(500)
        )
    ).all()
    return [
        {"lat": float(lat), "lng": float(lng), "orders": int(orders), "revenue": float(revenue)}
        for lat, lng, orders, revenue in rows
    ]


async def courier_kpis(session: AsyncSession, restaurant_id: int, days: int) -> list[dict]:
    """Per-courier performance over a window.

    The three averages split a delivery into the parts someone can actually act on: total is
    what the customer felt, pickup is how long the kitchen and courier took to hand over, and
    road is the drive. A bad total with a fine road time is a kitchen problem, not a courier
    problem, and the dashboard should not let those be confused.
    """
    delivered = DeliveryOrder.status == DeliveryStatus.DELIVERED
    minutes = lambda a, b: func.avg(  # noqa: E731
        func.extract("epoch", a - b) / 60.0
    ).filter(delivered)

    rows = (
        await session.execute(
            select(
                Courier.user_id,
                User.full_name,
                func.count(DeliveryOrder.id).filter(delivered).label("deliveries"),
                func.coalesce(func.sum(DeliveryOrder.total).filter(delivered), 0).label("revenue"),
                minutes(DeliveryOrder.delivered_at, DeliveryOrder.placed_at),
                minutes(DeliveryOrder.delivered_at, DeliveryOrder.picked_up_at),
                minutes(DeliveryOrder.picked_up_at, DeliveryOrder.accepted_at),
            )
            .select_from(Courier)
            .join(User, User.id == Courier.user_id)
            .outerjoin(
                DeliveryOrder,
                and_(
                    DeliveryOrder.courier_id == Courier.user_id,
                    DeliveryOrder.placed_at >= _since(days),
                ),
            )
            .where(Courier.restaurant_id == restaurant_id)
            .group_by(Courier.user_id, User.full_name)
            .order_by(func.count(DeliveryOrder.id).filter(delivered).desc())
        )
    ).all()

    return [
        {
            "courier_id": user_id,
            "full_name": full_name,
            "deliveries": int(deliveries or 0),
            "revenue": float(revenue or 0),
            "avg_total_minutes": float(total) if total is not None else None,
            "avg_road_minutes": float(road) if road is not None else None,
            "avg_pickup_minutes": float(pickup) if pickup is not None else None,
        }
        for user_id, full_name, deliveries, revenue, total, road, pickup in rows
    ]


async def summary(session: AsyncSession, restaurant_id: int) -> dict:
    """The headline numbers. "Today" is the last 24 hours, not a calendar day."""
    since = _since(1)
    couriers = (
        await session.execute(
            select(Courier).where(Courier.restaurant_id == restaurant_id)
        )
    ).scalars().all()

    live = 0
    for courier in couriers:
        if await tracking_service.get_position(courier.user_id) is not None:
            live += 1

    active = (
        await session.execute(
            select(
                func.count(),
                func.count().filter(DeliveryOrder.courier_id.is_(None)),
            ).where(
                DeliveryOrder.restaurant_id == restaurant_id,
                DeliveryOrder.status.in_(ACTIVE_STATUSES),
            )
        )
    ).one()

    done = (
        await session.execute(
            select(func.count(), func.coalesce(func.sum(DeliveryOrder.total), 0)).where(
                DeliveryOrder.restaurant_id == restaurant_id,
                DeliveryOrder.status == DeliveryStatus.DELIVERED,
                DeliveryOrder.delivered_at >= since,
            )
        )
    ).one()

    return {
        "couriers_on_shift": sum(1 for c in couriers if c.is_on_shift),
        "couriers_live": live,
        "active_orders": int(active[0]),
        "unassigned_orders": int(active[1]),
        "delivered_today": int(done[0]),
        "revenue_today": float(done[1]),
    }

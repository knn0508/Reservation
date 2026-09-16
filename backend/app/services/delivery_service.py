"""Online delivery ("onlayn catdirilma") orders and the courier hand-off.

Everything that moves an order between statuses lives here so the state machine has exactly
one implementation. Routes stay thin: they authorise, then call one of these.
"""

import secrets
import string
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.delivery import Courier, DeliveryOrder, DeliveryOrderItem
from app.models.enums import DeliveryStatus
from app.models.restaurant import Restaurant
from app.models.tracking import DeliveryOrderEvent
from app.models.user import User
from app.services import tracking_service

_CODE_ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ23456789"  # no O/0/I/1 - these get read out by phone


class DeliveryError(Exception):
    """Business-rule failure; routes map this to a 4xx."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_public_code() -> str:
    return "ITB-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


def _money(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def delivery_fee_for(subtotal: Decimal) -> Decimal:
    """Flat fee, waived above a threshold. A zone-based fee replaces this once
    delivery_zones exists."""
    if subtotal >= _money(settings.delivery_free_over):
        return Decimal("0.00")
    return _money(settings.delivery_fee)


async def create_order(
    session: AsyncSession,
    *,
    customer: User,
    restaurant_id: int,
    recipient_name: str,
    recipient_phone: str,
    lat: float,
    lng: float,
    address_text: str,
    building: str | None,
    entrance: str | None,
    floor: str | None,
    apartment: str | None,
    courier_note: str | None,
    payment_method: str,
    items: list[dict],
) -> DeliveryOrder:
    restaurant = await session.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise DeliveryError("Restaurant not found")

    subtotal = sum((_money(i["unit_price"]) * i["quantity"] for i in items), Decimal("0.00"))
    fee = delivery_fee_for(subtotal)

    order = DeliveryOrder(
        public_code=_new_public_code(),
        restaurant_id=restaurant_id,
        customer_id=customer.id,
        status=DeliveryStatus.PLACED,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        lat=lat,
        lng=lng,
        address_text=address_text,
        building=building,
        entrance=entrance,
        floor=floor,
        apartment=apartment,
        courier_note=courier_note,
        subtotal=subtotal,
        delivery_fee=fee,
        total=subtotal + fee,
        payment_method=payment_method,
        items=[
            DeliveryOrderItem(
                name_snapshot=i["name"],
                unit_price=_money(i["unit_price"]),
                quantity=i["quantity"],
            )
            for i in items
        ],
    )
    session.add(order)
    # Flushed before the event so the server-generated order id exists to reference.
    await session.flush()
    _record_event(
        session,
        order,
        from_status=None,
        to_status=DeliveryStatus.PLACED,
        actor_id=customer.id,
        payload={"total": str(order.total), "items": len(items)},
    )
    await session.commit()
    await session.refresh(order)
    return order


async def get_order(session: AsyncSession, order_id: UUID) -> DeliveryOrder | None:
    return await session.scalar(select(DeliveryOrder).where(DeliveryOrder.id == order_id))


async def list_customer_orders(session: AsyncSession, customer_id: int) -> list[DeliveryOrder]:
    result = await session.scalars(
        select(DeliveryOrder)
        .where(DeliveryOrder.customer_id == customer_id)
        .order_by(DeliveryOrder.placed_at.desc())
        .limit(50)
    )
    return list(result)


async def list_open_orders(session: AsyncSession, restaurant_id: int) -> list[DeliveryOrder]:
    """Unclaimed orders for the courier board - anyone on shift can take these."""
    result = await session.scalars(
        select(DeliveryOrder)
        .where(
            DeliveryOrder.restaurant_id == restaurant_id,
            DeliveryOrder.status == DeliveryStatus.PLACED,
            DeliveryOrder.courier_id.is_(None),
        )
        .order_by(DeliveryOrder.placed_at)
    )
    return list(result)


async def list_courier_orders(session: AsyncSession, courier_id: int) -> list[DeliveryOrder]:
    """The courier's own runs: active first, then today's completed ones."""
    result = await session.scalars(
        select(DeliveryOrder)
        .where(DeliveryOrder.courier_id == courier_id)
        .order_by(DeliveryOrder.placed_at.desc())
        .limit(40)
    )
    return list(result)


async def accept_order(session: AsyncSession, order: DeliveryOrder, courier: Courier) -> DeliveryOrder:
    """Claim an unassigned order.

    Written as a conditional UPDATE rather than read-then-write: two couriers tapping
    "Accept" on the same card within the same second is the realistic race here, and the
    WHERE clause settles it in the database instead of in application code.
    """
    if order.restaurant_id != courier.restaurant_id:
        raise DeliveryError("Order belongs to another restaurant")

    result = await session.execute(
        update(DeliveryOrder)
        .where(
            DeliveryOrder.id == order.id,
            DeliveryOrder.status == DeliveryStatus.PLACED,
            DeliveryOrder.courier_id.is_(None),
        )
        .values(
            courier_id=courier.user_id,
            status=DeliveryStatus.ACCEPTED,
            accepted_at=_now(),
        )
    )
    if result.rowcount == 0:
        await session.rollback()
        raise DeliveryError("Another courier already took this order")
    _record_event(
        session,
        order,
        from_status=DeliveryStatus.PLACED,
        to_status=DeliveryStatus.ACCEPTED,
        actor_id=courier.user_id,
    )
    await session.commit()
    await session.refresh(order)
    await _announce(order)
    return order


async def mark_picked_up(session: AsyncSession, order: DeliveryOrder, courier_id: int) -> DeliveryOrder:
    _require_assigned(order, courier_id)
    if order.status != DeliveryStatus.ACCEPTED:
        raise DeliveryError("Order must be accepted before pickup")
    order.status = DeliveryStatus.PICKED_UP
    order.picked_up_at = _now()
    _record_event(
        session,
        order,
        from_status=DeliveryStatus.ACCEPTED,
        to_status=DeliveryStatus.PICKED_UP,
        actor_id=courier_id,
    )
    await session.commit()
    await session.refresh(order)
    await _announce(order)
    return order


async def mark_delivered(session: AsyncSession, order: DeliveryOrder, courier_id: int) -> DeliveryOrder:
    _require_assigned(order, courier_id)
    if order.status != DeliveryStatus.PICKED_UP:
        raise DeliveryError("Order must be picked up before it can be delivered")
    order.status = DeliveryStatus.DELIVERED
    order.delivered_at = _now()
    _record_event(
        session,
        order,
        from_status=DeliveryStatus.PICKED_UP,
        to_status=DeliveryStatus.DELIVERED,
        actor_id=courier_id,
    )
    await session.commit()
    await session.refresh(order)
    # Also revokes tracking: the socket route refuses to open a room for a delivered order.
    await _announce(order)
    return order


async def cancel_order(session: AsyncSession, order: DeliveryOrder) -> DeliveryOrder:
    """Customer-initiated cancel. Allowed until the courier has the food in hand - after
    pickup the kitchen has already spent the ingredients and the courier the trip."""
    if order.status in (DeliveryStatus.PICKED_UP, DeliveryStatus.DELIVERED):
        raise DeliveryError("This order is already on the way and can no longer be cancelled")
    if order.status == DeliveryStatus.CANCELLED:
        return order
    previous = order.status
    order.status = DeliveryStatus.CANCELLED
    order.cancelled_at = _now()
    order.courier_id = None
    _record_event(
        session,
        order,
        from_status=previous,
        to_status=DeliveryStatus.CANCELLED,
        actor_id=order.customer_id,
        payload={"source": "customer"},
    )
    await session.commit()
    await session.refresh(order)
    await _announce(order)
    return order


async def assign_order(
    session: AsyncSession, order: DeliveryOrder, courier: Courier, actor_id: int
) -> DeliveryOrder:
    """Dispatcher override: hand an order to a specific courier.

    The guide's dispatch loop is automatic, but it always keeps a manual path - after three
    failed offer rounds, or when the owner simply knows something the scoring does not. This
    is that path, so unlike `accept_order` it does not require the order to be unclaimed: a
    reassignment away from a courier who went silent is exactly when it gets used.
    """
    if order.restaurant_id != courier.restaurant_id:
        raise DeliveryError("That courier belongs to another restaurant")
    if order.status in (DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED):
        raise DeliveryError("This order is already finished")
    if order.courier_id == courier.user_id:
        return order

    previous = order.status
    order.courier_id = courier.user_id
    # A reassignment mid-run sends the new courier to the restaurant, so the order goes back
    # to `accepted` rather than keeping a `picked_up` that describes somebody else's hands.
    order.status = DeliveryStatus.ACCEPTED
    order.accepted_at = _now()
    order.picked_up_at = None
    _record_event(
        session,
        order,
        from_status=previous,
        to_status=DeliveryStatus.ACCEPTED,
        actor_id=actor_id,
        payload={"source": "manual_assign", "courier_id": courier.user_id},
    )
    await session.commit()
    await session.refresh(order)
    await _announce(order)
    return order


async def set_shift(session: AsyncSession, courier: Courier, is_on_shift: bool) -> Courier:
    courier.is_on_shift = is_on_shift
    courier.last_seen_at = _now()
    await session.commit()
    await session.refresh(courier)
    return courier


def _require_assigned(order: DeliveryOrder, courier_id: int) -> None:
    if order.courier_id != courier_id:
        raise DeliveryError("This order is assigned to another courier")


def _record_event(
    session: AsyncSession,
    order: DeliveryOrder,
    *,
    from_status: DeliveryStatus | None,
    to_status: DeliveryStatus,
    actor_id: int | None = None,
    payload: dict | None = None,
) -> None:
    """Append one row to the order's history.

    Added to the session rather than committed here, so the event lands in the same
    transaction as the status change it describes. An event without its transition (or the
    reverse) would make the timeline lie.
    """
    session.add(
        DeliveryOrderEvent(
            order_id=order.id,
            actor_id=actor_id,
            from_status=from_status.value if from_status else None,
            to_status=to_status.value,
            payload=payload or {},
        )
    )


async def _announce(order: DeliveryOrder) -> None:
    """Tell everyone watching this order that its status moved.

    Called **after** commit, never before: emitting inside the transaction would occasionally
    show a customer a status that then rolled back.
    """
    await tracking_service.publish(
        order.id,
        "order:status",
        {"order_id": str(order.id), "status": order.status.value},
    )

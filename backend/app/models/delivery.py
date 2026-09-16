import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.enums import DeliveryStatus


class Courier(Base):
    """Courier-specific profile. Kept out of `user` so the couriers of one restaurant can
    carry vehicle/availability state without widening the shared identity table."""

    __tablename__ = "courier"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
    )
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurant.id"), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(30), default="motorbike", nullable=False)
    plate_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_on_shift: Mapped[bool] = mapped_column(default=False, nullable=False)
    # Last position reported by the courier app; null until the first ping.
    last_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DeliveryOrder(Base):
    """One online delivery order: what the customer bought, where it goes, who carries it.

    The address is stored denormalised (not a join to a saved-address table) on purpose -
    editing a saved address later must never rewrite the drop point of a past delivery.

    Coordinates are plain lat/lng columns rather than PostGIS geography: the pilot only needs
    a pin to hand to Google Maps, and adding the PostGIS extension would be a hard dependency
    on every dev database. Swap in GEOGRAPHY(POINT,4326) when proximity dispatch lands.
    """

    __tablename__ = "delivery_order"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    # Short human code the customer and the courier read out loud over the phone.
    public_code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurant.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)
    courier_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courier.user_id"), nullable=True
    )
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(
            DeliveryStatus,
            name="delivery_status_enum",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=DeliveryStatus.PLACED,
        nullable=False,
    )

    # --- who receives it (snapshot; may differ from the account holder) ---
    recipient_name: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(50), nullable=False)

    # --- where it goes ---
    # Pin-drop is the primary input; free text is the human-readable backup. Azerbaijani
    # street addresses geocode badly, so the courier navigates by the pin, not the text.
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    address_text: Mapped[str] = mapped_column(String(300), nullable=False)
    building: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entrance: Mapped[str | None] = mapped_column(String(50), nullable=True)
    floor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    apartment: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Free-text note the courier sees on their board ("kod 1234", "zeng etme", ...).
    courier_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- money ---
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), default="cash", nullable=False)

    # --- timeline ---
    placed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["DeliveryOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class DeliveryOrderItem(Base):
    """Line item. Name and price are copied from the menu at order time so a later menu
    edit cannot change what a delivered order says it was."""

    __tablename__ = "delivery_order_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("delivery_order.id", ondelete="CASCADE"), nullable=False
    )
    name_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped[DeliveryOrder] = relationship(back_populates="items")

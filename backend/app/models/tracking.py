import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base


class CourierLocation(Base):
    """Courier position history - the only high-volume table in the system.

    Written exclusively by the Celery flush task draining the Redis buffer, never on the
    ping request path (see services/tracking_service.py for why). Nothing in the live
    product reads it; it exists for route replay, distance reporting and dispute handling.

    `order_id` carries no foreign key on purpose: rows arrive in bulk from the flush task
    and an FK check per row would cost more than the column is worth. A deleted order
    leaving orphan telemetry behind is fine - retention sweeps it either way.

    The build guide partitions this table by month. A plain table plus a BRIN index on
    `recorded_at` behaves the same up to a few million rows; partition it when the pilot's
    volume justifies the operational overhead.
    """

    __tablename__ = "courier_location"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    courier_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courier.user_id", ondelete="CASCADE"), nullable=False
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_mps: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)


class DeliveryOrderEvent(Base):
    """Append-only status log for a delivery order.

    Mirrors ReservationEvent. Every transition writes one row inside the same transaction
    that moves the order, which is what makes "how long did this order sit before a courier
    took it" answerable later without storing that duration redundantly on the order.
    """

    __tablename__ = "delivery_order_event"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("delivery_order.id", ondelete="CASCADE"), nullable=False
    )
    # Null when the actor is the system rather than a person (auto-cancel, sweep, ...).
    actor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("user.id"), nullable=True
    )
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

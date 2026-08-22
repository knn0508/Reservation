import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ARRAY, CheckConstraint, DateTime, Enum, FetchedValue, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.enums import ReservationStatus, TableCategory


class Reservation(Base):
    __tablename__ = "reservation"
    __table_args__ = (
        CheckConstraint("party_size >= 1", name="chk_party_limit"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurant.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)
    guest_name: Mapped[str] = mapped_column(String(100), nullable=False)
    guest_email: Mapped[str] = mapped_column(String(100), nullable=False)
    guest_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    table_category: Mapped[TableCategory] = mapped_column(
        Enum(TableCategory, name="table_category_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus, name="reservation_status_enum", values_callable=lambda e: [m.value for m in e]),
        default=ReservationStatus.BOOKED,
        nullable=False,
    )
    # Set at booking time (auto-assigned, first free matching table) - never null.
    assigned_table_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dining_table.id"), nullable=False
    )
    # Extra 4-seater tables merged onto assigned_table_id for parties larger than one table's
    # capacity (e.g. party of 7 -> assigned_table_id + one merged table). Null/empty when the
    # party fit on a single table.
    merged_table_ids: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Set when the guest asks for their cart to be prepared and ready for their arrival time.
    # A future POS integration would read this to auto-create the kitchen order for the
    # assigned table (see booking_service.request_preorder).
    preorder_items: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    preorder_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # PostgreSQL system column, used as optimistic-concurrency version for admin edits
    xmin: Mapped[int | None] = mapped_column(
        Integer, system=True, nullable=True, server_default=FetchedValue()
    )

    __mapper_args__ = {"version_id_col": xmin, "version_id_generator": False}

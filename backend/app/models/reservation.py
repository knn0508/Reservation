import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, FetchedValue, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.enums import ReservationStatus, TableCategory


class Reservation(Base):
    __tablename__ = "reservation"
    __table_args__ = (
        CheckConstraint("party_size >= 1 AND party_size <= 4", name="chk_party_limit"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
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
    assigned_table_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("dining_table.id"), nullable=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # PostgreSQL system column, used as optimistic-concurrency version for admin edits
    xmin: Mapped[int | None] = mapped_column(
        Integer, system=True, nullable=True, server_default=FetchedValue()
    )

    __mapper_args__ = {"version_id_col": xmin, "version_id_generator": False}

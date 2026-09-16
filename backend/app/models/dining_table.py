from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import TableCategory, TableShape


class DiningTable(Base):
    __tablename__ = "dining_table"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "table_number", name="unique_restaurant_table_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurant.id"), nullable=False)
    table_number: Mapped[str] = mapped_column(String(10), nullable=False)
    category: Mapped[TableCategory] = mapped_column(
        Enum(TableCategory, name="table_category_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    zone: Mapped[str] = mapped_column(String(50), nullable=False)

    # --- floor plan placement ---
    # Null for a table that has been taken off the canvas but kept for reservation history.
    floor_plan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("floor_plan.id"), nullable=True, index=True
    )
    shape: Mapped[TableShape] = mapped_column(
        Enum(TableShape, name="table_shape_enum", values_callable=lambda e: [m.value for m in e]),
        default=TableShape.ROUND,
        nullable=False,
    )
    # Chairs are drawn around the table from `seats`, never stored individually. Booking still
    # keys off `category`, so `seats` is a drawing hint - keep the two consistent.
    seats: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    x_cm: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    y_cm: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    width_cm: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    height_cm: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    rotation: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

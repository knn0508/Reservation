from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.enums import FloorElementKind


class FloorPlan(Base):
    """One drawable room of a restaurant - "Main hall", "Terrace", "2nd floor". Tables and
    decor elements live on it; coordinates are centimetres from the plan's top-left corner,
    so the drawing stays resolution-independent and scales to any canvas size."""

    __tablename__ = "floor_plan"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "name", name="unique_restaurant_floor_plan_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurant.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    width_cm: Mapped[int] = mapped_column(Integer, default=1200, nullable=False)
    height_cm: Mapped[int] = mapped_column(Integer, default=800, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class FloorElement(Base):
    """A non-bookable item on the plan: walls, windows, the entrance, sofas, the bar, plants.
    Nothing references these, so the layout save replaces a plan's whole element set."""

    __tablename__ = "floor_element"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    floor_plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("floor_plan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[FloorElementKind] = mapped_column(
        SAEnum(
            FloorElementKind,
            name="floor_element_kind_enum",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    x_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    y_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    width_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    height_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    rotation: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    label: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Optional hex override; when null the frontend uses the kind's default colour.
    color: Mapped[str | None] = mapped_column(String(9), nullable=True)
    z_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import TableCategory


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

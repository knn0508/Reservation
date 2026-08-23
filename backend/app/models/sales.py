from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.enums import SaleChannel


class SaleRecord(Base):
    """One line item sold - either a real online pre-order (once wired up) or, for now,
    synthetic data standing in for what a POS will eventually report for in-person sales.
    Backs the admin sales dashboard (total/online/restaurant revenue, product/category mix).
    """

    __tablename__ = "sale_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurant.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("product.id"), nullable=False)
    channel: Mapped[SaleChannel] = mapped_column(
        SAEnum(SaleChannel, name="sale_channel_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TableVisit(Base):
    """One seated party, counted by tables occupied (not headcount) - backs the admin
    dashboard's client graphs. Synthetic for now, same reasoning as SaleRecord.
    """

    __tablename__ = "table_visit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurant.id"), nullable=False)
    channel: Mapped[SaleChannel] = mapped_column(
        SAEnum(SaleChannel, name="sale_channel_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    table_count: Mapped[int] = mapped_column(Integer, nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

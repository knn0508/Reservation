from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class InventoryBucket(Base):
    __tablename__ = "inventory_bucket"
    __table_args__ = (
        UniqueConstraint("bucket_time", name="unique_bucket_time"),
        CheckConstraint("tables_2_free >= 0", name="chk_tables_2_free"),
        CheckConstraint("tables_4_free >= 0", name="chk_tables_4_free"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    bucket_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tables_2_free: Mapped[int] = mapped_column(Integer, nullable=False)
    tables_4_free: Mapped[int] = mapped_column(Integer, nullable=False)
    arrivals_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

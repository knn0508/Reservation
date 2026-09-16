"""courier location telemetry and the delivery order event log

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "courier_location",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "courier_id",
            sa.Integer(),
            sa.ForeignKey("courier.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # No FK: rows are bulk-inserted by the flush task and a per-row check would cost
        # more than the reference is worth.
        sa.Column("order_id", UUID(as_uuid=True), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("accuracy_m", sa.Float(), nullable=True),
        sa.Column("speed_mps", sa.Float(), nullable=True),
        sa.Column("heading", sa.SmallInteger(), nullable=True),
    )

    # Route replay for one courier reads a time slice of their own rows.
    op.create_index(
        "idx_courier_location_courier_time",
        "courier_location",
        ["courier_id", sa.text("recorded_at DESC")],
    )
    # BRIN rather than btree on the time column: rows arrive in timestamp order, so the
    # index stays kilobytes where a btree over millions of rows would be hundreds of MB.
    op.execute(
        "CREATE INDEX idx_courier_location_time_brin ON courier_location "
        "USING BRIN (recorded_at)"
    )
    op.execute(
        "CREATE INDEX idx_courier_location_order ON courier_location (order_id) "
        "WHERE order_id IS NOT NULL"
    )

    op.create_table(
        "delivery_order_event",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("delivery_order.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=False),
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "idx_delivery_order_event_order", "delivery_order_event", ["order_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("idx_delivery_order_event_order", table_name="delivery_order_event")
    op.drop_table("delivery_order_event")
    op.execute("DROP INDEX IF EXISTS idx_courier_location_order")
    op.execute("DROP INDEX IF EXISTS idx_courier_location_time_brin")
    op.drop_index("idx_courier_location_courier_time", table_name="courier_location")
    op.drop_table("courier_location")

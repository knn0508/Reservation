"""add courier role, courier profiles and online delivery orders

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

_DELIVERY_STATUSES = ("placed", "accepted", "picked_up", "delivered", "cancelled")

# create_type=False: the type is created by the DO block below, same as 0004/0005.
_status_col = PGEnum(*_DELIVERY_STATUSES, name="delivery_status_enum", create_type=False)


def upgrade() -> None:
    # 'courier' joins the existing user_role_enum - couriers authenticate through the same
    # /api/auth/login as everyone else, they just land on a different board.
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'courier'")
    op.execute(
        "DO $$ BEGIN CREATE TYPE delivery_status_enum AS ENUM ("
        + ", ".join(f"'{s}'" for s in _DELIVERY_STATUSES)
        + "); EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )

    op.create_table(
        "courier",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant.id"), nullable=False),
        sa.Column("vehicle_type", sa.String(length=30), nullable=False, server_default="motorbike"),
        sa.Column("plate_number", sa.String(length=20), nullable=True),
        sa.Column("is_on_shift", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_lat", sa.Float(), nullable=True),
        sa.Column("last_lng", sa.Float(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "delivery_order",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("public_code", sa.String(length=12), nullable=False, unique=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant.id"), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("courier_id", sa.Integer(), sa.ForeignKey("courier.user_id"), nullable=True),
        sa.Column("status", _status_col, nullable=False, server_default="placed"),
        sa.Column("recipient_name", sa.String(length=100), nullable=False),
        sa.Column("recipient_phone", sa.String(length=50), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("address_text", sa.String(length=300), nullable=False),
        sa.Column("building", sa.String(length=50), nullable=True),
        sa.Column("entrance", sa.String(length=50), nullable=True),
        sa.Column("floor", sa.String(length=50), nullable=True),
        sa.Column("apartment", sa.String(length=50), nullable=True),
        sa.Column("courier_note", sa.Text(), nullable=True),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("delivery_fee", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", sa.String(length=20), nullable=False, server_default="cash"),
        sa.Column("placed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "delivery_order_item",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("delivery_order.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name_snapshot", sa.String(length=150), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
    )

    # The courier board only ever reads open orders. A partial index keeps that query on a
    # couple of pages no matter how many delivered orders pile up behind it.
    op.execute(
        "CREATE INDEX idx_delivery_order_open ON delivery_order (restaurant_id, status, placed_at DESC) "
        "WHERE status IN ('placed', 'accepted', 'picked_up')"
    )
    op.create_index("idx_delivery_order_customer", "delivery_order", ["customer_id", "placed_at"])
    op.create_index("idx_delivery_order_courier", "delivery_order", ["courier_id", "placed_at"])
    op.create_index("idx_delivery_order_item_order", "delivery_order_item", ["order_id"])


def downgrade() -> None:
    op.drop_index("idx_delivery_order_item_order", table_name="delivery_order_item")
    op.drop_index("idx_delivery_order_courier", table_name="delivery_order")
    op.drop_index("idx_delivery_order_customer", table_name="delivery_order")
    op.execute("DROP INDEX IF EXISTS idx_delivery_order_open")
    op.drop_table("delivery_order_item")
    op.drop_table("delivery_order")
    op.drop_table("courier")
    op.execute("DROP TYPE IF EXISTS delivery_status_enum")
    # 'courier' stays in user_role_enum: PostgreSQL cannot drop a single enum value.

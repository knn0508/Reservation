"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

table_category_enum = postgresql.ENUM(
    "2_seater", "4_seater", name="table_category_enum", create_type=False
)
reservation_status_enum = postgresql.ENUM(
    "booked", "seated", "completed", "cancelled", "no_show", name="reservation_status_enum", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    table_category_enum.create(bind, checkfirst=True)
    reservation_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "dining_table",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("table_number", sa.String(10), nullable=False, unique=True),
        sa.Column("category", table_category_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("zone", sa.String(50), nullable=False),
    )

    op.create_table(
        "inventory_bucket",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("bucket_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tables_2_free", sa.Integer(), nullable=False),
        sa.Column("tables_4_free", sa.Integer(), nullable=False),
        sa.Column("arrivals_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("bucket_time", name="unique_bucket_time"),
        sa.CheckConstraint("tables_2_free >= 0", name="chk_tables_2_free"),
        sa.CheckConstraint("tables_4_free >= 0", name="chk_tables_4_free"),
    )
    op.create_index("ix_inventory_bucket_time", "inventory_bucket", ["bucket_time"])

    op.create_table(
        "reservation",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("guest_name", sa.String(100), nullable=False),
        sa.Column("guest_email", sa.String(100), nullable=False),
        sa.Column("guest_phone", sa.String(50), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("table_category", table_category_enum, nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", reservation_status_enum, nullable=False, server_default="booked"),
        sa.Column("assigned_table_id", sa.Integer(), sa.ForeignKey("dining_table.id"), nullable=True),
        sa.Column("idempotency_key", sa.String(100), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("party_size >= 1 AND party_size <= 4", name="chk_party_limit"),
    )
    op.create_index("ix_reservation_start_time", "reservation", ["start_time"])
    op.create_index("ix_reservation_status", "reservation", ["status"])

    op.create_table(
        "reservation_event",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "reservation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reservation.id"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reservation_event_reservation_id", "reservation_event", ["reservation_id"])


def downgrade() -> None:
    op.drop_table("reservation_event")
    op.drop_table("reservation")
    op.drop_table("inventory_bucket")
    op.drop_table("dining_table")
    reservation_status_enum.drop(op.get_bind(), checkfirst=True)
    table_category_enum.drop(op.get_bind(), checkfirst=True)

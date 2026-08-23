"""add category, product, sale_record, table_visit for admin sales dashboard

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

# create_type=False: the types are created explicitly via raw DDL at the top of upgrade() -
# without this, create_table() would try to CREATE TYPE again and collide with that. (Plain
# sa.Enum(create_type=False) doesn't reliably forward this through the postgres dialect impl -
# postgresql.ENUM does.)
_menu_group_col = PGEnum("food", "bar", name="menu_group_enum", create_type=False)
_sale_channel_col = PGEnum("online", "restaurant", name="sale_channel_enum", create_type=False)


def upgrade() -> None:
    # Plain checkfirst=True on Enum.create() is unreliable through alembic's async->sync
    # greenlet bridge (has_type() can report false negatives) - use idempotent DO blocks instead.
    op.execute(
        "DO $$ BEGIN CREATE TYPE menu_group_enum AS ENUM ('food', 'bar'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE sale_channel_enum AS ENUM ('online', 'restaurant'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )

    op.create_table(
        "category",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("group", _menu_group_col, nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("restaurant_id", "name", name="unique_restaurant_category_name"),
    )

    op.create_table(
        "product",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant.id"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("category.id"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "sale_record",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("product.id"), nullable=False),
        sa.Column("channel", _sale_channel_col, nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sale_record_restaurant_occurred", "sale_record", ["restaurant_id", "occurred_at"])

    op.create_table(
        "table_visit",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant.id"), nullable=False),
        sa.Column("channel", _sale_channel_col, nullable=False),
        sa.Column("table_count", sa.Integer(), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_table_visit_restaurant_occurred", "table_visit", ["restaurant_id", "occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_table_visit_restaurant_occurred", table_name="table_visit")
    op.drop_table("table_visit")
    op.drop_index("ix_sale_record_restaurant_occurred", table_name="sale_record")
    op.drop_table("sale_record")
    op.drop_table("product")
    op.drop_table("category")
    op.execute("DROP TYPE IF EXISTS sale_channel_enum")
    op.execute("DROP TYPE IF EXISTS menu_group_enum")

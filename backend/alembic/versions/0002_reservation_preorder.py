"""add reservation preorder fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reservation", sa.Column("preorder_items", postgresql.JSONB(), nullable=True))
    op.add_column(
        "reservation", sa.Column("preorder_requested_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("reservation", "preorder_requested_at")
    op.drop_column("reservation", "preorder_items")

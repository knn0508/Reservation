"""remove party_size upper bound, add merged_table_ids

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reservation", sa.Column("merged_table_ids", postgresql.ARRAY(sa.Integer()), nullable=True)
    )
    op.drop_constraint("chk_party_limit", "reservation", type_="check")
    op.create_check_constraint("chk_party_limit", "reservation", "party_size >= 1")


def downgrade() -> None:
    op.drop_constraint("chk_party_limit", "reservation", type_="check")
    op.create_check_constraint("chk_party_limit", "reservation", "party_size >= 1 AND party_size <= 4")
    op.drop_column("reservation", "merged_table_ids")

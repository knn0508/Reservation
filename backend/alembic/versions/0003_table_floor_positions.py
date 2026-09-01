"""table floor positions

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dining_table", sa.Column("pos_x", sa.Integer(), nullable=False, server_default="50"))
    op.add_column("dining_table", sa.Column("pos_y", sa.Integer(), nullable=False, server_default="50"))
    # Spread existing tables into rows per category so the floor plan is never degenerate;
    # scripts/seed.py then overwrites these with the designed layout.
    op.execute(
        """
        WITH ordered AS (
            SELECT id,
                   row_number() OVER (PARTITION BY restaurant_id, category ORDER BY id) - 1 AS n,
                   category
            FROM dining_table
        )
        UPDATE dining_table AS t
        SET pos_x = 10 + (ordered.n % 4) * 27,
            pos_y = CASE WHEN ordered.category = '2_seater' THEN 12 ELSE 60 END
                    + (ordered.n / 4) * 26
        FROM ordered
        WHERE ordered.id = t.id
        """
    )


def downgrade() -> None:
    op.drop_column("dining_table", "pos_y")
    op.drop_column("dining_table", "pos_x")

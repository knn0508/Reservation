"""add floor_plan + floor_element, place dining_table on a plan

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

_ELEMENT_KINDS = (
    "wall",
    "window",
    "door",
    "entrance",
    "bar",
    "kitchen",
    "sofa",
    "booth",
    "plant",
    "pillar",
    "stairs",
    "restroom",
    "divider",
    "label",
)
_SHAPES = ("round", "square", "rect")

# create_type=False for the same reason as 0004: the types are created by the DO blocks below.
_kind_col = PGEnum(*_ELEMENT_KINDS, name="floor_element_kind_enum", create_type=False)
_shape_col = PGEnum(*_SHAPES, name="table_shape_enum", create_type=False)

DEFAULT_PLAN_NAME = "Main hall"
DEFAULT_WIDTH_CM = 1200
DEFAULT_HEIGHT_CM = 800


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN CREATE TYPE floor_element_kind_enum AS ENUM ("
        + ", ".join(f"'{k}'" for k in _ELEMENT_KINDS)
        + "); EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE table_shape_enum AS ENUM ("
        + ", ".join(f"'{s}'" for s in _SHAPES)
        + "); EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )

    op.create_table(
        "floor_plan",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant.id"), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("width_cm", sa.Integer(), nullable=False, server_default=str(DEFAULT_WIDTH_CM)),
        sa.Column("height_cm", sa.Integer(), nullable=False, server_default=str(DEFAULT_HEIGHT_CM)),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("restaurant_id", "name", name="unique_restaurant_floor_plan_name"),
    )

    op.create_table(
        "floor_element",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "floor_plan_id",
            sa.Integer(),
            sa.ForeignKey("floor_plan.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", _kind_col, nullable=False),
        sa.Column("x_cm", sa.Integer(), nullable=False),
        sa.Column("y_cm", sa.Integer(), nullable=False),
        sa.Column("width_cm", sa.Integer(), nullable=False),
        sa.Column("height_cm", sa.Integer(), nullable=False),
        sa.Column("rotation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("label", sa.String(length=40), nullable=True),
        sa.Column("color", sa.String(length=9), nullable=True),
        sa.Column("z_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_floor_element_floor_plan_id", "floor_element", ["floor_plan_id"])

    op.add_column(
        "dining_table",
        sa.Column("floor_plan_id", sa.Integer(), sa.ForeignKey("floor_plan.id"), nullable=True),
    )
    op.create_index("ix_dining_table_floor_plan_id", "dining_table", ["floor_plan_id"])
    op.add_column("dining_table", sa.Column("shape", _shape_col, nullable=False, server_default="round"))
    op.add_column("dining_table", sa.Column("seats", sa.Integer(), nullable=False, server_default="2"))
    op.add_column("dining_table", sa.Column("x_cm", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("dining_table", sa.Column("y_cm", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("dining_table", sa.Column("width_cm", sa.Integer(), nullable=False, server_default="80"))
    op.add_column("dining_table", sa.Column("height_cm", sa.Integer(), nullable=False, server_default="80"))
    op.add_column("dining_table", sa.Column("rotation", sa.Integer(), nullable=False, server_default="0"))

    # Backfill: every restaurant gets a default plan holding its existing tables, laid out on a
    # grid so admins open the editor onto their real tables instead of a blank canvas.
    op.execute(
        f"""
        INSERT INTO floor_plan (restaurant_id, name, width_cm, height_cm, sort_order)
        SELECT id, '{DEFAULT_PLAN_NAME}', {DEFAULT_WIDTH_CM}, {DEFAULT_HEIGHT_CM}, 0 FROM restaurant
        """
    )
    op.execute(
        f"""
        UPDATE dining_table dt
        SET floor_plan_id = fp.id
        FROM floor_plan fp
        WHERE fp.restaurant_id = dt.restaurant_id AND fp.name = '{DEFAULT_PLAN_NAME}'
        """
    )
    op.execute(
        """
        UPDATE dining_table
        SET seats = CASE WHEN category = '2_seater' THEN 2 ELSE 4 END,
            width_cm = CASE WHEN category = '2_seater' THEN 70 ELSE 100 END,
            height_cm = CASE WHEN category = '2_seater' THEN 70 ELSE 100 END
        """
    )
    op.execute(
        """
        WITH ordered AS (
            SELECT id, (ROW_NUMBER() OVER (PARTITION BY floor_plan_id ORDER BY id) - 1) AS n
            FROM dining_table
            WHERE floor_plan_id IS NOT NULL
        )
        UPDATE dining_table dt
        SET x_cm = 120 + (o.n % 6) * 180,
            y_cm = 120 + (o.n / 6) * 180
        FROM ordered o
        WHERE o.id = dt.id
        """
    )


def downgrade() -> None:
    op.drop_column("dining_table", "rotation")
    op.drop_column("dining_table", "height_cm")
    op.drop_column("dining_table", "width_cm")
    op.drop_column("dining_table", "y_cm")
    op.drop_column("dining_table", "x_cm")
    op.drop_column("dining_table", "seats")
    op.drop_column("dining_table", "shape")
    op.drop_index("ix_dining_table_floor_plan_id", table_name="dining_table")
    op.drop_column("dining_table", "floor_plan_id")
    op.drop_index("ix_floor_element_floor_plan_id", table_name="floor_element")
    op.drop_table("floor_element")
    op.drop_table("floor_plan")
    op.execute("DROP TYPE IF EXISTS table_shape_enum")
    op.execute("DROP TYPE IF EXISTS floor_element_kind_enum")

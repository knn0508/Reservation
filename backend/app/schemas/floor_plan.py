from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import FloorElementKind, TableCategory, TableShape

# Guard rails so a bad client can't write a table 400 metres wide.
MAX_CM = 10_000
MIN_SIZE_CM = 10


class FloorElementIn(BaseModel):
    kind: FloorElementKind
    x_cm: int = Field(ge=-MAX_CM, le=MAX_CM)
    y_cm: int = Field(ge=-MAX_CM, le=MAX_CM)
    width_cm: int = Field(ge=MIN_SIZE_CM, le=MAX_CM)
    height_cm: int = Field(ge=MIN_SIZE_CM, le=MAX_CM)
    rotation: int = Field(default=0, ge=0, lt=360)
    label: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=9)
    z_index: int = Field(default=0, ge=-100, le=100)


class FloorElementOut(FloorElementIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class FloorTableIn(BaseModel):
    """A table as the editor sends it back. `id` is null for one added on the canvas."""

    id: int | None = None
    table_number: str = Field(min_length=1, max_length=10)
    category: TableCategory
    shape: TableShape = TableShape.ROUND
    seats: int = Field(default=2, ge=1, le=30)
    x_cm: int = Field(ge=-MAX_CM, le=MAX_CM)
    y_cm: int = Field(ge=-MAX_CM, le=MAX_CM)
    width_cm: int = Field(ge=MIN_SIZE_CM, le=MAX_CM)
    height_cm: int = Field(ge=MIN_SIZE_CM, le=MAX_CM)
    rotation: int = Field(default=0, ge=0, lt=360)


class FloorTableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    floor_plan_id: int | None
    table_number: str
    category: TableCategory
    zone: str
    is_active: bool
    shape: TableShape
    seats: int
    x_cm: int
    y_cm: int
    width_cm: int
    height_cm: int
    rotation: int


class FloorPlanMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    name: str
    width_cm: int
    height_cm: int
    sort_order: int


class FloorPlanDetail(FloorPlanMeta):
    tables: list[FloorTableOut]
    elements: list[FloorElementOut]


class FloorPlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    width_cm: int = Field(default=1200, ge=100, le=MAX_CM)
    height_cm: int = Field(default=800, ge=100, le=MAX_CM)


class FloorPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    width_cm: int | None = Field(default=None, ge=100, le=MAX_CM)
    height_cm: int | None = Field(default=None, ge=100, le=MAX_CM)
    sort_order: int | None = None


class LayoutSave(BaseModel):
    """The whole canvas in one shot - simpler and more consistent than per-drag PATCHes."""

    tables: list[FloorTableIn]
    elements: list[FloorElementIn]

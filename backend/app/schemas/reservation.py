import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ReservationStatus, TableCategory


class ReservationCreate(BaseModel):
    restaurant_id: int
    guest_name: str = Field(min_length=1, max_length=100)
    guest_email: EmailStr
    guest_phone: str = Field(min_length=1, max_length=50)
    party_size: int = Field(ge=1, le=4)
    start_time: datetime
    table_id: int | None = None
    idempotency_key: str = Field(min_length=1, max_length=100)


class ReservationDelay(BaseModel):
    minutes: int = Field(gt=0, le=180)


class PreorderItem(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    quantity: int = Field(ge=1, le=50)
    price: float = Field(ge=0)


class PreorderCreate(BaseModel):
    restaurant_id: int
    items: list[PreorderItem] = Field(min_length=1)


class ReservationOut(BaseModel):
    id: uuid.UUID
    restaurant_id: int
    guest_name: str
    guest_email: str
    guest_phone: str
    party_size: int
    table_category: TableCategory
    start_time: datetime
    end_time: datetime
    status: ReservationStatus
    assigned_table_id: int
    preorder_items: list[PreorderItem] | None = None
    preorder_requested_at: datetime | None = None

    class Config:
        from_attributes = True


class AvailableTable(BaseModel):
    id: int
    table_number: str
    zone: str
    seats: int
    pos_x: int
    pos_y: int
    fits: bool
    available: bool


class AvailabilitySlot(BaseModel):
    time: datetime
    available_count: int
    tables: list[AvailableTable]


class AvailabilityQuery(BaseModel):
    date: str
    party_size: int = Field(ge=1, le=4)


class HoldCreate(BaseModel):
    restaurant_id: int
    party_size: int = Field(ge=1, le=4)
    start_time: datetime


class HoldOut(BaseModel):
    hold_id: str
    expires_at: datetime

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import DeliveryStatus


class DeliveryItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    unit_price: float = Field(ge=0)
    quantity: int = Field(ge=1, le=99)


class DeliveryItemOut(BaseModel):
    name_snapshot: str
    unit_price: float
    quantity: int

    class Config:
        from_attributes = True


class DeliveryOrderCreate(BaseModel):
    restaurant_id: int
    recipient_name: str = Field(min_length=1, max_length=100)
    recipient_phone: str = Field(min_length=1, max_length=50)
    # Pin coordinates - the courier navigates by these, not by address_text.
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address_text: str = Field(min_length=1, max_length=300)
    building: str | None = Field(default=None, max_length=50)
    entrance: str | None = Field(default=None, max_length=50)
    floor: str | None = Field(default=None, max_length=50)
    apartment: str | None = Field(default=None, max_length=50)
    courier_note: str | None = Field(default=None, max_length=500)
    payment_method: str = Field(default="cash", pattern="^(cash|card_on_delivery)$")
    items: list[DeliveryItemIn] = Field(min_length=1)


class CourierSummary(BaseModel):
    """What a customer is allowed to see about the person carrying their order.

    The courier's phone number is deliberately absent - the restaurant proxies that call."""

    id: int
    full_name: str
    vehicle_type: str
    plate_number: str | None


class DeliveryOrderOut(BaseModel):
    id: UUID
    public_code: str
    restaurant_id: int
    status: DeliveryStatus
    recipient_name: str
    recipient_phone: str
    lat: float
    lng: float
    address_text: str
    building: str | None
    entrance: str | None
    floor: str | None
    apartment: str | None
    courier_note: str | None
    subtotal: float
    delivery_fee: float
    total: float
    payment_method: str
    placed_at: datetime
    accepted_at: datetime | None
    picked_up_at: datetime | None
    delivered_at: datetime | None
    cancelled_at: datetime | None
    items: list[DeliveryItemOut]
    courier: CourierSummary | None = None

    class Config:
        from_attributes = True


class CourierProfileOut(BaseModel):
    user_id: int
    restaurant_id: int
    full_name: str
    vehicle_type: str
    plate_number: str | None
    is_on_shift: bool


class CourierShiftUpdate(BaseModel):
    is_on_shift: bool

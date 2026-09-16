"""Owner-dashboard contracts: the live fleet, the order board and delivery analytics."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import DeliveryStatus


class FleetCourier(BaseModel):
    """One courier as the dashboard map and roster see them.

    `lat`/`lng` are null when the courier's position key has expired - no signal rather than
    a stale dot. `age_s` lets the map grey a marker out before it disappears entirely.
    """

    id: int
    full_name: str
    vehicle_type: str
    plate_number: str | None
    is_on_shift: bool
    active_load: int
    lat: float | None = None
    lng: float | None = None
    heading: int | None = None
    speed_mps: float | None = None
    age_s: int | None = None


class BoardOrder(BaseModel):
    """An order on the dispatch board."""

    id: UUID
    public_code: str
    status: DeliveryStatus
    recipient_name: str
    recipient_phone: str
    address_text: str
    lat: float
    lng: float
    total: float
    courier_id: int | None = None
    courier_name: str | None = None
    placed_at: datetime
    accepted_at: datetime | None = None
    picked_up_at: datetime | None = None
    delivered_at: datetime | None = None


class AssignInput(BaseModel):
    courier_id: int


class OriginCell(BaseModel):
    """One ~100 m grid square of the origin heatmap."""

    lat: float
    lng: float
    orders: int
    revenue: float


class CourierKpi(BaseModel):
    courier_id: int
    full_name: str
    deliveries: int
    revenue: float
    # Null until a courier has completed a delivery in the window: a courier with no runs has
    # no average, which is a different statement from an average of zero.
    avg_total_minutes: float | None = None
    avg_road_minutes: float | None = None
    avg_pickup_minutes: float | None = None


class FleetSummary(BaseModel):
    """The numbers across the top of the dashboard."""

    couriers_on_shift: int
    couriers_live: int
    active_orders: int
    unassigned_orders: int
    delivered_today: int
    revenue_today: float

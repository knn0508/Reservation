from pydantic import BaseModel, Field


class CourierPing(BaseModel):
    """One position report from the courier device.

    `order_id` is optional: a courier on shift but between runs still reports position so the
    dispatch board knows they exist, it just is not attached to a delivery.
    """

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    heading: int | None = Field(default=None, ge=0, le=359)
    speed_mps: float | None = Field(default=None, ge=0)
    accuracy_m: float | None = Field(default=None, ge=0)
    order_id: str | None = None


class CourierPingAck(BaseModel):
    """Deliberately tiny - the device sends these constantly and reads nothing back."""

    ok: bool = True


class TrackingOut(BaseModel):
    """What the customer's tracking screen renders while an order is on the road."""

    lat: float
    lng: float
    heading: int | None = None
    speed_mps: float | None = None
    distance_m: int
    eta_low_s: int
    eta_high_s: int
    # Seconds since the fix was taken; null when the position predates timestamping. Lets the
    # screen mark a stale position instead of presenting it as live.
    age_s: int | None = None

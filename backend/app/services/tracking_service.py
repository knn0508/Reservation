"""Live courier tracking: the ping path, the tracking payload and the ETA.

**The one rule that decides latency: a location ping never touches PostgreSQL.**

`record_ping` validates, writes one Redis hash, pushes onto a buffer list, publishes to the
order's channel and returns. Persistence happens later in `app.workers.tasks.flush_locations`.
Writing to Postgres inside the ping handler would make end-to-end tracking latency equal to
database write latency under concurrent load - which is exactly when it matters.

Everything here is Redis-only and safe to call from a request handler.
"""

import json
import math
import time
from uuid import UUID

from app.core.config import settings
from app.core.redis import get_redis

# --- Redis keys -------------------------------------------------------------------------

def _pos_key(courier_id: int) -> str:
    return f"courier:{courier_id}:pos"


def _rate_key(courier_id: int) -> str:
    return f"rl:courier:{courier_id}"


BUFFER_KEY = "loc:buffer"
CHANNEL_PREFIX = "delivery:"
FLEET_CHANNEL_PREFIX = "fleet:"


def fleet_channel(restaurant_id: int) -> str:
    """Channel the owner dashboard listens on: every courier of one restaurant.

    Separate from the per-order channel because the audiences differ. A customer may see
    exactly one courier; the owner sees all of theirs. Publishing both from the ping handler
    keeps that split at the channel level rather than relying on filtering downstream.
    """
    return f"{FLEET_CHANNEL_PREFIX}{restaurant_id}"


def channel(order_id: UUID | str) -> str:
    """Pub/sub channel one delivery's subscribers listen on.

    Per-order rather than per-restaurant: a customer must only ever receive the position of
    the courier carrying *their* order, and the cheapest way to guarantee that is to never
    put anyone else's position on the channel they are subscribed to.
    """
    return f"{CHANNEL_PREFIX}{order_id}"


class PingRejected(Exception):
    """A ping that should be dropped rather than stored; routes map this to a 422."""


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres. Good to ~0.3% over a city, needs no PostGIS."""
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _round5(value: float) -> float:
    """5 decimals is ~1 m. Six doubles the payload for precision a delivery map cannot use."""
    return round(value, 5)


async def check_rate_limit(courier_id: int) -> None:
    """Token bucket per courier. A buggy or compromised client must not flood the gateway."""
    redis = get_redis()
    key = _rate_key(courier_id)
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    if count > settings.tracking_ping_rate_per_minute:
        raise PingRejected("Too many pings; slow down")


def validate(accuracy_m: float | None, speed_mps: float | None) -> None:
    """Drop junk before it reaches a customer's screen.

    A 500 m-accurate fix moves the marker across a district; a 60 m/s "speed" is a GPS jump,
    not a motorbike. Both look like teleportation to the customer, so they never get sent.
    """
    if accuracy_m is not None and accuracy_m > settings.tracking_ping_max_accuracy_m:
        raise PingRejected("Position accuracy too low to show")
    if speed_mps is not None and speed_mps > settings.tracking_ping_max_speed_mps:
        raise PingRejected("Implausible speed; ignoring GPS jump")


async def record_ping(
    *,
    courier_id: int,
    lat: float,
    lng: float,
    heading: int | None = None,
    speed_mps: float | None = None,
    accuracy_m: float | None = None,
    order_id: UUID | None = None,
    recorded_at: float | None = None,
) -> dict:
    """Validate → Redis → buffer → return. No database work on this path.

    Returns the compact payload that goes out on the socket (short keys, per the guide's
    payload discipline) so the caller can publish it without rebuilding it.
    """
    validate(accuracy_m, speed_mps)
    await check_rate_limit(courier_id)

    ts = recorded_at if recorded_at is not None else time.time()
    lat, lng = _round5(lat), _round5(lng)

    redis = get_redis()
    pos = {
        "lat": lat,
        "lng": lng,
        "h": "" if heading is None else int(heading),
        "s": "" if speed_mps is None else round(speed_mps, 2),
        "acc": "" if accuracy_m is None else round(accuracy_m, 1),
        "t": ts,
    }
    key = _pos_key(courier_id)
    # The TTL is free offline detection: no key means no signal, so a dashboard can grey the
    # courier out without any extra bookkeeping.
    await redis.hset(key, mapping={k: str(v) for k, v in pos.items()})
    await redis.expire(key, settings.tracking_pos_ttl_seconds)

    # Buffered for the flush task. RPUSH is O(1) and the list is drained in batches.
    await redis.rpush(
        BUFFER_KEY,
        json.dumps(
            {
                "c": courier_id,
                "o": str(order_id) if order_id else None,
                "lat": lat,
                "lng": lng,
                "h": heading,
                "s": speed_mps,
                "acc": accuracy_m,
                "t": ts,
            }
        ),
    )

    return {"c": courier_id, "lat": lat, "lng": lng, "h": heading, "s": speed_mps, "t": ts}


async def get_position(courier_id: int) -> dict | None:
    """Last known position, or None when the courier has gone quiet (TTL expired)."""
    redis = get_redis()
    raw = await redis.hgetall(_pos_key(courier_id))
    if not raw:
        return None

    def _num(key: str) -> float | None:
        value = raw.get(key)
        if value in (None, ""):
            return None
        try:
            return float(value)
        except ValueError:
            return None

    lat, lng = _num("lat"), _num("lng")
    if lat is None or lng is None:
        return None
    heading = _num("h")
    return {
        "c": courier_id,
        "lat": lat,
        "lng": lng,
        "h": None if heading is None else int(heading),
        "s": _num("s"),
        "t": _num("t"),
    }


async def publish(order_id: UUID | str, event: str, data: dict) -> None:
    """Fan one message out to everyone watching this order, across worker processes."""
    redis = get_redis()
    await redis.publish(channel(order_id), json.dumps({"event": event, "data": data}))


async def publish_fleet(restaurant_id: int, data: dict) -> None:
    """Publish a courier position to the restaurant's dashboard channel.

    Short keys here, unlike the customer payload: this goes out on every ping from every
    courier, and the dashboard coalesces them into one batch per second anyway.
    """
    redis = get_redis()
    await redis.publish(fleet_channel(restaurant_id), json.dumps(data))


def eta_range_seconds(distance_m: float, speed_mps: float | None) -> tuple[int, int]:
    """Road time as a range, never a single number.

    A precise minute you miss reads worse than a range you hit, so the customer is shown
    "8-12 min". Instantaneous GPS speed is useless here - a courier stopped at a light reads
    0 m/s, which would push the ETA to infinity - so anything below walking pace falls back
    to the configured city average.
    """
    usable = speed_mps if speed_mps and speed_mps > 1.0 else settings.tracking_avg_speed_mps
    seconds = distance_m / usable
    # Straight-line distance always understates road distance; the low end of the range
    # absorbs that rather than promising an arrival the courier cannot make.
    low = int(seconds * 1.15)
    high = int(seconds * 1.6)
    return max(low, 60), max(high, 120)


def customer_payload(pos: dict, drop_lat: float, drop_lng: float) -> dict:
    """The single shape the customer's tracking screen consumes.

    Verbose keys here, unlike the courier→server ping: this message goes to one subscriber a
    few times per delivery, not to a dashboard thousands of times, so matching the REST
    response model is worth more than the bytes.

    Both the REST bootstrap and the socket update are built from this one function on
    purpose. They drifted once already - the socket sent `h`/`s` while the response model
    declared `heading`/`speed_mps`, so the bootstrap silently reported null heading and speed.
    """
    distance = haversine_m(pos["lat"], pos["lng"], drop_lat, drop_lng)
    low, high = eta_range_seconds(distance, pos.get("s"))
    recorded = pos.get("t")
    return {
        "lat": pos["lat"],
        "lng": pos["lng"],
        "heading": pos.get("h"),
        "speed_mps": pos.get("s"),
        "distance_m": int(distance),
        "eta_low_s": low,
        "eta_high_s": high,
        # How old this fix is. The position key only lives `tracking_pos_ttl_seconds`, so a
        # value approaching that means the courier has gone quiet - a tunnel, a dead battery -
        # and the screen should say so rather than present a two-minute-old dot as live.
        # Without this the client cannot distinguish a fresh position from a nearly-expired
        # one, because both arrive on the same event.
        "age_s": max(0, int(time.time() - recorded)) if recorded else None,
    }


async def tracking_snapshot(
    *, courier_id: int, drop_lat: float, drop_lng: float
) -> dict | None:
    """Position + distance + ETA for one courier heading to one drop point."""
    pos = await get_position(courier_id)
    if pos is None:
        return None
    return customer_payload(pos, drop_lat, drop_lng)

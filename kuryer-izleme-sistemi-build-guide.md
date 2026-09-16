# Kuryer İzləmə Sistemi — Build Guide

Real-time courier tracking for the restaurant platform. Flask + React + React Native + PostgreSQL/PostGIS + Redis.

Integrates into the existing reservation/menu system: reuses `restaurants`, `branches`, `users`, menu tables and auth. Adds ordering, dispatch, live tracking and delivery analytics.

---

## 1. Scope

Three surfaces:

| Surface | Stack | Purpose |
|---|---|---|
| Owner dashboard | React | Live map of all couriers, order board, courier performance, heatmap of order origins |
| Customer app | React Native | Menu → cart → checkout → live courier map + ETA (extends existing app) |
| Courier app | React Native | Accept/reject offers, pickup, delivered, proof photo, background location |

Build the courier app as a **separate binary**, not a role toggle inside the customer app. It needs `UIBackgroundModes: location` and `ACCESS_BACKGROUND_LOCATION`, which complicate store review. Do not let that risk touch the customer app.

---

## 2. Service topology

Five processes. One VPS with Docker Compose is enough for a pilot and up to a few hundred concurrent couriers.

| Process | Command | Role |
|---|---|---|
| `api` | `gunicorn -k gevent -w 4 -b 0.0.0.0:8000 wsgi:app` | Flask REST: auth, menu, orders, admin, analytics |
| `realtime` | `gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 2 -b 0.0.0.0:8001 socket_wsgi:app` | Flask-SocketIO only |
| `worker` | `celery -A app.tasks worker -P gevent -c 50` | Dispatch, ETA, push, location flush, rollups |
| `beat` | `celery -A app.tasks beat` | Periodic flush, stale-courier sweep, matview refresh |
| `nginx` | — | TLS, WebSocket upgrade, static React build |

Infrastructure: PostgreSQL 16 + PostGIS behind PgBouncer (transaction pooling), Redis 7, S3-compatible object storage for proof photos, self-hosted OSRM for routing.

Keep `api` and `realtime` as separate processes even though both are Flask. Different scaling and failure profiles — a slow analytics query must never stall location fan-out.

`realtime` must be started with `SocketIO(app, message_queue=os.environ["REDIS_URL"])` so that multiple worker processes share room membership. Without it, a client connected to worker 1 will never receive a broadcast emitted from worker 2.

### Repo layout

```
backend/
  app/
    __init__.py          create_app factory
    models/              SQLAlchemy models
    api/                 REST blueprints (auth, menu, orders, couriers, analytics)
    realtime/
      events.py          socket handlers
      rooms.py           room naming + authorization
    services/
      dispatch.py        courier assignment
      routing.py         OSRM client + polyline cache
      eta.py             ETA computation
      geo.py             PostGIS helpers
    tasks/               celery tasks
    migrations/          alembic
  wsgi.py
  socket_wsgi.py
web-dashboard/           React + Vite + MapLibre GL
mobile-customer/         React Native (existing app, extended)
mobile-courier/          React Native (new)
infra/
  docker-compose.yml
  nginx.conf
```

---

## 3. The one rule that decides your latency

**A location ping never touches PostgreSQL on the request path.**

The socket handler validates, writes Redis, publishes to the room, returns. Persistence happens in a background flush. If you write to Postgres inside the handler, your end-to-end latency becomes your database write latency under concurrent load, and the whole product feels broken at exactly the moment it matters (peak dinner hours).

---

## 4. Realtime design

### 4.1 Rooms

| Room | Subscriber | Receives |
|---|---|---|
| `order:{order_id}` | one customer | only their courier's position, only while status is `picked_up`/`on_route` |
| `branch:{branch_id}` | dashboard | all active couriers of that branch, aggregated |
| `courier:{courier_id}` | one courier | new offers, cancellations, reassignments |

On `join`, verify server-side that this user actually owns this order. Never trust a room name supplied by the client — that is the whole authorization boundary of the system.

### 4.2 Events

| Event | Direction | Payload |
|---|---|---|
| `loc:ping` | courier → server | `{lat, lng, h, s, acc, t}` |
| `loc:update` | server → customer | `{c, lat, lng, h, s, t}` |
| `loc:batch` | server → dashboard | `[{c, lat, lng, h, s, t}, ...]` once per second |
| `order:status` | server → both | `{order_id, status, at}` |
| `eta:update` | server → customer | `{order_id, eta_seconds, distance_m}` |
| `offer:new` | server → courier | `{order_id, pickup, drop, distance_m, expires_at}` |
| `offer:respond` | courier → server | `{order_id, accept: bool}` |

### 4.3 Payload discipline

Short keys, 5 decimal places on coordinates (≈1 m precision — more than a delivery map needs). Six decimals doubles bandwidth for nothing.

```json
{"c": 41, "lat": 40.37911, "lng": 49.85668, "h": 214, "s": 8.2, "t": 1757683200}
```

### 4.4 Authentication

Short-lived JWT (15 min) passed in the Socket.IO handshake `auth` field, refreshed over the socket before expiry. Access to `order:{id}` is granted only while the order is in an active delivery state and revoked on `delivered`/`cancelled` — a customer must not be able to keep watching a courier after their food arrives.

### 4.5 Adaptive sampling (courier device)

| Condition | Interval |
|---|---|
| `on_route`, moving | 3 s |
| `assigned`, heading to pickup | 5 s |
| `idle` at branch | 15 s |
| `speed < 0.5 m/s` for 60 s | stop; resume on significant-change |

Cuts ping volume roughly 70% with no visible difference to the customer. Reject pings with `accuracy_m > 100` server-side, and drop any ping implying speed over 40 m/s (GPS jump).

### 4.6 Client-side interpolation

**The highest-leverage optimization in the whole system.** Never snap the marker to each ping. Animate from the previous position to the new one over the expected ping interval:

```js
Animated.timing(coord, {
  toValue: { latitude, longitude },
  duration: 3000,
  easing: Easing.linear,
  useNativeDriver: false,
}).start();
```

A 5 s ping interval with interpolation looks smoother than a 1 s interval without it, at one fifth the bandwidth. Also rotate the marker to `heading` so it reads as a vehicle rather than a dot.

### 4.7 Dashboard throttling

30 couriers × 3 s pings = 10 messages/s per open dashboard, and React will re-render itself to death. The gateway instead aggregates per branch and emits one `loc:batch` array per second. One message, one render. Keep courier positions in a `useRef` map, not `useState`, and drive marker updates imperatively.

### 4.8 Offline handling (courier app)

Queue pings in AsyncStorage/SQLite when the socket is down, flush on reconnect **with original timestamps** and a `backfill: true` flag. The live view must ignore backfilled pings so the marker doesn't jump backwards; the flush writer still persists them for the route history.

---

## 5. Redis layout

| Key | Type | Purpose |
|---|---|---|
| `courier:{id}:pos` | HASH | lat, lng, heading, speed, accuracy, ts — **TTL 120 s** |
| `branch:{id}:couriers` | GEO | `GEOADD` for proximity dispatch via `GEOSEARCH` |
| `order:{id}:eta` | STRING | cached ETA seconds, TTL 60 s |
| `route:{order_id}` | STRING | encoded OSRM polyline, TTL = delivery duration |
| `loc:buffer` | LIST | `RPUSH` packed pings, drained by Celery |
| `rl:courier:{id}` | STRING | token bucket, rejects ping floods |
| `offer:{order_id}` | STRING | current offer holder + expiry, for race prevention |

The TTL on `courier:{id}:pos` gives you free offline detection: no key means no signal, so the dashboard greys the marker out with zero extra bookkeeping.

---

## 6. Schema

### 6.1 Extensions and enums

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_role       AS ENUM ('customer','owner','manager','courier');
CREATE TYPE courier_status  AS ENUM ('offline','idle','assigned','on_route');
CREATE TYPE fulfilment_type AS ENUM ('delivery','pickup','dine_in_preorder');
CREATE TYPE order_status    AS ENUM (
  'draft','placed','confirmed','preparing','ready',
  'assigned','picked_up','on_route','delivered','cancelled','failed'
);
```

### 6.2 Tenancy (already exists — extend)

```sql
CREATE TABLE restaurants (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'Asia/Baku',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id                 BIGSERIAL PRIMARY KEY,
  restaurant_id      BIGINT NOT NULL REFERENCES restaurants(id),
  name               TEXT NOT NULL,
  location           GEOGRAPHY(POINT,4326) NOT NULL,
  address_text       TEXT,
  avg_prep_minutes   SMALLINT NOT NULL DEFAULT 20,
  delivery_radius_m  INT NOT NULL DEFAULT 6000
);
```

### 6.3 Identity

```sql
CREATE TABLE users (
  id             BIGSERIAL PRIMARY KEY,
  phone          TEXT UNIQUE NOT NULL,
  email          TEXT,
  full_name      TEXT NOT NULL,
  password_hash  TEXT,
  role           user_role NOT NULL,
  restaurant_id  BIGINT REFERENCES restaurants(id),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_addresses (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT,
  location      GEOGRAPHY(POINT,4326) NOT NULL,
  address_text  TEXT NOT NULL,
  building      TEXT,
  entrance      TEXT,
  floor         TEXT,
  apartment     TEXT,
  notes         TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE push_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Azerbaijani street addresses are unreliable for geocoding. Make **pin-drop the primary input** in the customer app and free text secondary, with `building`/`entrance`/`floor`/`apartment` as separate fields. This single decision removes most "courier couldn't find the address" calls.

### 6.4 Couriers

```sql
CREATE TABLE couriers (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  branch_id     BIGINT NOT NULL REFERENCES branches(id),
  vehicle_type  TEXT NOT NULL DEFAULT 'motorbike',
  plate_number  TEXT,
  status        courier_status NOT NULL DEFAULT 'offline',
  active_load   SMALLINT NOT NULL DEFAULT 0,
  max_load      SMALLINT NOT NULL DEFAULT 2,
  rating        NUMERIC(3,2) DEFAULT 5.00,
  last_seen_at  TIMESTAMPTZ
);

CREATE TABLE courier_shifts (
  id          BIGSERIAL PRIMARY KEY,
  courier_id  BIGINT NOT NULL REFERENCES couriers(user_id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  distance_m  INT NOT NULL DEFAULT 0,
  deliveries  SMALLINT NOT NULL DEFAULT 0
);
```

### 6.5 Orders

```sql
CREATE TABLE orders (
  id                BIGSERIAL PRIMARY KEY,
  public_code       TEXT UNIQUE NOT NULL,
  branch_id         BIGINT NOT NULL REFERENCES branches(id),
  customer_id       BIGINT NOT NULL REFERENCES users(id),
  fulfilment        fulfilment_type NOT NULL DEFAULT 'delivery',
  reservation_id    BIGINT,                        -- links to reservation system
  status            order_status NOT NULL DEFAULT 'draft',
  address_id        BIGINT REFERENCES customer_addresses(id),
  drop_location     GEOGRAPHY(POINT,4326),         -- immutable snapshot
  address_snapshot  JSONB,
  subtotal          NUMERIC(10,2) NOT NULL,
  delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,
  payment_method    TEXT NOT NULL,
  payment_status    TEXT NOT NULL DEFAULT 'pending',
  scheduled_for     TIMESTAMPTZ,
  placed_at         TIMESTAMPTZ,
  promised_at       TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  customer_note     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id             BIGSERIAL PRIMARY KEY,
  order_id       BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id   BIGINT NOT NULL,
  name_snapshot  TEXT NOT NULL,
  unit_price     NUMERIC(10,2) NOT NULL,
  quantity       SMALLINT NOT NULL,
  options        JSONB NOT NULL DEFAULT '[]'
);
```

`drop_location` and `address_snapshot` are deliberate copies, not joins. If a customer edits or deletes a saved address, the historical order and its delivery route must not mutate. Same reason `order_items.name_snapshot` and `unit_price` are copied from the menu.

### 6.6 Delivery leg

```sql
CREATE TABLE deliveries (
  id               BIGSERIAL PRIMARY KEY,
  order_id         BIGINT NOT NULL UNIQUE REFERENCES orders(id),
  courier_id       BIGINT NOT NULL REFERENCES couriers(user_id),
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  planned_route    TEXT,                 -- encoded polyline
  planned_eta_at   TIMESTAMPTZ,
  distance_m       INT,
  proof_photo_url  TEXT,
  proof_location   GEOGRAPHY(POINT,4326),
  failure_reason   TEXT
);

CREATE TABLE delivery_offers (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id),
  courier_id  BIGINT NOT NULL REFERENCES couriers(user_id),
  offered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  response    TEXT                       -- accepted | rejected | expired
);

CREATE TABLE order_events (
  id           BIGSERIAL PRIMARY KEY,
  order_id     BIGINT NOT NULL REFERENCES orders(id),
  actor_id     BIGINT REFERENCES users(id),
  from_status  order_status,
  to_status    order_status NOT NULL,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`order_events` is append-only and is what makes the dashboard analytics possible: prep time, pickup wait, road time, and SLA breaches are all derived from it rather than stored redundantly.

### 6.7 Telemetry (the only high-volume table)

```sql
CREATE TABLE courier_locations (
  courier_id   BIGINT NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL,
  location     GEOGRAPHY(POINT,4326) NOT NULL,
  accuracy_m   REAL,
  speed_mps    REAL,
  heading      SMALLINT,
  order_id     BIGINT,
  battery_pct  SMALLINT
) PARTITION BY RANGE (recorded_at);

CREATE TABLE courier_locations_2026_09 PARTITION OF courier_locations
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

Volume estimate: 20 couriers × 8 active hours × 1200 pings/hour ≈ 192k rows/day, ~6M/month. Monthly partitions, detach and archive after 3 months. Use `pg_partman` or a Celery beat task to pre-create next month's partition.

### 6.8 Zones

```sql
CREATE TABLE delivery_zones (
  id         BIGSERIAL PRIMARY KEY,
  branch_id  BIGINT NOT NULL REFERENCES branches(id),
  name       TEXT NOT NULL,
  area       GEOGRAPHY(POLYGON,4326) NOT NULL,
  extra_fee  NUMERIC(10,2) NOT NULL DEFAULT 0
);
```

### 6.9 Indexes

```sql
-- dashboard hot query: active orders only, keeps index tiny
CREATE INDEX idx_orders_active ON orders (branch_id, status, placed_at DESC)
  WHERE status IN ('placed','confirmed','preparing','ready','assigned','picked_up','on_route');

CREATE INDEX idx_orders_customer ON orders (customer_id, placed_at DESC);
CREATE INDEX idx_orders_drop_geo ON orders USING GIST (drop_location);
CREATE INDEX idx_orders_sched    ON orders (branch_id, scheduled_for)
  WHERE scheduled_for IS NOT NULL AND status <> 'delivered';

CREATE INDEX idx_couriers_dispatch ON couriers (branch_id, status)
  WHERE status IN ('idle','assigned');

CREATE INDEX idx_offers_open ON delivery_offers (order_id, expires_at)
  WHERE response IS NULL;

CREATE INDEX idx_events_order ON order_events (order_id, created_at);

-- per partition
CREATE INDEX idx_loc_courier_time ON courier_locations_2026_09 (courier_id, recorded_at DESC);
CREATE INDEX idx_loc_time_brin    ON courier_locations_2026_09 USING BRIN (recorded_at);
CREATE INDEX idx_loc_order        ON courier_locations_2026_09 (order_id) WHERE order_id IS NOT NULL;

CREATE INDEX idx_zones_area ON delivery_zones USING GIST (area);
```

The partial indexes matter more than they look. A restaurant with 200k historical orders has maybe 15 active ones; a partial index keeps the dashboard's main query on a handful of pages regardless of history size.

---

## 7. Order state machine

```
draft → placed → confirmed → preparing → ready → assigned → picked_up → on_route → delivered
                     ↓           ↓          ↓         ↓
                 cancelled   cancelled  cancelled  failed
```

Enforce transitions in one place (`services/orders.py::transition`), write an `order_events` row inside the same transaction, and emit `order:status` **after commit**. Emitting before commit will occasionally show the customer a status that then rolls back.

Push notification triggers: `confirmed`, `on_route`, `delivered`, plus "courier is 2 minutes away" derived from ETA.

---

## 8. Dispatch

Triggered when an order reaches `ready` (or `confirmed` if you want the courier en route during prep).

```python
def dispatch(order):
    branch = order.branch
    # 1. candidates within 4 km, from Redis GEO — no DB query
    ids = redis.geosearch(f"branch:{branch.id}:couriers",
                          longitude=branch.lon, latitude=branch.lat,
                          radius=4000, unit="m", sort="ASC", count=15)
    # 2. filter and score
    best = None
    for cid in ids:
        c = courier_state(cid)                    # Redis hash + cached row
        if c.status == "offline" or c.active_load >= c.max_load:
            continue
        score = (0.6 * normalize(c.distance_m)
               + 0.3 * (c.active_load / c.max_load)
               - 0.1 * (c.rating / 5.0))
        if best is None or score < best.score:
            best = c
    # 3. exclusive offer with SET NX, 20 s expiry
    if best and redis.set(f"offer:{order.id}", best.id, nx=True, ex=20):
        emit_offer(best.id, order)
    else:
        retry_in(5)                               # widen radius on each retry
```

Use `SET NX` for the offer lock, not a database row lock. Two Celery workers picking the same courier for two orders is the realistic race here, and Redis settles it in one round trip.

On `offer:respond(accept=false)` or expiry, mark the offer `rejected`/`expired`, add the courier to a short exclusion set for that order, and re-dispatch with a wider radius. After 3 failed rounds, surface it on the dashboard for manual assignment — always keep a manual override.

---

## 9. Routing and ETA

Self-host OSRM on an Azerbaijan OSM extract:

```
docker run -p 5000:5000 -v $PWD/osrm:/data osrm/osrm-backend \
  osrm-routed --algorithm mld /data/azerbaijan-latest.osrm
```

Per-ping calls to a commercial directions API would be both slower and financially unsustainable at delivery volume. OSRM on a small VPS answers in single-digit milliseconds.

- **At assignment**: one OSRM route branch → drop. Store polyline in `deliveries.planned_route` and Redis.
- **Between recomputes**: walk the remaining polyline against the courier's rolling median speed. Pure arithmetic, no network call.
- **Recompute** only when the courier is >150 m off the polyline, or every 90 s, whichever comes first.
- `eta = prep_remaining + pickup_wait + road_time`. Show the customer a **range** ("25–35 min"), never a single minute — a precise number you miss reads worse than a range you hit.

Smooth speed with a rolling median over the last 5 pings, not the instantaneous value. Raw GPS speed at a traffic light is 0, which would push the ETA to infinity.

---

## 10. "Where do orders come from" analytics

Two views on the same data, both from `orders.drop_location`.

**Zone aggregation** for the owner's table:

```sql
SELECT z.name,
       count(*)                          AS orders,
       round(avg(o.total), 2)            AS avg_ticket,
       round(avg(extract(epoch FROM o.delivered_at - o.placed_at) / 60), 1) AS avg_minutes
FROM orders o
JOIN delivery_zones z
  ON ST_Covers(z.area, o.drop_location)
WHERE o.branch_id = :branch
  AND o.status = 'delivered'
  AND o.placed_at >= now() - interval '30 days'
GROUP BY z.name
ORDER BY orders DESC;
```

**Grid heatmap** for the map. Snap to a ~250 m grid and aggregate in a materialized view — never send raw points to the browser:

```sql
CREATE MATERIALIZED VIEW mv_order_origin_grid AS
SELECT branch_id,
       date_trunc('day', placed_at)::date AS day,
       round(ST_Y(drop_location::geometry)::numeric, 3) AS lat_cell,
       round(ST_X(drop_location::geometry)::numeric, 3) AS lng_cell,
       count(*) AS orders,
       sum(total) AS revenue
FROM orders
WHERE drop_location IS NOT NULL AND status = 'delivered'
GROUP BY 1,2,3,4;

CREATE UNIQUE INDEX ON mv_order_origin_grid (branch_id, day, lat_cell, lng_cell);
```

Refresh with `REFRESH MATERIALIZED VIEW CONCURRENTLY` every 15 minutes from Celery beat. The unique index is what makes `CONCURRENTLY` legal — without it the refresh takes an exclusive lock and freezes the dashboard.

This is the feature the owner will actually pay for: it tells them which neighbourhoods to advertise in, where a second branch belongs, and which zones are losing money on delivery fees.

---

## 11. REST surface

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/orders` | create from cart, returns `public_code` |
| `GET` | `/api/orders/{id}` | includes courier snapshot when active |
| `POST` | `/api/orders/{id}/cancel` | allowed until `picked_up` |
| `GET` | `/api/branches/{id}/orders?status=active` | dashboard board |
| `POST` | `/api/orders/{id}/assign` | manual override |
| `GET` | `/api/couriers/active?branch_id=` | initial map state on dashboard load |
| `POST` | `/api/couriers/me/shift` | start/end shift |
| `POST` | `/api/deliveries/{id}/pickup` | courier |
| `POST` | `/api/deliveries/{id}/deliver` | multipart, proof photo + location |
| `GET` | `/api/analytics/origins?branch_id=&from=&to=` | reads matview |
| `GET` | `/api/analytics/couriers?branch_id=&from=&to=` | per-courier KPIs |

On dashboard load, fetch current courier positions over REST once, then rely purely on the socket. Do not try to bootstrap live state through the socket — a dropped connection during load leaves an empty map.

---

## 12. Latency budget

Ping to pixel, p95 target under 1.2 s:

| Hop | Budget |
|---|---|
| GPS fix on device | 200–800 ms (outside your control) |
| Device → gateway over open WebSocket | 40–120 ms on AZ mobile networks |
| Redis write + publish | < 5 ms |
| Fan-out to subscribers | 10–50 ms |
| Client render | next animation frame |

Checklist, roughly in order of impact:

- [ ] Client-side marker interpolation, with heading rotation
- [ ] Adaptive sampling on the courier device
- [ ] No Postgres write on the ping path (Redis buffer + 10 s batched flush)
- [ ] Dashboard `loc:batch` aggregation at 1 Hz
- [ ] Persistent WebSocket, never HTTP POST per ping (saves a TLS handshake every time)
- [ ] `useRef` for courier positions in React, imperative marker updates
- [ ] Cached OSRM polyline, recompute on drift only
- [ ] Partial indexes on active orders
- [ ] PgBouncer in transaction mode
- [ ] Vector map tiles (MapLibre GL) rather than raster — far less bandwidth on mobile
- [ ] `gzip`/`permessage-deflate` on the socket, disabled for payloads under 100 bytes

The flush task:

```python
@celery.task
def flush_locations():
    batch = []
    while len(batch) < 5000:
        item = redis.lpop("loc:buffer")
        if not item:
            break
        batch.append(unpack(item))
    if batch:
        copy_into_courier_locations(batch)   # psycopg COPY, not INSERT
```

Use `COPY` via `psycopg.cursor.copy()`. At a few thousand rows per flush, `COPY` is roughly an order of magnitude faster than row-by-row `INSERT`.

---

## 13. Security

- Customer sees courier position only while the order is active; revoke the room on `delivered`.
- Courier phone number is never exposed directly — proxy calls or show a masked number.
- Server-side room authorization on every `join`, based on the JWT subject and a DB ownership check.
- Rate-limit `loc:ping` per courier via the Redis token bucket; a compromised or buggy client should not be able to flood the gateway.
- Validate `deliver` proof location is within ~150 m of `drop_location`; flag rather than block, and record the discrepancy.
- Row-level tenant scoping on every query — `branch_id`/`restaurant_id` filter belongs in a base query class, not in each endpoint.
- Location history is personal data about employees. Set a retention policy (90 days is reasonable), document it, and delete on schedule.

---

## 14. Observability

- Prometheus + Grafana: socket connection count, pings/s, flush lag (`LLEN loc:buffer`), dispatch time to acceptance, p95 ping-to-emit, Postgres connection saturation.
- Sentry on all three clients and both Flask processes.
- Structured JSON logs with `order_id` and `courier_id` on every line. When an owner calls to say "order 4471 was late", you want one grep to reconstruct the whole timeline.
- Alert on: `LLEN loc:buffer > 20000`, couriers with `last_seen_at` older than 5 minutes while `on_route`, dispatch failures after 3 rounds.

---

## 15. Build order (pilot in ~3 weeks)

**Week 1 — backend spine**
Migrations and models. Order creation from the existing menu. State machine + `order_events`. Dashboard order board over REST. Courier CRUD and shifts. No maps yet.

**Week 2 — tracking**
Socket gateway with rooms and auth. Courier app: shift toggle, offer accept, pickup/deliver, background location. Redis position state + flush task. Dashboard live map. Customer tracking screen with interpolation.

**Week 3 — polish and the sellable parts**
OSRM + ETA ranges. Dispatch scoring and re-offer. Proof photo upload. Push notifications. Origin heatmap and courier KPI screens. Load test with a simulated fleet.

**Load test before any demo.** Write a script that spawns 50 fake courier sockets pinging on realistic intervals along recorded Baku routes. Watch p95 ping-to-emit and flush lag. Every problem in this document shows up under that test and nowhere else — a demo with two phones will look perfect and tell you nothing.

---

## 16. Integration notes for the existing platform

- **Reuse** `users`, `restaurants`, `branches`, menu tables and the existing auth/JWT issuer. Add the `courier` value to `user_role` and the courier-specific columns in a separate `couriers` table rather than widening `users`.
- **`orders.reservation_id`** is the bridge to the reservation system. A `dine_in_preorder` for a reserved slot uses `scheduled_for` and skips dispatch entirely; the same table and menu snapshot logic serves both flows, which is why fulfilment is an enum rather than separate tables.
- **The dashboard** should be a new route group in the existing React app, sharing the auth context and layout shell. Only the map view is genuinely new.
- **The customer app** gains a cart, a checkout, an address picker and a tracking screen. The socket client is new; everything else extends what is already there.
- **As an IBT template**, the reusable core is: socket gateway, Redis position layer, dispatch service, OSRM wrapper, and the tracking map components. The same core drives GPS monitoring for fleets and field-worker tracking for construction with the dispatch layer swapped out — which is worth keeping in mind while drawing module boundaries now.

# ITB Reservation

Restaurant table reservation system. FastAPI backend with atomic concurrency-safe booking, React + Vite frontend for guest booking and admin management.

## Stack

**Backend**
- FastAPI (async)
- SQLAlchemy 2.0 (async) + PostgreSQL
- Redis — soft holds (TTL), Celery broker/result backend
- Celery — background workers (no-show sweep, bucket rollover, etc.)
- Alembic — migrations
- Google Gemini (`google-generativeai`) — structured note extraction (dietary/occasion)
- pytest / pytest-asyncio — includes a concurrency proof test

**Frontend**
- React 19 + TypeScript + Vite
- React Router
- TanStack Query
- Tailwind CSS 4
- Framer Motion, Phosphor Icons

## Project layout

```
backend/
  app/
    api/routes/      availability, reservations, holds, admin, ai, ws
    core/            settings, db session, etc.
    models/          dining_table, reservation, reservation_event, inventory_bucket, enums
    schemas/         pydantic request/response models
    services/        business logic (booking engine, holds, etc.)
    workers/         celery app + tasks
    ws/              websocket handling
  alembic/           migrations
  scripts/seed.py    seeds dining tables + inventory buckets
  tests/             pytest suite incl. concurrency test
  docker-compose.yml postgres + redis

frontend/
  src/
    pages/           HomePage, LookupPage, AdminPage
    components/
      booking/        BookingWizard, DateStrip, PartySizeStep, SlotGrid, GuestDetailsForm, ConfirmationCard
      layout/          SiteHeader
    hooks/            useAvailability, useReservation
    lib/              api.ts (backend client), time.ts
```

## How it works

Core design: the restaurant's service window is sliced into fixed time **buckets** (default 60 min) per table size. Each bucket tracks remaining capacity in an `inventory_bucket` row. Booking a table is an **atomic ranged UPDATE** against that row (decrement-if-available), so concurrent booking attempts for the same slot can't oversell — proven by `backend/tests/test_concurrency.py` (40 concurrent requests for 5 tables → exactly 5 succeed).

Flow: guest picks a day/party size on the frontend → `GET /api/availability` shows free bucket counts (live-updated over WebSocket) → guest selects a slot, backend places a Redis TTL **hold** → guest fills details and confirms → `POST /api/reservations` does the atomic booking with an idempotency key. Celery workers handle no-show sweeps and other time-based cleanup.

## Setup & run

Prereqs: Python 3.11+, Node 18+, Docker (for Postgres + Redis).

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # fill in GEMINI_API_KEY if using AI note extraction

docker compose up -d            # starts postgres + redis
alembic upgrade head
python -m scripts.seed          # dining tables + 2 days of inventory buckets

uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Health check: `GET /health`.

Celery, in separate terminals (needed for background jobs like no-show sweeps):

```bash
celery -A app.workers.celery_app worker --loglevel=info --pool=solo
celery -A app.workers.celery_app beat --loglevel=info
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` (Vite dev server). It expects the backend on `http://localhost:8000` (CORS is already configured for this origin in `backend/app/main.py`).

### 3. Tests

```bash
cd backend
pytest
```

`test_concurrency.py` needs Postgres running and `DATABASE_URL` pointed at a disposable test DB.

### Frontend build

```bash
cd frontend
npm run build      # tsc -b && vite build, outputs to dist/
npm run preview    # preview production build
npm run lint        # oxlint
```

## Key backend endpoints

- `GET  /api/availability?day=YYYY-MM-DD` — bucket-level free counts
- `POST /api/reservations` — atomic booking (`idempotency_key` required)
- `POST /api/reservations/{id}/cancel|no-show|seat|complete|delay`
- `POST /api/holds` / `DELETE /api/holds/{id}` — Redis TTL soft holds
- `WS   /ws/availability/{day}` — live free-count deltas, zero PII
- `GET  /api/admin/reservations?day=...`, `GET /api/admin/tables`
- `POST /api/ai/extract-notes` — Gemini structured dietary/occasion extraction

## Config (backend/.env)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres async connection string |
| `REDIS_URL` | Redis for holds |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | Celery (separate Redis DBs) |
| `GEMINI_API_KEY` | Gemini API key for AI note extraction |
| `RESTAURANT_TIMEZONE` | e.g. `Asia/Baku` |
| `SERVICE_OPEN_TIME` / `SERVICE_CLOSE_TIME` | daily service window |
| `BUCKET_MINUTES` | slot granularity |
| `DINE_DURATION_MINUTES` / `BUFFER_MINUTES` | seating duration + turnover buffer |
| `MAX_PARTY_SIZE` | max guests per booking |
| `MAX_ARRIVALS_PER_BUCKET` | arrival throttling per slot |
| `HOLD_TTL_SECONDS` | how long a soft hold reserves a slot |
| `NO_SHOW_GRACE_MINUTES` | grace period before auto no-show |
| `TABLES_2_SEATER_COUNT` / `TABLES_4_SEATER_COUNT` | seed table counts |

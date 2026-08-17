# ITB Reservation

Multi-restaurant table reservation system. FastAPI backend with real table-level, concurrency-safe booking and account-based access control; React + Vite frontend for guest booking and per-restaurant admin management.

## Stack

**Backend**
- FastAPI (async)
- SQLAlchemy 2.0 (async) + PostgreSQL
- JWT auth (`python-jose`) + bcrypt password hashing (`passlib`)
- Redis — soft holds (TTL), Celery broker/result backend
- Celery — background workers (no-show sweep, reminders)
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
    api/routes/      auth, restaurants, availability, reservations, holds, admin, ai, ws
    core/            settings, db session, security (JWT/hashing), redis
    models/          restaurant, user, dining_table, reservation, reservation_event, enums
    schemas/         pydantic request/response models
    services/        business logic (booking engine, live availability, holds)
    workers/         celery app + tasks
    ws/              websocket handling
  alembic/           migrations
  scripts/seed.py    seeds 2 restaurants, their dining tables, and one admin account each
  tests/             pytest suite incl. concurrency test
  docker-compose.yml postgres + redis

frontend/
  src/
    pages/           RestaurantsPage, BookingPage, LoginPage, SignupPage, AdminLoginPage,
                      LookupPage, AdminPage
    components/
      booking/        BookingWizard, DateStrip, PartySizeStep, SlotGrid, GuestDetailsForm, ConfirmationCard
      auth/            RequireAuth
      layout/          SiteHeader
    hooks/            useAuth, useAvailability, useReservation
    lib/              api.ts (backend client), time.ts, auth-storage.ts
```

## How it works

Two restaurants are seeded for development, each a UI card on the landing page. A guest must create an account to book. Flow: pick a restaurant → pick a date (max 7 days ahead) → pick a party size (≤2 → 2-seater tables, >2 → 4-seater) → the backend computes **real, live** per-slot availability by checking actual table/reservation overlap (no aggregate counters) → guest picks a time → confirms → the backend atomically locks and assigns a specific free table (`SELECT ... FOR UPDATE SKIP LOCKED` on `dining_table` rows), so concurrent bookings for the same slot can't oversell — proven by `backend/tests/test_concurrency.py` (40 concurrent requests for 5 tables → exactly 5 succeed, each on a distinct table).

Booking rules enforced server-side: a user may hold at most one active reservation per restaurant per day, and can't hold overlapping-time active reservations across different restaurants on the same day unless the earlier one was cancelled first.

Each restaurant has its own admin account (seeded, distinct credentials) that can only see and manage that restaurant's tables and reservations. Celery workers handle no-show sweeps and reminders.

## Setup & run

Prereqs: Python 3.11+, Node 18+, Docker (for Postgres + Redis).

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # fill in GEMINI_API_KEY if using AI note extraction

docker compose down -v          # full reset - schema changed (multi-restaurant, accounts, real table booking)
docker compose up -d            # starts postgres + redis
alembic upgrade head
python -m scripts.seed          # 2 restaurants, their tables, and one admin account each (credentials printed)

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

- `POST /api/auth/register` / `POST /api/auth/login` / `GET /api/auth/me`
- `GET  /api/restaurants` — list, for the restaurant selection cards
- `GET  /api/availability?restaurant_id=&day=YYYY-MM-DD&party_size=` — real per-slot free-table counts
- `POST /api/reservations` — atomic booking (auth required, `idempotency_key` required)
- `POST /api/reservations/{id}/cancel` (owner or that restaurant's admin) `|no-show|seat|complete|delay` (admin only)
- `POST /api/holds` / `DELETE /api/holds/{id}` — Redis TTL soft holds (advisory)
- `WS   /ws/availability/{restaurant_id}/{day}` — live free-count deltas, zero PII
- `GET  /api/admin/reservations?day=...`, `GET /api/admin/tables` — admin-only, scoped to the admin's own restaurant
- `POST /api/ai/extract-notes` — Gemini structured dietary/occasion extraction

## Config (backend/.env)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres async connection string |
| `REDIS_URL` | Redis for holds |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | Celery (separate Redis DBs) |
| `GEMINI_API_KEY` | Gemini API key for AI note extraction |
| `JWT_SECRET` | Signing secret for auth tokens |
| `JWT_EXPIRE_MINUTES` | Access token lifetime |
| `RESTAURANT_TIMEZONE` | e.g. `Asia/Baku` (global service window, shared by all restaurants) |
| `SERVICE_OPEN_TIME` / `SERVICE_CLOSE_TIME` | daily service window |
| `BUCKET_MINUTES` | slot granularity |
| `DINE_DURATION_MINUTES` / `BUFFER_MINUTES` | seating duration + turnover buffer |
| `MAX_PARTY_SIZE` | max guests per booking |
| `BOOKING_MAX_DAYS_AHEAD` | how far ahead a reservation can be made (default 7) |
| `HOLD_TTL_SECONDS` | how long a soft hold reserves a slot |
| `NO_SHOW_GRACE_MINUTES` | grace period before auto no-show |
| `TABLES_2_SEATER_COUNT` / `TABLES_4_SEATER_COUNT` | seed table counts, per restaurant |

# ITB Reservation

## Purpose

A multi-restaurant table reservation system. Customers register, choose a restaurant, inspect live table availability, and make reservations. Restaurant admins manage tables and reservations for their own restaurant.

## Stack

- Backend: FastAPI, async SQLAlchemy 2, PostgreSQL, Alembic
- Auth: JWT access tokens with bcrypt password hashing
- Coordination: Redis for advisory TTL holds and WebSocket fanout
- Background work: Celery worker and beat for reminders and no-show sweeps
- AI: Google Gemini structured note extraction
- Frontend: React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4, Framer Motion, Phosphor Icons
- Tests: pytest and pytest-asyncio

## Repository Map

### Backend

- `backend/app/main.py`: FastAPI app, CORS, router registration, `/health`
- `backend/app/api/routes/`: auth, restaurants, availability, reservations, holds, admin, AI, WebSocket routes
- `backend/app/api/deps.py`: authenticated user and restaurant-scoped admin dependencies
- `backend/app/core/`: settings, database sessions, Redis, JWT and password security
- `backend/app/models/`: restaurants, users, physical dining tables, reservations, events, enums
- `backend/app/schemas/`: Pydantic request and response contracts
- `backend/app/services/booking_service.py`: booking transaction, conflicts, status transitions, reminders, availability broadcasts
- `backend/app/services/availability_service.py`: live availability from physical table and reservation overlap
- `backend/app/services/hold_service.py`: Redis soft holds with TTL
- `backend/app/services/time_utils.py`: service window, slot, duration, and table-category rules
- `backend/app/workers/`: Celery app and scheduled tasks
- `backend/app/ws/`: WebSocket connection management
- `backend/alembic/`: database migrations
- `backend/scripts/seed.py`: development restaurant, table, and admin seed data
- `backend/tests/`: backend tests, including the concurrency proof

### Frontend

- `frontend/src/App.tsx`: routes and application shell
- `frontend/src/pages/`: customer, authentication, and admin screens
- `frontend/src/components/booking/`: booking wizard and its steps
- `frontend/src/components/auth/`: protected-route behavior
- `frontend/src/components/layout/`: shared navigation and layout
- `frontend/src/hooks/`: auth, availability, and reservation data hooks
- `frontend/src/lib/api.ts`: typed REST client and domain types
- `frontend/src/lib/auth-storage.ts`: access-token persistence
- `frontend/src/lib/time.ts`: frontend time formatting and slot helpers

## Local Development

Prerequisites: Python 3.11+, Node 18+, Docker, PostgreSQL, and Redis.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
docker compose up -d
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload --port 8000
```

Run the background processes in separate terminals:

```powershell
cd backend
.venv\\Scripts\\activate
celery -A app.workers.celery_app worker --loglevel=info --pool=solo
celery -A app.workers.celery_app beat --loglevel=info
```

Health check: `GET http://localhost:8000/health`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The Vite development server is normally available at `http://localhost:5173`. REST requests use the frontend API client and should target the running backend on port 8000 through the configured dev setup.

### Validation

```powershell
cd backend
pytest

cd ..\\frontend
npm run lint
npm run build
```

The concurrency test requires PostgreSQL and a disposable test database configured through `DATABASE_URL`.

## Product Rules

- Party sizes 1-2 map to `2_seater`; party sizes 3-4 map to `4_seater`.
- Reservations are limited to the configured service window and from today through `BOOKING_MAX_DAYS_AHEAD` days ahead.
- Only `booked` and `seated` reservations occupy a table.
- A customer can have at most one active reservation per restaurant per day.
- A customer cannot have overlapping active reservations at different restaurants on the same day.
- Every successful reservation is assigned to one active physical table.
- Admins can only view and mutate data belonging to their assigned restaurant.
- WebSocket availability updates contain counts only and must not expose guest or reservation PII.

## Engineering Guidance

- Treat `backend/app/services/booking_service.py` as the owner of booking invariants and reservation status transitions.
- Treat PostgreSQL row locking as the concurrency boundary. Do not replace it with aggregate counters or a read-then-write availability check.
- Keep business time calculations in the configured restaurant timezone; do not use server-local time for booking rules.
- Keep idempotency behavior intact for `POST /api/reservations`.
- Redis holds are advisory UX reservations, not the transactional source of capacity.
- Preserve restaurant scoping in admin endpoints through `get_current_admin` and explicit restaurant filters.
- Prefer focused backend tests for booking changes and `npm run build` plus lint for frontend changes.
- Use the root `README.md` as the current high-level product description. `backend/README.md` contains older inventory-bucket terminology and should not be treated as authoritative without checking the implementation.

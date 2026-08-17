# Restaurant Reservation Backend

FastAPI + SQLAlchemy async + PostgreSQL + Redis + Celery. Atomic table-bucket booking engine.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env

docker compose up -d          # postgres + redis
alembic upgrade head
python -m scripts.seed        # dining tables + 2 days of inventory buckets

uvicorn app.main:app --reload --port 8000
```

Celery (separate terminals):

```bash
celery -A app.workers.celery_app worker --loglevel=info --pool=solo
celery -A app.workers.celery_app beat --loglevel=info
```

## Tests

```bash
pytest
```

`tests/test_concurrency.py` proves the atomic ranged UPDATE: 5 four-seater tables,
40 concurrent booking attempts at 19:00, exactly 5 succeed. Requires Postgres running
and `DATABASE_URL` pointed at a disposable test database.

## Key endpoints

- `GET  /api/availability?day=YYYY-MM-DD` — bucket-level free counts
- `POST /api/reservations` — atomic booking (idempotency_key required)
- `POST /api/reservations/{id}/cancel|no-show|seat|complete|delay`
- `POST /api/holds` / `DELETE /api/holds/{id}` — Redis TTL soft holds
- `WS   /ws/availability/{day}` — live free-count deltas, zero PII
- `GET  /api/admin/reservations?day=...`, `GET /api/admin/tables`
- `POST /api/ai/extract-notes` — Gemini structured dietary/occasion extraction

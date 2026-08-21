# Claude Memory

## Verified Architecture

- `backend/app/services/booking_service.py` owns booking, conflict checks, status changes, delays, reversions, reminder scheduling, and availability broadcasts.
- Availability is calculated from physical `DiningTable` rows and overlapping reservations; there is no aggregate inventory counter in the current implementation.
- Booking selects one free table with PostgreSQL `FOR UPDATE SKIP LOCKED`. This is the protection against concurrent overselling.
- The concurrency proof sends 40 concurrent attempts against 5 four-seater tables and expects exactly 5 successes on distinct tables.
- Reservation idempotency keys are checked before booking and protected by the database; retries return the existing reservation.

## State And Rules

- Occupying statuses: `booked`, `seated`.
- Non-occupying statuses: `completed`, `cancelled`, `no_show`.
- Party-size mapping: 1-2 guests -> `2_seater`; 3-4 guests -> `4_seater`.
- Default service settings: Asia/Baku timezone, 12:00-23:00 service window, 60-minute slots, 90-minute dining duration, 15-minute buffer, 7-day booking horizon.
- Admins have `role=admin` and a non-null `restaurant_id`; every admin query and mutation must stay within that restaurant.
- A user may have one active reservation per restaurant per day and no overlapping active reservation at another restaurant that day.

## Infrastructure

- PostgreSQL stores users, restaurants, tables, reservations, and reservation events.
- Redis stores advisory soft holds with TTL and supports live availability fanout.
- Celery worker handles asynchronous jobs; Celery beat schedules periodic work.
- `backend/app/core/config.py` loads `.env` and provides development defaults. Never rely on the development JWT secret outside local development.

## Frontend Notes

- `frontend/src/lib/api.ts` is the typed REST boundary and currently uses `const BASE = ""` for same-origin requests.
- Auth uses a bearer token loaded from `auth-storage.ts`.
- Backend routes are mounted under `/api`; WebSocket availability uses `/ws` and includes restaurant ID and day in the path.
- Frontend scripts are `npm run dev`, `npm run build`, `npm run lint`, and `npm run preview`.

## Known Documentation Drift

- `backend/README.md` still describes inventory buckets and an atomic ranged UPDATE. Current code uses physical table rows and row locks.
- The root README mentions some files that are not present in the current frontend tree, including `LookupPage` and `GuestDetailsForm`.
- The current WebSocket route includes `{restaurant_id}/{day}`, unlike the older backend README example.
- Before changing behavior, verify the implementation and nearby tests instead of copying the older README model.

## Change Checklist

1. Find the owning service or route before editing.
2. Preserve timezone, idempotency, table-locking, and restaurant-scope invariants.
3. Add or update a focused test for booking behavior when practical.
4. Run the narrowest relevant validation, then the broader backend or frontend checks.

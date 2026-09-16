import json
import logging
from datetime import datetime, timedelta, timezone

from redis import from_url as redis_from_url
from sqlalchemy import text

from app.core.config import settings
from app.workers.celery_app import celery_app
from app.workers.db import SyncSessionLocal

logger = logging.getLogger(__name__)

# The Celery worker is synchronous, so it gets its own plain Redis client rather than the
# asyncio one the request path uses.
_sync_redis = None


def _redis():
    global _sync_redis
    if _sync_redis is None:
        _sync_redis = redis_from_url(settings.redis_url, decode_responses=True)
    return _sync_redis


@celery_app.task(name="app.workers.tasks.send_reminder")
def send_reminder(reservation_id: str, kind: str) -> None:
    """kind is '24h' or '2h'. Sends via email; here logged as the integration point."""
    with SyncSessionLocal() as session:
        row = session.execute(
            text("SELECT guest_name, guest_email, start_time, status FROM reservation WHERE id = :id"),
            {"id": reservation_id},
        ).first()
        if row is None or row.status != "booked":
            return
        logger.info(
            "Reminder(%s) to %s <%s> for reservation at %s", kind, row.guest_name, row.guest_email, row.start_time
        )


@celery_app.task(name="app.workers.tasks.flush_locations")
def flush_locations() -> int:
    """Drain the Redis ping buffer into `courier_location`.

    This is the other half of the rule that keeps pings off the database: the socket handler
    writes Redis and returns, and the durable write happens here, in batches, off the request
    path. Nothing in the live product reads this table, so falling a few seconds behind costs
    nothing a customer can see.

    The build guide reaches for psycopg `COPY` here. A batched multi-row INSERT is a fraction
    of a second at this volume and keeps the task in the same SQLAlchemy idiom as the rest of
    the workers; swap in COPY when a flush stops fitting in the interval.
    """
    redis = _redis()
    batch = []
    while len(batch) < 5000:
        item = redis.lpop("loc:buffer")
        if not item:
            break
        try:
            batch.append(json.loads(item))
        except json.JSONDecodeError:
            continue
    if not batch:
        return 0

    rows = [
        {
            "courier_id": p["c"],
            "order_id": p.get("o"),
            "recorded_at": datetime.fromtimestamp(p["t"], tz=timezone.utc),
            "lat": p["lat"],
            "lng": p["lng"],
            "accuracy_m": p.get("acc"),
            "speed_mps": p.get("s"),
            "heading": p.get("h"),
        }
        for p in batch
    ]
    with SyncSessionLocal() as session:
        session.execute(
            text(
                """
                INSERT INTO courier_location
                    (courier_id, order_id, recorded_at, lat, lng, accuracy_m, speed_mps, heading)
                VALUES
                    (:courier_id, :order_id, :recorded_at, :lat, :lng, :accuracy_m, :speed_mps, :heading)
                """
            ),
            rows,
        )
        session.commit()
    return len(rows)


@celery_app.task(name="app.workers.tasks.purge_old_locations")
def purge_old_locations() -> int:
    """Delete location history past the retention window.

    Where a courier was on a given evening is personal data about an employee, not business
    telemetry we get to keep forever. The window is configurable; deleting on a schedule is
    what makes the retention policy real rather than aspirational.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.tracking_location_retention_days)
    with SyncSessionLocal() as session:
        result = session.execute(
            text("DELETE FROM courier_location WHERE recorded_at < :cutoff"), {"cutoff": cutoff}
        )
        session.commit()
    return result.rowcount or 0


@celery_app.task(name="app.workers.tasks.sweep_no_shows")
def sweep_no_shows() -> int:
    """Runs every minute: any booked reservation past start_time + grace becomes a no_show.
    Availability is computed live from status, so nothing else needs to be freed here.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=settings.no_show_grace_minutes)
    marked = 0
    with SyncSessionLocal() as session:
        rows = session.execute(
            text("SELECT id FROM reservation WHERE status = 'booked' AND start_time < :cutoff"),
            {"cutoff": cutoff},
        ).fetchall()

        for row in rows:
            session.execute(
                text("UPDATE reservation SET status = 'no_show' WHERE id = :id"), {"id": row.id}
            )
            session.execute(
                text(
                    """
                    INSERT INTO reservation_event (reservation_id, event_type, payload)
                    VALUES (:id, 'status_changed', :payload)
                    """
                ),
                {"id": row.id, "payload": '{"status": "no_show", "source": "auto_sweep"}'},
            )
            marked += 1
        session.commit()
    return marked

import logging
from datetime import datetime, timedelta

from sqlalchemy import text

from app.core.config import settings
from app.workers.celery_app import celery_app
from app.workers.db import SyncSessionLocal

logger = logging.getLogger(__name__)


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

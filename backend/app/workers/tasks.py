import logging
from datetime import date, datetime, timedelta

from sqlalchemy import text

from app.core.config import settings
from app.workers.celery_app import celery_app
from app.workers.db import SyncSessionLocal

logger = logging.getLogger(__name__)

CATEGORY_COLUMN = {"2_seater": "tables_2_free", "4_seater": "tables_4_free"}


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
    """Runs every minute: any booked reservation past start_time + grace becomes a no_show,
    freeing its remaining table-buckets back to inventory."""
    cutoff = datetime.utcnow() - timedelta(minutes=settings.no_show_grace_minutes)
    marked = 0
    with SyncSessionLocal() as session:
        rows = session.execute(
            text(
                """
                SELECT id, table_category, start_time, end_time
                FROM reservation
                WHERE status = 'booked' AND start_time < :cutoff
                """
            ),
            {"cutoff": cutoff},
        ).fetchall()

        for row in rows:
            column = CATEGORY_COLUMN[row.table_category]
            session.execute(
                text(
                    f"""
                    UPDATE inventory_bucket
                    SET {column} = {column} + 1,
                        arrivals_count = GREATEST(arrivals_count - 1, 0)
                    WHERE bucket_time >= :start_time AND bucket_time < :end_time
                    """
                ),
                {"start_time": row.start_time, "end_time": row.end_time},
            )
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


@celery_app.task(name="app.workers.tasks.seed_tomorrow")
def seed_tomorrow() -> None:
    import asyncio

    from app.core.db import AsyncSessionLocal
    from app.services.inventory_service import seed_day

    async def _run() -> None:
        async with AsyncSessionLocal() as session:
            await seed_day(session, date.today() + timedelta(days=1))

    asyncio.run(_run())

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "reservations",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.beat_schedule = {
    "auto-no-show-sweep": {
        "task": "app.workers.tasks.sweep_no_shows",
        "schedule": 60.0,
    },
    # Drains the Redis ping buffer into Postgres. Ten seconds keeps the buffer short enough
    # that a worker restart loses almost nothing, while still batching writes.
    "flush-courier-locations": {
        "task": "app.workers.tasks.flush_locations",
        "schedule": 10.0,
    },
    # Courier location history is personal data about an employee; it expires on a schedule.
    "purge-courier-locations": {
        "task": "app.workers.tasks.purge_old_locations",
        "schedule": 3600.0,
    },
}
celery_app.conf.timezone = settings.restaurant_timezone

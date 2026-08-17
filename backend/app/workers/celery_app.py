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
}
celery_app.conf.timezone = settings.restaurant_timezone

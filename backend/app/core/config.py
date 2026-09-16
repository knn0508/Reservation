from datetime import time

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/reservations"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    gemini_api_key: str = ""

    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 60 * 24 * 7

    restaurant_timezone: str = "Asia/Baku"
    service_open_time: time = time(12, 0)
    service_close_time: time = time(23, 0)

    bucket_minutes: int = 60
    dine_duration_minutes: int = 90
    buffer_minutes: int = 15
    max_party_size: int = 4
    booking_max_days_ahead: int = 7
    hold_ttl_seconds: int = 300
    no_show_grace_minutes: int = 20

    # Online delivery: flat fee, waived above the threshold.
    delivery_fee: float = 3.0
    delivery_free_over: float = 40.0

    # Live courier tracking. Pings outside these bounds are dropped rather than shown: a
    # low-accuracy fix or a GPS jump reads as the marker teleporting across the city.
    tracking_ping_max_accuracy_m: float = 100.0
    tracking_ping_max_speed_mps: float = 40.0
    # No position key means no signal, so this TTL is also how long a courier stays "live".
    tracking_pos_ttl_seconds: int = 120
    tracking_ping_rate_per_minute: int = 60
    # Fallback pace for ETA when the courier is stopped; ~23 km/h in city traffic.
    tracking_avg_speed_mps: float = 6.5
    # Location history is personal data about an employee. Sweep it on a schedule.
    tracking_location_retention_days: int = 90

    tables_2_seater_count: int = 8
    tables_4_seater_count: int = 6

    @property
    def turn_buckets(self) -> int:
        span = self.dine_duration_minutes + self.buffer_minutes
        return -(-span // self.bucket_minutes)  # ceiling division: never undercover occupancy


settings = Settings()

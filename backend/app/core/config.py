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


    @property
    def turn_buckets(self) -> int:
        span = self.dine_duration_minutes + self.buffer_minutes
        return -(-span // self.bucket_minutes)  # ceiling division: never undercover occupancy


settings = Settings()

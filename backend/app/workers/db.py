from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
sync_engine = create_engine(sync_url, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, class_=Session, expire_on_commit=False)

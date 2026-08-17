import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.db import Base
from app.models.restaurant import Restaurant


@pytest_asyncio.fixture
async def engine():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture
async def restaurant(session_factory):
    async with session_factory() as session:
        r = Restaurant(slug="test-restaurant", name="Test Restaurant")
        session.add(r)
        await session.commit()
        await session.refresh(r)
        return r

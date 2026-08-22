"""Tests run against a separate `<db>_test` database, created and migrated on demand.

Pointing them at the dev DB would mean `pytest` silently truncating the seeded
demo data, so the URL is swapped before anything imports Settings.
"""

import os

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

_dev_url = make_url({**dotenv_values(".env"), **os.environ}["DATABASE_URL"])
_test_url = _dev_url.set(database=f"{_dev_url.database}_test")
os.environ["DATABASE_URL"] = _test_url.render_as_string(hide_password=False)
os.environ["DEBUG"] = "true"  # /auth/forgot-password returns the token instead of mailing it

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

import app.models  # noqa: E402, F401  -- populates Base.metadata
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
async def _schema():
    admin_url = _dev_url.set(database="postgres").render_as_string(hide_password=False)
    admin = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": _test_url.database}
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{_test_url.database}"'))
    await admin.dispose()

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_tables(_schema):
    tables = ", ".join(f'"{t}"' for t in Base.metadata.tables)
    async with SessionLocal() as db:
        await db.execute(text(f"TRUNCATE {tables} CASCADE"))
        await db.commit()


@pytest.fixture
async def client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def register_payload():
    return {"name": "Ada", "email": "Ada@Example.com", "password": "hunter2hunter2"}


@pytest.fixture
async def auth(client, register_payload):
    """Registered user + a ready-made Authorization header."""
    r = await client.post("/api/v1/auth/register", json=register_payload)
    assert r.status_code == 201, r.text
    data = r.json()["data"]
    return {
        "user": data["user"],
        "tokens": data["tokens"],
        "headers": {"Authorization": f"Bearer {data['tokens']['access_token']}"},
    }


@pytest.fixture
async def catalog():
    """A small, exact catalog: 3 active cities + 1 soft-deleted, 5 active
    activities + 1 soft-deleted. Small enough that every filter assertion can
    name the precise rows it expects."""
    from decimal import Decimal

    from app.models.catalog import Activity, ActivityCategory, City

    cities = {
        "paris": City(
            name="Paris", country="France", region="Europe", cost_index=78,
            popularity_score=98, latitude=Decimal("48.856600"),
            longitude=Decimal("2.352200"), description="Boulevards and museums.",
        ),
        "prague": City(
            name="Prague", country="Czechia", region="Europe", cost_index=48,
            popularity_score=84, description="Gothic spires.",
        ),
        "bangkok": City(
            name="Bangkok", country="Thailand", region="Asia", cost_index=30,
            popularity_score=92, description="Night markets.",
        ),
        "retired": City(
            name="Retired City", country="Nowhere", cost_index=10,
            popularity_score=5, is_active=False,
        ),
    }
    async with SessionLocal() as db:
        db.add_all(cities.values())
        await db.flush()
        ids = {k: c.id for k, c in cities.items()}
        activities = {
            "louvre": Activity(
                city_id=ids["paris"], name="Louvre Museum Pass",
                category=ActivityCategory.CULTURE, estimated_cost=Decimal("22.00"),
                currency="USD", duration_minutes=180, description="Skip the queue.",
            ),
            "seine": Activity(
                city_id=ids["paris"], name="Seine River Cruise",
                category=ActivityCategory.SIGHTSEEING, estimated_cost=Decimal("18.50"),
                currency="USD", duration_minutes=60,
            ),
            "castle": Activity(
                city_id=ids["prague"], name="Prague Castle Tour",
                category=ActivityCategory.SIGHTSEEING, estimated_cost=Decimal("15.00"),
                currency="USD", duration_minutes=120,
            ),
            "streetfood": Activity(
                city_id=ids["bangkok"], name="Street Food Crawl",
                category=ActivityCategory.FOOD, estimated_cost=Decimal("12.00"),
                currency="USD", duration_minutes=180,
            ),
            "biketour": Activity(
                city_id=ids["bangkok"], name="Temple Bike Tour",
                category=ActivityCategory.ADVENTURE, estimated_cost=Decimal("30.00"),
                currency="USD", duration_minutes=240,
            ),
            "retired": Activity(
                city_id=ids["bangkok"], name="Retired Tour",
                category=ActivityCategory.SIGHTSEEING, estimated_cost=Decimal("99.00"),
                currency="USD", duration_minutes=60, is_active=False,
            ),
        }
        db.add_all(activities.values())
        await db.commit()
        return {
            "cities": ids,
            "activities": {k: a.id for k, a in activities.items()},
        }

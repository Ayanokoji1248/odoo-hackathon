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

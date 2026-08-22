# GlobeTrotter — Backend

FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16.
Spec: [PRD.md](PRD.md) · Phased plan: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · **Debugging docs: [docs/](docs/README.md)**

**Status:** Phases 1 (foundation), 2 (auth & users) and 3 (catalog) complete.

## Run

```bash
docker compose up -d db                    # Postgres 16 on host port 5433
cp .env.example .env                       # then set JWT_SECRET
py -3.12 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe -m app.db.seed          # 54 cities, 324 activities, demo user
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Demo login: `demo@globetrotter.app` / `demo12345`

## Checks

```bash
./.venv/Scripts/python.exe -m pytest -q
./.venv/Scripts/python.exe -m ruff check .
```

Tests create and use a separate `globetrotter_test` database, so `pytest` never
truncates dev data.

## Migrations

```bash
./.venv/Scripts/python.exe -m alembic revision --autogenerate -m "add users"
./.venv/Scripts/python.exe -m alembic upgrade head
```

New models must be imported in `app/models/__init__.py` or autogenerate won't see them.

## Notes

- Host port **5433** for the container — a local Postgres already owns 5432 on this machine.
- `Settings` is instantiated at import: the app refuses to boot without `DATABASE_URL` and `JWT_SECRET`.
- No mailer is configured: `/auth/forgot-password` returns the reset token in the response while `DEBUG=true`, and logs it otherwise.
- Every response uses the envelope from `app/core/schemas.py`; every error goes through the handlers in `app/core/exceptions.py`.

# GlobeTrotter Backend

FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16.
Spec: [PRD.md](PRD.md) | Phased plan: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Debugging docs: [docs/](docs/README.md)

**Status:** Phases 1 (foundation), 2 (auth & users), 3 (catalog), and the Phase 4 production-auth retrofit are complete.

## Run

```bash
docker compose up -d db
cp .env.example .env
py -3.12 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe -m app.db.seed
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

New models must be imported in `app/models/__init__.py` or autogenerate will not
see them.

## Notes

- Python 3.12 only. If a running server holds `python.exe`, stop it before
  recreating the venv.
- Host port 5433 for the container; a local Postgres already owns 5432 on this
  machine.
- `Settings` is instantiated at import: the app refuses to boot without
  `DATABASE_URL` and `JWT_SECRET`.
- Auth uses two `httpOnly` cookies. `gt_access` is a 15-minute JWT at `/`;
  `gt_refresh` is a 30-day rotating opaque token scoped to `/api/v1/auth`.
  Details in [docs/phase-4-production-auth.md](docs/phase-4-production-auth.md).
- Rate limiting and structured auth-event logging were skipped for hackathon
  scope.
- `COOKIE_SECURE=false` for local http; set it `true` in production.
- No mailer is configured: `/auth/forgot-password` returns the reset token in
  the response while `DEBUG=true`, and logs it otherwise.
- Every response uses the envelope from `app/core/schemas.py`; every error goes
  through the handlers in `app/core/exceptions.py`.

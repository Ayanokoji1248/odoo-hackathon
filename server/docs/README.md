# Backend Docs

One document per completed phase. Each one is written for debugging months later:
what landed, the exact contracts, the invariants that must stay true, and a
symptom to cause to check table for when something breaks.

| Phase | Doc | Covers |
|---|---|---|
| 1 | [phase-1-foundation.md](phase-1-foundation.md) | config, DB session, envelopes, exception handlers, Alembic wiring, `/health` |
| 2 | [phase-2-auth-and-users.md](phase-2-auth-and-users.md) | temporary cookie sessions, users, password reset, profile |
| 3 | [phase-3-catalog.md](phase-3-catalog.md) | cities and activities catalog, search/filter/pagination, saved destinations, seed data |
| 4 | [phase-4-production-auth.md](phase-4-production-auth.md) | JWT access cookie, rotating refresh cookie, session management |

Spec: [../PRD.md](../PRD.md) | Phase plan: [../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)

## Shared Debugging Entry Points

```bash
# is the DB up and reachable?
curl -s localhost:8000/health

# psql shell into the dev DB
docker exec -it globetrotter-db psql -U globetrotter -d globetrotter

# what migration is applied?
./.venv/Scripts/python.exe -m alembic current

# has the schema drifted from the models? (an empty upgrade() means no drift)
./.venv/Scripts/python.exe -m alembic revision --autogenerate -m "drift check"

# full suite, verbose, stop at first failure
./.venv/Scripts/python.exe -m pytest -x -vv

# reload the catalog (idempotent)
./.venv/Scripts/python.exe -m app.db.seed
```

Auth is now two httpOnly cookies: `gt_access` at `/` and `gt_refresh` at
`/api/v1/auth`. See [phase-4-production-auth.md](phase-4-production-auth.md).

Every response carries an `x-request-id` header; it is echoed from the request if
you send one. Grep logs by it when tracing a single call.

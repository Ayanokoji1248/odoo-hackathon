# Backend docs

One document per completed phase. Each one is written for **debugging months later**:
what landed, the exact contracts, the invariants that must stay true, and a
symptom → cause → check table for when something breaks.

| Phase | Doc | Covers |
|---|---|---|
| 1 | [phase-1-foundation.md](phase-1-foundation.md) | config, DB session, envelopes, exception handlers, Alembic wiring, `/health` |
| 2 | [phase-2-auth-and-users.md](phase-2-auth-and-users.md) | register/login/refresh/logout, password reset, profile, tokens, `get_current_user` |
| 3 | [phase-3-catalog.md](phase-3-catalog.md) | cities + activities catalog, search/filter/pagination, saved destinations, seed data |

Spec: [../PRD.md](../PRD.md) · Phase plan: [../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)

## Shared debugging entry points

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

Every response carries an `x-request-id` header; it is echoed from the request if
you send one. Grep logs by it when tracing a single call.

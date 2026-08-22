# Phase 1 — Foundation

Status: complete. Nothing domain-specific lives here — this is the boot path,
the response contracts, and the DB/migration wiring everything else sits on.

---

## 1. File map

| File | Purpose | Touch it when |
|---|---|---|
| [app/main.py](../app/main.py) | app object, CORS, request-id middleware, handler registration, router mount, `/health` | adding middleware or a root-level route |
| [app/core/config.py](../app/core/config.py) | `Settings` + the module-level `settings` singleton | adding an env var |
| [app/core/exceptions.py](../app/core/exceptions.py) | `ApiError` + the four exception handlers | adding an error code |
| [app/core/schemas.py](../app/core/schemas.py) | `ApiResponse[T]`, `PageMeta`, `ErrorBody` | changing the envelope |
| [app/core/pagination.py](../app/core/pagination.py) | `PaginationParams` / `Pagination` dependency | changing page limits |
| [app/db/base.py](../app/db/base.py) | `Base`, naming convention, `UUIDPkMixin`, `TimestampMixin` | adding a shared column pattern |
| [app/db/session.py](../app/db/session.py) | async engine, `SessionLocal`, `get_db` | changing pool or engine options |
| [app/api/v1/router.py](../app/api/v1/router.py) | the `/api/v1` aggregate router | mounting a new phase's routes |
| [alembic/env.py](../alembic/env.py) | migration environment, patched to read `Settings` | never, normally |
| [docker-compose.yml](../docker-compose.yml) | Postgres 16 | changing the DB image or port |

---

## 2. Boot sequence

Import order matters, and the failure modes differ by stage:

```
app.main
  └─ app.core.config      →  Settings()  ← raises here if an env var is missing
  └─ app.db.session       →  create_async_engine(settings.database_url)   (no connection yet)
  └─ app.core.exceptions  →  handlers registered on the app
  └─ app.api.v1.router    →  routes mounted
```

`Settings()` runs at **import time**, on purpose: a missing `DATABASE_URL` or
`JWT_SECRET` kills the process at startup rather than 500-ing the first request
that needs it.

`create_async_engine` does **not** connect. The first real connection happens on
the first request that uses `get_db` (or on `/health`). So a bad host or password
surfaces as a request-time error, not a boot error.

---

## 3. Config reference

Env vars are read from the process environment first, then `.env`.
Process env wins — that is how the test suite redirects to its own database.

| Env var | Type | Default | Effect |
|---|---|---|---|
| `DATABASE_URL` | str | **required** | `postgresql+asyncpg://user:pass@host:port/db` |
| `JWT_SECRET` | str | **required** | HMAC key for access tokens |
| `JWT_ALGORITHM` | str | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | `15` | also reported as `expires_in` (× 60) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | int | `7` | |
| `RESET_TOKEN_EXPIRE_MINUTES` | int | `30` | |
| `DEBUG` | bool | `false` | turns on SQLAlchemy `echo`, and makes `/auth/forgot-password` return the reset token |
| `CORS_ORIGINS` | str | `http://localhost:5173,http://localhost:3000` | comma-separated, read via `settings.cors_origin_list` |
| `APP_NAME` | str | `GlobeTrotter API` | OpenAPI title |
| `VERSION` | str | `0.1.0` | reported by `/health` |

`CORS_ORIGINS` is a comma-separated **string**, not a list. `pydantic-settings`
only parses complex types as JSON from the environment, and JSON inside a `.env`
file is a reliable source of confusing parse errors.

The driver must be `postgresql+asyncpg`. A bare `postgresql://` URL loads the
sync psycopg driver, which is not installed — you get an import error, not a
connection error.

---

## 4. Response contracts

### Success

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 57 } }
```

`meta` is `null` on non-paginated responses. The envelope is a real Pydantic
model (`ApiResponse[T]`) used as the return annotation, so it appears in
`/openapi.json` correctly — it is not bolted on by middleware.

Routes return `ApiResponse(data=...)`. They never return an ORM object directly,
which is why `password_hash` is structurally unable to leak into a response.

### Error

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid input",
  "details": [ { "field": "email", "message": "Invalid email" } ] } }
```

`details` is omitted entirely unless present. Codes and their default statuses:

| Code | Status | Raised by |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Pydantic body/query validation, and service-level rejections |
| `UNAUTHORIZED` | 401 | missing / bad / expired credentials |
| `FORBIDDEN` | 403 | authenticated but not allowed |
| `NOT_FOUND` | 404 | unknown route, or a missing/unowned resource |
| `CONFLICT` | 409 | uniqueness or state conflict |
| `RATE_LIMITED` | 429 | reserved for Phase 7 |
| `INTERNAL_ERROR` | 500 | anything unhandled |

### The four handlers

| Handler | Catches | Produces |
|---|---|---|
| `ApiError` | our own raises | the code and status carried on the exception |
| `RequestValidationError` | Pydantic 422s | 400 `VALIDATION_ERROR` with `details[]` |
| `StarletteHTTPException` | FastAPI's own 404/405/etc. | status mapped back to a code via `STATUS_CODE` |
| `Exception` | everything else | 500 `INTERNAL_ERROR`, full traceback logged |

Two consequences worth remembering:

- **FastAPI's default 422 never reaches the client.** Validation failures are
  400s here. If you see a raw 422, a route bypassed the handler chain.
- The `loc` tuple from Pydantic has its first element (`body` / `query` / `path`)
  stripped when building `field`, so `["body", "password"]` becomes `"password"`.

---

## 5. Database layer

`Base` carries a naming convention, so constraint and index names are
deterministic (`uq_users_email`, `fk_refresh_tokens_user_id_users`,
`ix_refresh_tokens_user_id`, `pk_users`). Autogenerate produces stable diffs
because of it — do not remove it, or the next migration will try to rename
every constraint in the schema.

Mixins:

| Mixin | Gives |
|---|---|
| `UUIDPkMixin` | `id uuid PK DEFAULT gen_random_uuid()` |
| `TimestampMixin` | `created_at` / `updated_at` `timestamptz DEFAULT now()`, `updated_at` refreshed via `onupdate` |

`gen_random_uuid()` is built into Postgres 13+, so no `pgcrypto` extension is
created despite what the PRD says.

`get_db` yields an `AsyncSession` per request and closes it after. `expire_on_commit=False`
means an object stays readable after `commit()` — without it, serializing a
just-committed model triggers a lazy refresh and raises `MissingGreenlet`.

Never lazy-load a relationship in a response path. Use `selectinload`.

---

## 6. Alembic wiring

`alembic/env.py` was patched in three ways:

1. `config.set_main_option("sqlalchemy.url", settings.database_url)` — the URL
   comes from `Settings`, so `alembic.ini` has no URL at all. One source of truth.
2. `import app.models` — **a model not imported there is invisible to
   autogenerate**, and its table silently never gets created. This is the single
   most common migration bug in this layout.
3. `compare_type=True` and `compare_server_default=True` — column type and
   default changes get detected instead of silently drifting.

`alembic/script.py.mako` was edited to emit `str | None` instead of
`Union[str, None]` so generated migrations pass ruff without a fixup pass.

Postgres native enums: `create_table` creates the enum type, but `drop_table`
does **not** drop it. Every migration that adds an enum must drop it explicitly
in `downgrade()`:

```python
sa.Enum(name="user_role").drop(op.get_bind())
```

Skip that and `alembic downgrade base && alembic upgrade head` fails the second
time with *"type user_role already exists"*.

---

## 7. `/health`

```json
{ "success": true, "data": { "status": "ok", "version": "0.1.0", "db": "ok" } }
```

It runs `SELECT 1`. A DB failure is **reported in the body, not raised** —
`db` becomes `"error: <ExceptionClassName>"` and the status stays 200. A health
endpoint that 500s tells a load balancer less than one that answers with detail.

So: `"db": "error: ..."` in a 200 response is the signal that Postgres is the problem.

---

## 8. Local setup facts

- Postgres runs in Docker on host port **5433**, not 5432 — a local Postgres
  service already owns 5432 on this machine. Connecting to 5432 gives
  `role "globetrotter" does not exist`, because you reached the wrong server.
- The app runs on the host, not in Compose. Only the DB is containerised.
- Python is **3.12** in `.venv`; the machine's default `python` is 3.14.
  Always invoke `./.venv/Scripts/python.exe -m <tool>`.

---

## 9. Debugging playbook

| Symptom | Likely cause | Check |
|---|---|---|
| `ValidationError` for `Settings` at startup | missing env var, or no `.env` | `cat .env`; compare against §3 |
| `ModuleNotFoundError: psycopg2` / dialect errors | `DATABASE_URL` missing `+asyncpg` | the driver prefix |
| `role "globetrotter" does not exist` | connected to the host's own Postgres | port must be 5433 |
| `connection refused` | container not running | `docker compose ps` |
| `/health` 200 but `"db": "error: ..."` | DB reachable check failed | the class name in the string names the cause |
| `MissingGreenlet` at serialization | lazy-load in an async path | add `selectinload` for that relationship |
| A new table never appears after `upgrade head` | model not imported in `app/models/__init__.py` | that file |
| Downgrade→upgrade fails: *type already exists* | enum not dropped in `downgrade()` | §6 |
| Autogenerate wants to rename every constraint | `NAMING_CONVENTION` changed or lost | `app/db/base.py` |
| Raw 422 instead of the error envelope | handler chain bypassed | that handlers are registered before routers in `main.py` |
| CORS blocked in the browser | origin not in the allowlist | `CORS_ORIGINS`, exact scheme + port |

---

## 10. Tests

[tests/test_health.py](../tests/test_health.py)

| Test | Guards |
|---|---|
| `test_health_returns_success_envelope` | envelope shape, `db: ok`, `x-request-id` present |
| `test_unknown_route_uses_error_envelope` | Starlette's 404 is translated to `NOT_FOUND` |

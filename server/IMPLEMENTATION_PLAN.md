# GlobeTrotter Backend — Implementation Plan

Derived from [PRD.md](PRD.md). Scope: `server/` only.

**Stack as built:** Python 3.12 · FastAPI · SQLAlchemy 2.0 async + asyncpg · PostgreSQL 16 (Docker) · Alembic · Pydantic v2

**Deviations from PRD (and why):**

| PRD | Built | Why |
|---|---|---|
| `uv` or Poetry | `venv` + `pip` + `requirements.txt` | `uv` not installed on this machine; pip is already here. Swap later if wanted — one file changes. |
| App in Docker | App on host, **Postgres in Docker** | Fastest inner loop. Compose still guarantees one identical DB for everyone. |
| `mypy` in CI | `ruff` only | No CI in a hackathon. Add mypy when there's a pipeline to run it in. |

**Ordering rule:** Phase 3 (catalog) ships before Phase 4 (trips) — it's the only data the frontend can't mock.

**Definition of done, every phase:** code + migration + tests + a debugging doc in
[docs/](docs/README.md). A phase without its doc is not finished.

| Phase | Doc |
|---|---|
| 1 | [docs/phase-1-foundation.md](docs/phase-1-foundation.md) |
| 2 | [docs/phase-2-auth-and-users.md](docs/phase-2-auth-and-users.md) |

---

## Phase 1 — Foundation ✅

Boot a server that connects to a real DB and answers with the standard envelope. Nothing domain-specific.

| File | Contents |
|---|---|
| `docker-compose.yml` | Postgres 16, named volume, healthcheck |
| `requirements.txt` | pinned deps |
| `.env.example` / `.env` | `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, … |
| `app/core/config.py` | `Settings(BaseSettings)` — validated at import, app refuses to boot on a missing var |
| `app/core/exceptions.py` | `ApiError` + 3 handlers (`ApiError`, `RequestValidationError`, `HTTPException`) |
| `app/core/schemas.py` | `ApiResponse[T]`, `PageMeta`, `ErrorBody` |
| `app/core/pagination.py` | `PaginationParams` dependency (page 1-based, limit ≤ 100) |
| `app/db/base.py` | `Base` + naming convention + `TimestampMixin` |
| `app/db/session.py` | async engine, `async_sessionmaker`, `get_db` |
| `app/main.py` | app factory, CORS, request-id middleware, handler registration, router mount, `/health` |
| `alembic/` + `alembic.ini` | async env.py wired to `Settings` + `Base.metadata` |
| `tests/test_health.py` | one `httpx.AsyncClient` smoke test |

**Done when:** `GET /health` → `{"success":true,"data":{"status":"ok","version":"...","db":"ok"}}`, `/docs` renders, a forced error returns the error envelope, `alembic upgrade head` runs clean on an empty DB.

---

## Phase 2 — Auth & users ✅

| Area | Built |
|---|---|
| Models | `users`, `refresh_tokens`, `password_reset_tokens` — `citext` extension in the first migration; `gen_random_uuid()` needs no `pgcrypto` on PG 13+ |
| Security | `app/core/security.py` — bcrypt hash/verify, JWT encode/decode, access 15 min / refresh 7 d |
| Deps | `app/deps.py` — `get_current_user`, `require_admin` |
| Routes | `/auth/{register,login,refresh,logout,forgot-password,reset-password,me}`, `/users/me` (PATCH · password · DELETE) |
| Service | `auth_service.py` — refresh rotation (revoke old row, insert new), password change and reset revoke **all** refresh tokens |
| Tests | 18 route-level tests against an isolated `<db>_test` database |

Refresh and reset tokens are stored as **sha256 hashes**, not bcrypt — they already carry 256 bits of entropy, and bcrypt's work factor exists to slow guessing of low-entropy passwords.

**Deferred:** saved-destinations moves to Phase 3 (it needs `cities`); no mailer is wired up, so `/auth/forgot-password` returns the reset token in the response when `DEBUG=true` and logs it otherwise.

**Done — AC 1.** Register → login → refresh → logout round-trips; a rotated refresh token 401s on reuse; `/auth/me` 401s without a token; a used or expired reset token is rejected; deleting an account leaves no orphan token rows.

---

## Phase 3 — Catalog

| Area | Work |
|---|---|
| Models | `cities`, `activities`, `activity_category` enum, `saved_destinations` |
| Routes | `/users/me/saved-destinations` (GET · POST · DELETE) — deferred from Phase 2 |
| Migration | trigram indexes (`pg_trgm`), `UNIQUE (name, country)`, cost-index CHECK |
| Seed | `app/db/seed.py` — ≥ 40 cities, ≥ 200 activities, idempotent (upsert on natural key) |
| Routes | `GET /cities`, `/cities/{id}`, `/cities/popular`, `GET /activities`, `/activities/{id}` — all public |
| Service | `catalog_service.py` — search/filter/sort/paginate in SQL, not Python |

**Done when:** AC 9. `?search=par` hits the trigram index; saved-destinations CRUD works.

---

## Phase 4 — Trips & itinerary

| Area | Work |
|---|---|
| Models | `trips`, `trip_stops`, `trip_activities` (deferrable `UNIQUE (trip_id, order_index)`) |
| Deps | `get_owned_trip` — the single authorization gate for the whole nested subtree |
| Routes | trips CRUD + `/cover` + `/duplicate`; stops CRUD + reorder; trip-activities CRUD + reorder |
| Service | `trip_service.py` — date-range validation, overlap `warnings[]`, delete-and-reindex, full-set reorder in one transaction, snapshot name/category/cost on add |
| Query | `GET /trips/{id}` via `selectinload(Trip.stops).selectinload(TripStop.activities)` |

Shrinking a trip's dates while stops sit outside → `409` listing offenders. Never silently orphan.

**Done when:** AC 2, 3, 4, 6.

---

## Phase 5 — Budget & dashboard

| Area | Work |
|---|---|
| Models | `budget_items`, `budget_category` enum |
| Service | `budget_service.py` — two grouped `select`s (activities, budget items), merged in Python; `generate_series` LEFT JOIN for the gap-free per-day series; per-city rollup through stops; `avg_per_day`; over-budget flag at `avg × 1.5`; activity costs × `travelers` |
| Routes | `GET /trips/{id}/budget`, budget-items CRUD, `GET /dashboard` (one call: next 3 trips, counts, popular cities, nearest-trip budget) |

Money is `Decimal` end to end. No floats, no denormalized totals column.

**Done when:** AC 5 — breakdown matches a hand calculation.

---

## Phase 6 — Sharing & admin

| Area | Work |
|---|---|
| Sharing | `POST/DELETE /trips/{id}/share` (`secrets.token_urlsafe(10)`), `GET /public/trips/{slug}` (no auth, 404 on non-public — never 403), `POST /public/trips/{slug}/copy` |
| Copy | Deep copy trip → stops → activities → budget items in one transaction; dates rebased to today or client `start_date` preserving offsets; `is_public=false`, no slug, `copied_from_trip_id` set |
| Admin | `require_admin` at **router** level; `/admin/stats`, `/admin/cities/top`, `/admin/activities/top`, `/admin/users` (+ PATCH role/is_active), catalog CRUD with soft delete |

**Done when:** AC 7, 8. Public payload exposes no owner PII beyond display name.

---

## Phase 7 — Hardening

- `slowapi`: 5/min on `/auth/login` + `/auth/forgot-password`, 100/min global
- `structlog` JSON + request-id; assert no passwords/tokens in log output
- Upload guard: ≤ 5 MB, content-type **sniffed** not trusted, jpeg/png/webp only
- pytest on the critical paths: ownership (403/404), date validation, reorder, budget math, cascade-delete orphan check (AC 11)
- Deploy: Render/Railway/Fly + Neon/Supabase; `alembic upgrade head` on release; seeded demo account
- OpenAPI tidy-up: tags, summaries, examples (AC 10)

---

## Cut order if time runs short

admin analytics → copy trip → per-city budget rollup.

**Never cut:** ownership checks, date validation. Those are what gets poked at.

---

## Resolved open questions (§11)

1. **Currency** — per-trip, no FX in v1.
2. **Inter-stop transport** — `TRANSPORT` budget item, not an entity.
3. **Activity costs** — per-person; multiplied by `travelers` in `budget_service`, and the response says so.
4. **Copied trips** — keep `copied_from_trip_id`; the "N copies" stat is a Phase 6 extra only if time allows.

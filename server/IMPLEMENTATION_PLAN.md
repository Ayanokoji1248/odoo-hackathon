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
| 3 | [docs/phase-3-catalog.md](docs/phase-3-catalog.md) |
| 4 auth retrofit | [docs/phase-4-production-auth.md](docs/phase-4-production-auth.md) |

---

## Phase 1 — Foundation ✅

Boot a server that connects to a real DB and answers with the standard envelope. Nothing domain-specific.

| File | Contents |
|---|---|
| `docker-compose.yml` | Postgres 16, named volume, healthcheck |
| `requirements.txt` | pinned deps |
| `.env.example` / `.env` | `DATABASE_URL`, `CORS_ORIGINS`, `COOKIE_*`, … |
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

> Superseded for runtime auth by
> [docs/phase-4-production-auth.md](docs/phase-4-production-auth.md). This
> section records the temporary Phase 2 implementation.

| Area | Built |
|---|---|
| Models | `users`, `sessions`, `password_reset_tokens` — `citext` extension in the first migration; `gen_random_uuid()` needs no `pgcrypto` on PG 13+ |
| Security | `app/core/security.py` — bcrypt hash/verify, opaque token generation, sha256 token hashing |
| Deps | `app/deps.py` — `get_current_user`, `require_admin` |
| Routes | `/auth/{register,login,logout,forgot-password,reset-password,me}`, `/users/me` (PATCH · password · DELETE) |
| Service | `auth_service.py` — one session row per login; password change and reset **delete every** session for that user |
| Transport | **one opaque session token in one `httpOnly` cookie** (simplified after Phase 3, before Phase 4) |
| Tests | 20 route-level tests against an isolated `<db>_test` database |

Originally a JWT access token + rotating refresh token + signed double-submit CSRF
token. Simplified to a single DB-backed session cookie: `get_current_user` had to
read the user row anyway to check `is_active`, so the JWT's statelessness saved no
round trip while costing revocability — and `SameSite=lax` already blocks the
cross-site POST the CSRF token defended against. Logout and password changes now
kill sessions **immediately** rather than leaving access tokens valid for up to 15
more minutes, and the frontend needs no 401-refresh-retry interceptor. `pyjwt` was
dropped. Cookie `Secure`/`SameSite`/domain stay env-configurable.

> `COOKIE_SAMESITE=none` — a frontend on a genuinely different domain — re-opens
> CSRF and would require adding the token back. Prefer proxying `/api/*` from the
> frontend host so the deployment stays same-origin.

Session and reset tokens are stored as **sha256 hashes**, not bcrypt — they already carry 256 bits of entropy, and bcrypt's work factor exists to slow guessing of low-entropy passwords.

**Deferred:** saved-destinations moves to Phase 3 (it needs `cities`); no mailer is wired up, so `/auth/forgot-password` returns the reset token in the response when `DEBUG=true` and logs it otherwise; expired `sessions` / `password_reset_tokens` rows are never pruned.

**Done — AC 1.** Register → login → logout round-trips; a revoked or expired session token 401s; `/auth/me` 401s without a cookie; sessions are per-login and independent; a used or expired reset token is rejected; a credential change signs out every device; deleting an account leaves no orphan rows.

---

## Phase 3 — Catalog ✅

| Area | Built |
|---|---|
| Models | `cities`, `activities`, `activity_category` enum, `saved_destinations` |
| Migration | `pg_trgm` + GIN trigram indexes, `UNIQUE (name, country)`, cost-index CHECK, `ON DELETE RESTRICT` on `activities.city_id` |
| Seed | **54 cities, 324 activities**, demo account — idempotent upsert on natural keys |
| Routes | `GET /cities`, `/cities/popular`, `/cities/{id}`, `GET /activities`, `/activities/{id}` (public) + `/users/me/saved-destinations` GET · POST · DELETE |
| Service | `catalog_service.py` — filter/sort/paginate in SQL; LIKE wildcards escaped so user input can't become a query operator |
| Tests | 23 new (41 total) |

Catalog rows are removed with `is_active = false`, never `DELETE` — Phase 4 trips
snapshot them. Hidden rows return 404, and every public read applies the filter.

**Catalog is single-currency (`USD`).** No FX in v1, so seeding local currencies
would let the Phase 5 budget sum VND and CHF into one total.

**Also this phase:** `SQL_ECHO` split out of `DEBUG` — `DEBUG=true` was dumping
every statement, which made the seed output unreadable.

**Done — AC 9.** Filtered, paginated, correctly-ordered results; `meta.total` is the
full match count; the trigram index is verified usable via `SET enable_seqscan = off`.

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

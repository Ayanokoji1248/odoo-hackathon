# GlobeTrotter — Backend PRD

**Product:** GlobeTrotter — Personalized Multi-City Travel Planner
**Scope of this document:** Backend / API only
**Stack:** Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · PostgreSQL 16 · Alembic
**Version:** 2.0 · Status: Draft for build

---

## 1. Purpose & Scope

The backend is the system of record for users, trips, stops, activities and budgets. It exposes a versioned REST API (`/api/v1`) consumed by the web/mobile client.

**In scope**

- Authentication, session management, password reset
- Trip CRUD and multi-city itinerary construction (stops → activities)
- City and activity catalog with search + filters
- Budget computation and cost breakdown aggregation
- Public sharing of itineraries and "copy trip"
- User profile, preferences, saved destinations
- Admin analytics endpoints

**Out of scope (v1)**

- Real bookings, payments, or third-party inventory (flights/hotels)
- Live currency conversion (store currency code, no FX)
- Realtime collaborative editing (websockets)
- Push notifications / email campaigns (only transactional password reset)

---

## 2. Users & Roles

| Role | Capabilities |
|---|---|
| `GUEST` | Read public itineraries via share link, browse city/activity catalog |
| `USER` | Everything guest can do + full CRUD on own trips, profile, saved destinations |
| `ADMIN` | Everything user can do + analytics endpoints, user management, catalog management |

Authorization rule: a user may only read/write a trip where `trip.user_id == current_user.id`, unless the trip is public and the request is read-only. Enforced by a `get_owned_trip` dependency, not by ad-hoc checks inside route handlers.

---

## 3. Technical Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Language | Python 3.12 | Type hints throughout, `mypy` in CI |
| Framework | FastAPI + Uvicorn | Async, dependency injection, OpenAPI docs for free |
| DB | PostgreSQL 16 | Relational modelling is an explicit requirement of the brief |
| ORM | SQLAlchemy 2.0 async + `asyncpg` | Mature, typed `Mapped[]` models, real control over queries |
| Migrations | Alembic | Autogenerate from models, versioned schema |
| Validation | Pydantic v2 schemas | Request/response contracts double as OpenAPI docs |
| Config | `pydantic-settings` | `.env` validated at import — fail fast on missing vars |
| Auth | JWT access (15 min) + refresh (7 d, stored hashed in DB) | Stateless reads, revocable sessions |
| Hashing | `passlib[bcrypt]` or `argon2-cffi` | Standard |
| Uploads | `python-multipart` → Cloudinary/S3; store URL only | DB stays lean |
| Rate limiting | `slowapi` | Protects auth endpoints |
| Logging | `structlog` + request-id middleware | Debuggable in demo |
| Testing | `pytest` + `pytest-asyncio` + `httpx.AsyncClient` | Route-level integration tests |
| Tooling | `uv` (or Poetry), `ruff`, `mypy` | Fast installs, one linter |
| Docs | Auto OpenAPI at `/docs` and `/redoc` | Zero effort; unblocks frontend on day one |

> **Fit with the brief.** The problem statement requires "proper use of relational databases to store and retrieve complex travel data." This design satisfies it directly: normalized tables, real foreign keys with `ON DELETE CASCADE`, check constraints, composite indexes, and SQL aggregation for the budget breakdown rather than in-application loops. Call this out during judging — it's a scored line.

### Project structure

```
app/
├── main.py                 FastAPI app, middleware, exception handlers, router mount
├── core/
│   ├── config.py           Settings (pydantic-settings)
│   ├── security.py         hashing, JWT encode/decode
│   ├── exceptions.py       ApiError + handlers
│   └── pagination.py       shared page/limit dependency
├── db/
│   ├── base.py             DeclarativeBase, naming convention
│   ├── session.py          async engine, async_sessionmaker, get_db dependency
│   └── seed.py             cities + activities + demo user
├── models/                 SQLAlchemy ORM models (one file per table group)
├── schemas/                Pydantic request/response models per module
├── api/v1/
│   ├── router.py           aggregates all routers
│   └── routes/             auth.py users.py trips.py stops.py activities.py
│                           cities.py budget.py share.py admin.py
├── services/               business logic: trip_service.py budget_service.py ...
├── deps.py                 get_current_user, require_admin, get_owned_trip
└── tests/
alembic/
```

**Layering rule:** *route (HTTP only) → service (business logic) → SQLAlchemy models.* Routes never build queries; services never touch `Request`/`Response`. Routes declare a `response_model` so FastAPI does the serialization and the OpenAPI schema stays honest.

**Async rule:** every DB call is `await`ed on an `AsyncSession`. No blocking libraries (`requests`, `psycopg2` sync) anywhere in the request path — one blocking call stalls the whole event loop.

---

## 4. Data Model

All tables use `UUID` primary keys (`gen_random_uuid()` via `pgcrypto`) and `created_at` / `updated_at` `timestamptz` columns defaulting to `now()`.

### 4.1 Tables

**users**

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | varchar(120) NOT NULL | |
| email | citext NOT NULL UNIQUE | `CREATE EXTENSION citext` for case-insensitive uniqueness |
| password_hash | text NOT NULL | never serialized — absent from every response schema |
| avatar_url | text NULL | |
| language | varchar(10) NOT NULL | default `'en'` |
| role | enum(`USER`, `ADMIN`) NOT NULL | default `USER` |
| is_active | boolean NOT NULL | default true; admin can disable |
| created_at / updated_at | timestamptz | |

**cities** — catalog, seeded

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | varchar(120) NOT NULL | |
| country | varchar(80) NOT NULL | |
| region | varchar(80) NULL | |
| latitude / longitude | numeric(9,6) NULL | |
| cost_index | smallint NOT NULL | 1–100, `CHECK (cost_index BETWEEN 1 AND 100)` |
| popularity_score | integer NOT NULL | default 0 |
| image_url / description | text NULL | |
| is_active | boolean NOT NULL | default true — soft delete for admin |

Indexes: `UNIQUE (name, country)`; `(country)`; `(popularity_score DESC)`; GIN trigram on `name` (`CREATE EXTENSION pg_trgm`) so `ILIKE '%par%'` search stays fast.

**activities** — catalog, seeded

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| city_id | uuid NOT NULL REFERENCES cities ON DELETE RESTRICT | |
| name | varchar(160) NOT NULL | |
| description | text NULL | |
| category | enum `activity_category` NOT NULL | SIGHTSEEING, FOOD, ADVENTURE, CULTURE, NIGHTLIFE, SHOPPING, RELAXATION, TRANSPORT |
| estimated_cost | numeric(10,2) NOT NULL | `CHECK (estimated_cost >= 0)` |
| currency | char(3) NOT NULL | ISO-4217 |
| duration_minutes | integer NULL | `CHECK (duration_minutes > 0)` |
| image_url | text NULL | |
| is_active | boolean NOT NULL | default true |

Indexes: `(city_id, category)`; `(estimated_cost)`; GIN trigram on `name`.

**trips**

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid NOT NULL REFERENCES users ON DELETE CASCADE | |
| name | varchar(160) NOT NULL | |
| description | text NULL | |
| start_date / end_date | date NOT NULL | `CHECK (end_date >= start_date)` |
| cover_photo_url | text NULL | |
| travelers | smallint NOT NULL | default 1, `CHECK (travelers >= 1)` |
| currency | char(3) NOT NULL | default `'USD'` — trip-level, no FX in v1 |
| is_public | boolean NOT NULL | default false |
| share_slug | varchar(16) NULL UNIQUE | |
| copied_from_trip_id | uuid NULL REFERENCES trips ON DELETE SET NULL | provenance for "copy trip" |

Indexes: `(user_id, start_date DESC)`; partial index `(share_slug) WHERE is_public` for the public lookup.

**trip_stops**

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid NOT NULL REFERENCES trips ON DELETE CASCADE | |
| city_id | uuid NOT NULL REFERENCES cities ON DELETE RESTRICT | |
| start_date / end_date | date NOT NULL | `CHECK (end_date >= start_date)` |
| order_index | integer NOT NULL | 0-based |
| notes | text NULL | |

Constraints: `UNIQUE (trip_id, order_index) DEFERRABLE INITIALLY DEFERRED` — lets a reorder rewrite every row inside one transaction without tripping the constraint mid-update. Stop dates falling inside the trip range is a service-level check (Postgres can't express it as a simple `CHECK`).
Index: `(trip_id, order_index)`.

**trip_activities**

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| trip_stop_id | uuid NOT NULL REFERENCES trip_stops ON DELETE CASCADE | |
| activity_id | uuid NULL REFERENCES activities ON DELETE SET NULL | null = custom activity |
| name | varchar(160) NOT NULL | snapshot of catalog name, or user-supplied |
| category | enum `activity_category` NULL | snapshot |
| scheduled_date | date NOT NULL | |
| start_time | time NULL | |
| duration_minutes | integer NULL | |
| cost | numeric(10,2) NOT NULL | snapshot of catalog cost, editable, `CHECK (cost >= 0)` |
| order_index | integer NOT NULL | ordering within a day |
| notes | text NULL | |

**Costs and names are snapshotted at add time.** An admin editing a seeded price must never silently change a saved trip's budget, and deleting a catalog activity must not blank out someone's itinerary — hence `ON DELETE SET NULL` plus the local `name`.
Index: `(trip_stop_id, scheduled_date, order_index)`.

**budget_items** — manual costs outside activities

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid NOT NULL REFERENCES trips ON DELETE CASCADE | |
| trip_stop_id | uuid NULL REFERENCES trip_stops ON DELETE SET NULL | optional attribution to a city |
| category | enum `budget_category` NOT NULL | TRANSPORT, ACCOMMODATION, MEALS, ACTIVITIES, MISC |
| label | varchar(160) NOT NULL | |
| amount | numeric(10,2) NOT NULL | `CHECK (amount >= 0)` |
| incurred_on | date NULL | |

Index: `(trip_id, incurred_on)`.

**saved_destinations** — `user_id` (FK cascade), `city_id` (FK cascade), `created_at`; PK `(user_id, city_id)`.

**password_reset_tokens** — `id`, `user_id` (FK cascade), `token_hash` (unique), `expires_at`, `used_at NULL`. Store only the hash; the raw token goes in the email link.

**refresh_tokens** — `id`, `user_id` (FK cascade), `token_hash` (unique), `expires_at`, `revoked_at NULL`, `user_agent`. Index `(user_id)`.

### 4.2 Relationships

```
User 1──* Trip 1──* TripStop 1──* TripActivity *──1 Activity *──1 City
             └──* BudgetItem                     TripStop *──1 City
User *──* City  (saved_destinations)
Trip 0..1──* Trip  (copied_from_trip_id, self-referencing)
```

### 4.3 Query notes

- `GET /trips/{id}` loads the full tree with `selectinload(Trip.stops).selectinload(TripStop.activities)` — three queries, no N+1. Never lazy-load in async SQLAlchemy; it raises `MissingGreenlet` at serialization time and looks like a mystery 500.
- Money columns are `numeric` → Python `Decimal`. Never `float`. Pydantic serializes `Decimal` to a JSON string; keep it that way so cents don't drift.
- Enum types are native Postgres enums created by Alembic. Adding a value later needs an explicit `ALTER TYPE` migration — decide the full category list now.

---

## 5. API Surface (`/api/v1`)

FastAPI path-parameter syntax used throughout.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | name, email, password → user + tokens |
| POST | `/auth/login` | — | email, password → tokens |
| POST | `/auth/refresh` | refresh | new access token, rotates refresh |
| POST | `/auth/logout` | user | revoke refresh token |
| POST | `/auth/forgot-password` | — | always 200 (no user enumeration) |
| POST | `/auth/reset-password` | — | token + new_password |
| GET | `/auth/me` | user | current user profile |

### Users
| Method | Path | Description |
|---|---|---|
| PATCH | `/users/me` | update name, avatar, language |
| PATCH | `/users/me/password` | current_password + new_password; revokes all refresh tokens |
| DELETE | `/users/me` | delete account (cascades) |
| GET | `/users/me/saved-destinations` | list |
| POST | `/users/me/saved-destinations` | `{ city_id }` |
| DELETE | `/users/me/saved-destinations/{city_id}` | remove |

### Trips
| Method | Path | Description |
|---|---|---|
| POST | `/trips` | create trip |
| GET | `/trips` | own trips; `?status=upcoming\|ongoing\|past&search=&page=&limit=&sort=` |
| GET | `/trips/{trip_id}` | full trip incl. stops + activities |
| PATCH | `/trips/{trip_id}` | update fields |
| DELETE | `/trips/{trip_id}` | delete |
| POST | `/trips/{trip_id}/cover` | multipart upload |
| POST | `/trips/{trip_id}/duplicate` | clone into own account |

### Stops
| Method | Path | Description |
|---|---|---|
| POST | `/trips/{trip_id}/stops` | add stop (city_id, dates) |
| GET | `/trips/{trip_id}/stops` | ordered list |
| PATCH | `/trips/{trip_id}/stops/{stop_id}` | update city/dates/notes |
| DELETE | `/trips/{trip_id}/stops/{stop_id}` | delete + reindex remaining |
| PATCH | `/trips/{trip_id}/stops/reorder` | `{ order: [stop_id, ...] }` in one transaction |

### Trip activities
| Method | Path | Description |
|---|---|---|
| POST | `/trips/{trip_id}/stops/{stop_id}/activities` | add from catalog or custom |
| PATCH | `/trips/{trip_id}/stops/{stop_id}/activities/{item_id}` | time, cost, date, notes |
| DELETE | `/trips/{trip_id}/stops/{stop_id}/activities/{item_id}` | remove |
| PATCH | `/trips/{trip_id}/stops/{stop_id}/activities/reorder` | reorder within a day |

Nesting every path under its trip means one `get_owned_trip` dependency authorizes the whole subtree — no chance of forgetting an ownership check on a leaf route.

### Catalog (public reads)
| Method | Path | Description |
|---|---|---|
| GET | `/cities` | `?search=&country=&region=&max_cost_index=&sort=popularity&page=&limit=` |
| GET | `/cities/{city_id}` | detail |
| GET | `/cities/popular` | dashboard block |
| GET | `/activities` | `?city_id=&category=&min_cost=&max_cost=&max_duration=&search=` |
| GET | `/activities/{activity_id}` | detail |

### Budget
| Method | Path | Description |
|---|---|---|
| GET | `/trips/{trip_id}/budget` | totals, by category, per-day, per-city, avg/day, over-budget days |
| POST | `/trips/{trip_id}/budget-items` | add manual cost |
| PATCH | `/trips/{trip_id}/budget-items/{item_id}` | update |
| DELETE | `/trips/{trip_id}/budget-items/{item_id}` | delete |

### Sharing
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/trips/{trip_id}/share` | owner | set `is_public=true`, generate `share_slug` |
| DELETE | `/trips/{trip_id}/share` | owner | unpublish |
| GET | `/public/trips/{slug}` | none | read-only itinerary + budget summary |
| POST | `/public/trips/{slug}/copy` | user | copy into own trips, sets `copied_from_trip_id` |

### Dashboard
`GET /dashboard` → upcoming trips (next 3), trip counts, popular cities, budget highlight for the nearest trip. One call so the home screen doesn't fan out into six requests.

### Admin
`GET /admin/stats` — users, trips, avg stops/trip, trips created over time
`GET /admin/cities/top`, `GET /admin/activities/top`
`GET /admin/users` (paginated, search), `PATCH /admin/users/{user_id}` (role / is_active)
`POST|PATCH|DELETE /admin/cities`, `/admin/activities` — catalog management (soft delete via `is_active`)

All admin routes sit behind a `require_admin` dependency applied at the router level, not per-endpoint.

### Health
`GET /health` → `{ status, version, db: "ok" }` — runs `SELECT 1`.

---

## 6. Cross-Cutting Contracts

**Success envelope**

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 57 } }
```

Implemented as a generic `ApiResponse[T](BaseModel, Generic[T])` used as `response_model`, so the envelope appears correctly in the OpenAPI schema instead of being bolted on by middleware.

**Error envelope**

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "field": "email", "message": "Invalid email" }] } }
```

Codes: `VALIDATION_ERROR` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `INTERNAL_ERROR` 500.

FastAPI's defaults don't match this shape, so `main.py` registers three handlers: one for the custom `ApiError`, one for `RequestValidationError` (maps Pydantic's `loc`/`msg` into `details`), and one for `HTTPException`. Add them on day one — retrofitting them after 40 endpoints is miserable.

**Conventions**

- Pagination: `page` (1-based), `limit` (default 20, max 100), supplied by a shared `PaginationParams` dependency
- Dates: `YYYY-MM-DD`; timestamps ISO 8601 UTC
- Money: decimal string, always paired with the trip's ISO-4217 `currency`
- Request bodies are Pydantic models — validation happens before the handler runs, so no manual checks in routes
- Response schemas are explicit (`TripRead`, `TripListItem`); ORM objects are never returned directly, which keeps `password_hash` structurally unable to leak
- `PATCH` bodies use `model_dump(exclude_unset=True)` so an omitted field and an explicit `null` mean different things

---

## 7. Key Business Logic

### 7.1 Budget computation

```
activities_total = Σ trip_activities.cost
manual_total     = Σ budget_items.amount
grand_total      = activities_total + manual_total

by_category   = ACTIVITIES bucket from trip_activities
                + budget_items grouped by category
by_day        = group by scheduled_date / incurred_on across the trip date range
by_city       = roll by_day up through trip_stops
avg_per_day   = grand_total / (end_date - start_date + 1)
over_budget   = days where day_total > avg_per_day * threshold   (threshold default 1.5)
```

Computed on read in SQL — two `select(...).group_by(...)` statements (one per source table) unioned in Python, not a Python loop over every row. No denormalized totals column in v1.

Use `generate_series(trip.start_date, trip.end_date, '1 day')` LEFT JOINed against the totals so days with no cost come back as zero. The frontend chart needs a continuous series; filling gaps client-side is where off-by-one bugs live.

If `travelers > 1`, multiply activity costs by `travelers` in the service (see §11).

### 7.2 Date validation

- Trip: `end_date >= start_date` — enforced by DB `CHECK` *and* Pydantic model validator
- Stop dates must fall inside the parent trip's range → else `VALIDATION_ERROR`
- Overlapping stops are **allowed** (travel days), but the response includes a non-blocking `warnings[]` array
- Activity `scheduled_date` must fall inside its stop's range
- Shrinking a trip's date range while stops sit outside it → `409 CONFLICT` listing the offending stops, rather than silently orphaning them

### 7.3 Reordering

The endpoint receives the full ordered ID list, verifies the set matches the stored set exactly, then rewrites every `order_index` inside one transaction. The deferred unique constraint on `(trip_id, order_index)` makes this safe without a two-pass "shift to negatives" hack.

### 7.4 Copy trip

Deep-copy trip → stops → activities → budget items in a single transaction. Dates shift so the copy starts today (or at a client-supplied `start_date`) while preserving relative offsets. `is_public` resets to false, no `share_slug` is generated, and `copied_from_trip_id` records provenance.

### 7.5 Share slug

10-character URL-safe token from `secrets.token_urlsafe`. Unpublishing keeps the row and sets `is_public=false`; a public `GET` on a non-public slug returns 404, not 403 — don't confirm that a private trip exists.

---

## 8. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | p95 < 300 ms for list endpoints on seed data; `GET /trips/{id}` in ≤ 3 queries via `selectinload` |
| Security | CORS allowlist, bcrypt/argon2, no secrets in repo, all queries parameterized by SQLAlchemy, JWT secret from env |
| Rate limits | 5 req/min on `/auth/login` and `/auth/forgot-password` per IP; 100 req/min global |
| Uploads | ≤ 5 MB, `image/jpeg\|png\|webp` only, content-type sniffed not trusted |
| Logging | structlog JSON, request id, no passwords or tokens logged |
| Config | `Settings` validated at import — the app refuses to boot on a missing env var |
| Migrations | Every schema change ships as an Alembic revision; `alembic upgrade head` runs on deploy |
| Seeding | ≥ 40 cities, ≥ 200 activities, 1 demo user with 2 fully populated trips |

---

## 9. Build Plan

**Phase 1 — Foundation**
Repo + `uv`, `Settings`, async engine and `get_db`, `DeclarativeBase`, Alembic init, exception handlers, `ApiResponse[T]`, `/health`. Docker Compose with Postgres so everyone runs the same DB.

**Phase 2 — Auth & users**
Register/login/refresh/logout, `get_current_user` dependency, profile endpoints, password reset.

**Phase 3 — Catalog**
City + activity models, seed script, search/filter/pagination. *Do this before trips if the frontend team is idle — it's the only data they can't mock.*

**Phase 4 — Trips & itinerary**
Trip CRUD, stops, trip activities, reorder, `get_owned_trip`, date validation.

**Phase 5 — Budget & dashboard**
Aggregation queries, budget items CRUD, `/dashboard`.

**Phase 6 — Sharing & admin**
Share slug, public read, copy trip, admin stats + catalog management.

**Phase 7 — Hardening**
Rate limiting, pytest coverage on critical paths, deploy (Render/Railway/Fly + Neon or Supabase Postgres), seeded demo account, OpenAPI tidy-up.

If time runs short, cut in this order: admin analytics → copy trip → per-city budget rollup. Never cut ownership checks or date validation — those are exactly what a judge will poke at.

---

## 10. Acceptance Criteria

1. A user can register, log in, and receive a working access/refresh token pair.
2. A user can create a trip, add ≥ 3 stops with cities and dates, and add activities to each stop.
3. `GET /trips/{id}` returns the complete nested itinerary in one request with no N+1 queries.
4. Reordering stops persists and survives a reload.
5. `GET /trips/{id}/budget` returns totals, category breakdown, a gap-free per-day series, and flagged over-budget days matching a hand calculation.
6. Requesting another user's trip returns 403; a nonexistent one returns 404.
7. A published trip is readable at `/public/trips/{slug}` with no auth and exposes no owner PII beyond display name.
8. Copying a public trip creates an independent trip owned by the copier, with dates rebased.
9. City and activity search return correctly paginated, filtered results.
10. `/docs` renders every endpoint with accurate request/response schemas and the standard envelope.
11. Deleting a user cascades to trips, stops, activities and budget items with zero orphans (verify with a FK integrity query).
12. `alembic upgrade head` builds the schema from empty, and `db/seed.py` populates a demo account end to end.

---

## 11. Open Questions

- Single currency per trip, or per line item? *(Recommendation: per-trip `currency`, no FX in v1.)*
- Is transport between stops a first-class entity or a `TRANSPORT` budget item? *(v1: budget item.)*
- Are catalog activity costs per-person or flat? *(Recommendation: per-person — `travelers` already exists on `trips`, multiply in the budget service and state it in the response.)*
- Should a copied trip stay linked to its source for an "N people copied this" stat, or be fully detached? *(v1 keeps `copied_from_trip_id`; the stat is a nice admin-dashboard extra if time allows.)*
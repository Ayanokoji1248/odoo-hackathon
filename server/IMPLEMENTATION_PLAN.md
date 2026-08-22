# GlobeTrotter Backend — Implementation Plan

Derived from [PRD.md](PRD.md). Scope: `server/`, plus the client-wiring phase
that turns those endpoints into a working app.

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
| 4 | [docs/phase-5-trips-and-itinerary.md](docs/phase-5-trips-and-itinerary.md) - file says 5; `phase-4-*` was taken by the auth retrofit |
| 5 | [docs/phase-6-budget-and-dashboard.md](docs/phase-6-budget-and-dashboard.md) - file numbers stay one ahead of plan phases |
| 4 auth retrofit | [docs/phase-4-production-auth.md](docs/phase-4-production-auth.md) |
| 6 (frontend) | [../client/docs/frontend-wiring.md](../client/docs/frontend-wiring.md) |

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
cross-site POST the CSRF token defended against. Logout and password changes
killed sessions **immediately** rather than leaving access tokens valid for up to
15 more minutes, and the frontend needed no 401-refresh-retry interceptor. `pyjwt`
was dropped. Cookie `Secure`/`SameSite`/domain stay env-configurable.

> **The immediacy claim above no longer holds - Phase 4 brought JWT access tokens
> back.** `get_current_user` verifies the signature and the user row but
> deliberately does *not* check session revocation; see
> `test_access_hot_path_does_not_check_session_revocation`, which asserts it. So a
> revoked session keeps read access until its access token expires
> (`access_token_expire_minutes`, 15) - it just cannot renew, because
> `/auth/refresh` 401s at once. Verified live across two cookie jars: after A
> changes the password, A is 401 immediately (cookies cleared) while B still gets
> 200 on `/auth/me` and 401 on `/auth/refresh`. Frontend copy must therefore say
> "signed out here now, other devices within 15 minutes"; `SettingsPanel` and
> `ResetPasswordForm` do.

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

## Phase 4 — Trips & itinerary ✅

| Area | Work |
|---|---|
| Models | `trips`, `trip_stops`, `trip_activities` (deferrable `UNIQUE (trip_id, order_index)`) |
| Deps | `get_owned_trip` — the single authorization gate for the whole nested subtree |
| Routes | trips CRUD + `/cover` + `/duplicate`; stops CRUD + reorder; trip-activities CRUD + reorder |
| Service | `trip_service.py` — date-range validation, overlap `warnings[]`, delete-and-reindex, full-set reorder in one transaction, snapshot name/category/cost on add |
| Query | `GET /trips/{id}` via `selectinload(Trip.stops).selectinload(TripStop.activities)` |

Shrinking a trip's dates while stops sit outside → `409` listing offenders. Never silently orphan.

| Tests | 34 new (99 total) |

`order_index` stays dense and a reorder rewrites every row in one pass - safe only
because `UNIQUE (trip_id, order_index)` is `DEFERRABLE INITIALLY DEFERRED`. Catalog
name/category/cost are snapshotted onto `trip_activities`, so an admin editing a
price cannot move a saved trip's budget.

**Deferred:** `POST /trips/{id}/cover` - no storage credential exists, so there is
nowhere to put the file. `PATCH /trips/{id}` takes a `cover_photo_url` meanwhile; the
multipart endpoint lands in Phase 7 with the size and content-type rules.

**Done - AC 2, 3, 4, 6.** The N+1 test compares a 1-stop and a 5-stop trip and asserts
the query count is *identical*, not merely under some threshold.

---

## Phase 5 — Budget & dashboard ✅

| Area | Work |
|---|---|
| Models | `budget_items`, `budget_category` enum |
| Service | `budget_service.py` — two grouped `select`s (activities, budget items), merged in Python; `generate_series` LEFT JOIN for the gap-free per-day series; per-city rollup through stops; `avg_per_day`; over-budget flag at `avg × 1.5`; activity costs × `travelers` |
| Routes | `GET /trips/{id}/budget`, budget-items CRUD, `GET /dashboard` (one call: next 3 trips, counts, popular cities, nearest-trip budget) |

Money is `Decimal` end to end. No floats, no denormalized totals column.

| Tests | 26 new (126 total) |

Nothing is stored: every total is computed on read, because a cached total that
nothing invalidates goes wrong the moment an activity price is edited. Activity
costs are multiplied by `travelers` (they are per person); manual items are not.
`by_day` uses `generate_series` so free days appear as `0.00` instead of being
missing from the chart. Money that cannot be placed on a day or a city is reported
as `undated_total` / `unassigned_total` rather than spread around.

**Done - AC 5.** Verified against a hand calculation on the seeded demo trip:
509.68 total, 56.63/day, and both the category and city splits sum back to the total.

---

## Phase 6 — Frontend wiring (the mock purge)

Every endpoint through Phase 5 exists and is tested. The client renders it
**read-only**: pages fetch real data, but almost every write is a `toast()` over
local `useState`. This phase deletes `client/src/data/mock/` one screen at a time.

**Rule for every task:** API first — verify the endpoint (or build it) with tests —
then bind the component, then delete the mock import. A task is done when nothing
on that screen is lost by a reload that shouldn't be, and no `@/data/mock` import
remains in it.

| # | Task | API | Client work | Status |
|---|---|---|---|---|
| 1 | Trip edit + delete | `PATCH` / `DELETE /trips/{id}` — built in Phase 4 | `updateTrip()`; `TripEditDialog`; real handlers on `TripCard` + `TripHeader` | ✅ |
| 2 | Itinerary stop CRUD + reorder | `/trips/{id}/stops` — Phase 4 | `ItineraryBuilder` + `StopDialog` replace `SectionItineraryBuilder`; add / patch / delete / reorder | ✅ |
| 3 | Trip activity add / remove | `/trips/{id}/stops/{sid}/activities` — Phase 4, **+ city-match guard added** | `ActivityPickerDialog` per stop; `AddToTripDialog` on the catalogue card; remove from the itinerary | ✅ |
| 4 | Save / unsave a city | `/users/me/saved-destinations` — Phase 3 | `CityCard` Save/Saved toggle; `CitiesExplorer` loads the saved set; `/saved` drops a card on un-save | ✅ |
| 5 | Manual budget items | `/trips/{id}/budget-items` — Phase 5 | `ManualCosts` card on the budget page: add, edit amount, remove | ✅ |
| 6 | Profile + account writes | `PATCH /users/me`, `/me/password`, `DELETE /me` — Phase 2 | `SettingsPanel` rebuilt: Profile / Password / Account, all submitting. Fake Preferences + Privacy sections deleted | ✅ |
| 7 | Reset password | `POST /auth/reset-password` — Phase 2 | `/reset-password` page; `/forgot-password` surfaces the DEBUG token so the flow is completable without a mailer | ✅ |
| 8 | Share + public view + copy | **built — see Phase 7** | `ShareDialog` on card/header/builder, real `/shared/[slug]`, working copy; `/shared` is now "my shared trips" | ✅ |
| 9 | Admin dashboard | **built — see Phase 7** | Real stats/charts, catalog CRUD, user table. Separate `/admin/login`. `data/mock/admin.ts` deleted | ✅ |
| 10 | Community feed | none built, none planned | The last mock. A public directory is **not** implied by link-sharing - it needs its own opt-in, so this is a product decision, not a wiring job | ⬜ |

Tasks 1-7 need **no new backend work** — that is the whole point of this ordering.
Seven screens become real before a single new route is written; the unused
functions already sitting in `client/src/lib/api/` are most of the work.

`trips.share_slug` and `copied_from_trip_id` already exist as columns (Phase 4
added them); only the routes are missing, so task 8 is additive.

**Found in task 2, fixed in task 3:** `add_activity` validated `scheduled_date`
against the stop and the activity against the catalog, but never that the
activity's `city_id` matched the stop's - a Udaipur activity attached happily to a
New York stop, and the per-city budget rollup then filed its cost under New York.
Now a 400, with 2 tests (`test_a_catalog_activity_from_another_city_is_rejected`,
`test_a_custom_activity_needs_no_city`). Name-only custom activities are still
unrestricted: they have no catalog row, so no city to match. **128 tests.**

**Cut in task 6, because nothing backs them:** the Preferences section (travel
style, currency) and the whole Privacy section (four toggles) had no columns behind
them - every switch reset on reload. `User.preferences` in the client types is
still mostly invented defaults from `toUser()`; `language` is the only real one.
Restoring any of it is a migration plus an endpoint, not a wiring job.

**Done when:** `grep -r "@/data/mock" client/src` returns only what Phase 7 owns.

---

## Phase 7 — Sharing & admin

| Area | Work |
|---|---|
| Sharing ✅ | `POST/DELETE /trips/{id}/share` (`secrets.token_urlsafe(10)`), `GET /public/trips/{slug}` + `/{slug}/budget` (no auth, 404 on non-public — never 403), `POST /public/trips/{slug}/copy` |
| Copy ✅ | Deep copy trip → stops → activities → budget items in one transaction; dates rebased to today or client `start_date` preserving offsets; `is_public=false`, no slug, `copied_from_trip_id` set |
| Admin ✅ | `require_admin` at **router** level; `/admin/stats`, `/admin/cities/top`, `/admin/activities/top`, `/admin/users` (+ PATCH role/is_active), catalog CRUD with soft delete |

**Admin shipped ahead of sharing** (asked for first). 34 new tests. **Sharing then
landed too: 13 more, 173 total.**

Sharing notes worth keeping:

- **Sharing is idempotent; un-sharing is not.** A second `POST /share` returns the
  slug it already had, so a link already sent out keeps working. `DELETE /share`
  clears the *slug* as well as the flag - re-sharing mints a new one, because
  reviving the old link would hand access back to everyone who ever saw it. Both
  behaviours are asserted.
- **404, never 403, on a non-public trip.** A 403 confirms the trip exists, which
  is exactly what someone walking the slug space wants to learn.
- **PII:** `PublicTripRead` adds only `owner_name` to `TripRead`, which carries no
  `user_id`. A test greps the raw response body for the registered account's
  email, phone, city and bio - a leak nested inside a stop would fail it too.
- `copy_count` comes from `COUNT(copied_from_trip_id)`. Real, and no new column.
  There is deliberately **no view counter** - that needs a column and a write on
  every public GET, and nobody asked for it, so the UI shows copies instead of
  inventing views.
- **`duplicate_trip` was silently dropping budget items** - so a copied trip lost
  its flights and hotels and its total quietly fell to activities only. Fixed in the
  shared function, which also fixes the pre-existing `POST /trips/{id}/duplicate`.
  Stop ids are remapped so an item attributed to a city follows the right one, and
  a dated item shifts by the same offset while an undated one stays undated.
- Live check: `scripts/check_share.py` (40 assertions, including the PII grep and
  the dead-link-stays-dead sequence).

Notes worth keeping:

- `require_admin` sits on the `APIRouter`, not on each route - a leaf that forgets
  its own check is the failure mode that cannot happen this way. Tests assert 401
  signed out and 403 for a plain user on every GET *and* on the writes.
- **No hard delete anywhere.** Users are deactivated (`get_current_user` checks
  `is_active`, so it bites on the next request); catalog rows are hidden with
  `is_active=false`, because trips snapshot them and `activities.city_id` is
  `ON DELETE RESTRICT`.
- An admin cannot demote or deactivate **themselves** - that is the one mistake
  the UI could not undo. A "last active admin" guard was written and then deleted:
  it was unreachable, since the actor is always an active admin, so demoting
  anyone else always leaves at least one.
- `top_cities` ranks by `trip_stops` rows, not `cities.popularity_score` - the
  latter is an editorial number an admin types in, so ranking by it would just
  reflect their own guesses back at them.
- `avg_trip_budget` reuses `budget_service`'s arithmetic (activities x travelers,
  manual items as entered), asserted against a hand calculation.
- The seed now creates `admin@globetrotter.app` / `admin12345`, and re-asserts the
  role on every run. Without it the panel is unreachable without a psql session.
- Live check against the running dev server: `scripts/check_admin.py`. The suite
  covers the logic on an isolated DB; that script catches the things only a real
  server shows - an unmounted router, an unrun seed, a cookie flag over real HTTP.

**Done - AC 7, 8.** The public payload exposes no owner PII beyond the display name.

---

## Phase 8 — Hardening

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
4. **Copied trips** — keep `copied_from_trip_id`; the "N copies" stat is a Phase 7 extra only if time allows.

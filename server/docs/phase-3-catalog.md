# Phase 3 — Catalog

Status: complete. 23 new tests (41 total). Builds on
[phase-1-foundation.md](phase-1-foundation.md) (envelopes, error codes,
migration wiring) and [phase-2-auth-and-users.md](phase-2-auth-and-users.md)
(the bearer dependency that guards saved destinations).

This is the read-only reference data the client cannot mock: 54 cities and
324 activities, plus a user's saved-destination list.

---

## 1. File map

| File | Purpose |
|---|---|
| [app/models/catalog.py](../app/models/catalog.py) | `City`, `Activity`, `SavedDestination`, `ActivityCategory` |
| [app/schemas/catalog.py](../app/schemas/catalog.py) | list vs. detail schemas, sort literals |
| [app/services/catalog_service.py](../app/services/catalog_service.py) | filtering, sorting, pagination, `_like` escaping |
| [app/services/user_service.py](../app/services/user_service.py) | saved-destination add/list/remove (appended this phase) |
| [app/api/v1/routes/cities.py](../app/api/v1/routes/cities.py) | `/cities`, `/cities/popular`, `/cities/{id}` |
| [app/api/v1/routes/activities.py](../app/api/v1/routes/activities.py) | `/activities`, `/activities/{id}` |
| [app/db/seed.py](../app/db/seed.py) | the data itself + the demo account |
| [alembic/versions/2d720df8abd1_…](../alembic/versions/2d720df8abd1_catalog_cities_activities_saved_.py) | tables, `pg_trgm`, trigram indexes |

---

## 2. Schema

### `cities`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar(120) | |
| `country` | varchar(80) | |
| `region` | varchar(80) NULL | free text: `Europe`, `Asia`, `Middle East`, … |
| `latitude` / `longitude` | numeric(9,6) NULL | `Decimal`, never float |
| `cost_index` | smallint | `CHECK (cost_index BETWEEN 1 AND 100)` |
| `popularity_score` | integer | default 0, drives the default sort |
| `image_url` / `description` | text NULL | `image_url` is unpopulated by the seed |
| `is_active` | boolean | default true — **soft delete** |

Constraints and indexes:

| name | what |
|---|---|
| `uq_cities_name_country` | the natural key; also what the seed upserts on |
| `ck_cities_cost_index_range` | 1–100 |
| `ix_cities_country` | country filter |
| `ix_cities_popularity_score_desc` | the default list order |
| `ix_cities_name_trgm` | GIN trigram, for `name ILIKE '%…%'` |

### `activities`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `city_id` | uuid FK → `cities` **ON DELETE RESTRICT** | |
| `name` | varchar(160) | |
| `description` | text NULL | unpopulated by the seed |
| `category` | enum `activity_category` | see below |
| `estimated_cost` | numeric(10,2) | `CHECK (>= 0)` |
| `currency` | char(3) | ISO-4217 |
| `duration_minutes` | integer NULL | `CHECK (> 0)` |
| `image_url` | text NULL | |
| `is_active` | boolean | default true — soft delete |

| name | what |
|---|---|
| `uq_activities_city_id_name` | natural key; makes the seed idempotent |
| `ix_activities_city_id_category` | the two most common filters together |
| `ix_activities_estimated_cost` | cost range filter and the default sort |
| `ix_activities_name_trgm` | GIN trigram |

`ON DELETE RESTRICT` is deliberate. Cities are referenced by activities *and*
(from Phase 4) by trip stops. Deleting one should be a loud error, not a silent
cascade through somebody's saved itinerary. Removing a city from the catalog is
`is_active = false`, not `DELETE`.

### `activity_category`

`SIGHTSEEING` · `FOOD` · `ADVENTURE` · `CULTURE` · `NIGHTLIFE` · `SHOPPING` ·
`RELAXATION` · `TRANSPORT`

A native Postgres enum. **Adding a ninth value needs an explicit
`ALTER TYPE activity_category ADD VALUE …` migration** — autogenerate will not
write it for you, and Phase 4 snapshots this same enum onto `trip_activities`.
The full list was decided here for that reason.

### `saved_destinations`

Composite PK `(user_id, city_id)` — that *is* the duplicate guard, which is why
saving the same city twice surfaces as a 409 from an `IntegrityError` rather than
a pre-flight `SELECT`. Both FKs cascade, so deleting a user or a city cleans up.

---

## 3. Endpoints

All public except the saved-destination routes. Base `/api/v1`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cities` | — | paginated list |
| GET | `/cities/popular` | — | `?limit=` 1–50, default 8 |
| GET | `/cities/{city_id}` | — | detail |
| GET | `/activities` | — | paginated list |
| GET | `/activities/{activity_id}` | — | detail |
| GET | `/users/me/saved-destinations` | bearer | newest first |
| POST | `/users/me/saved-destinations` | bearer | `{ city_id }` → **201** |
| DELETE | `/users/me/saved-destinations/{city_id}` | bearer | |

### `GET /cities` query parameters

| param | type | default | behaviour |
|---|---|---|---|
| `search` | str ≤ 120 | — | case-insensitive substring on `name` |
| `country` | str ≤ 80 | — | case-insensitive **exact** match (`ILIKE`, no wildcards) |
| `region` | str ≤ 80 | — | same |
| `max_cost_index` | int 1–100 | — | `cost_index <= n` |
| `sort` | `popularity` \| `name` \| `cost_index` | `popularity` | popularity is DESC, the others ASC |
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 20 | |

### `GET /activities` query parameters

| param | type | default | behaviour |
|---|---|---|---|
| `city_id` | uuid | — | |
| `category` | `ActivityCategory` | — | exact enum value, uppercase |
| `min_cost` / `max_cost` | decimal ≥ 0 | — | inclusive |
| `max_duration` | int > 0 | — | `duration_minutes <= n`; rows with a NULL duration are excluded |
| `search` | str ≤ 160 | — | substring on `name` |
| `sort` | `cost` \| `duration` \| `name` | `cost` | ascending; `duration` puts NULLs last |
| `page` / `limit` | | 1 / 20 | |

Every list response carries `meta` with the **unfiltered-by-page total**, so
`total` is the full match count, not the length of `data`.

---

## 4. Things that will bite you

**Route order.** `/cities/popular` is declared *before* `/cities/{city_id}`.
Reverse them and `popular` gets parsed as a uuid and returns a 400. There is a
test (`test_popular_cities_is_routed_before_the_uuid_path`) whose only job is to
catch that reordering.

**LIKE wildcards are escaped.** `_like()` in the service escapes `\`, `%` and
`_`, and passes `escape="\\"` to `ilike`. Without it, `?search=%` returns every
row and `?search=P_ris` matches "Paris" — user input silently becoming a query
operator. Two tests pin this.

**Soft delete is applied in the service, not the DB.** Every public read adds
`WHERE is_active`. A row with `is_active = false` returns **404**, not 403 or an
empty-but-200 detail. If you add a new catalog read, you must add the filter —
nothing enforces it for you.

**The trigram index looks unused, and that's correct.** With 54 cities the
planner picks a seq scan; it is simply cheaper. Force it to check the index is
real and wired:

```sql
SET enable_seqscan = off;
EXPLAIN (COSTS OFF) SELECT * FROM cities WHERE name ILIKE '%par%' AND is_active;
--  ->  Bitmap Index Scan on ix_cities_name_trgm
```

Do not "fix" the seq scan. It becomes an index scan on its own once the table is
large enough to justify it.

**Money is `Decimal` → JSON string.** `estimated_cost` serializes as `"18.50"`,
not `18.5`. Same for `latitude`/`longitude`. A client doing `parseFloat` is fine;
a client asserting on a number type will break. Two tests assert the string form.

---

## 5. Seed data

```bash
./.venv/Scripts/python.exe -m app.db.seed
# cities:     54
# activities: 324
# demo user:  demo@globetrotter.app / demo12345
```

| | |
|---|---|
| Cities | 54 real cities across 7 regions, cost_index 20 (Jaipur) → 97 (Zurich) |
| Activities | 6 per city = 324, spanning all 8 categories |
| Demo user | `demo@globetrotter.app` / `demo12345` |

**Idempotent.** Cities upsert on `(name, country)`, activities on
`(city_id, name)`. Run it as many times as you like; edit the tables in the file
and re-run to update rows in place. The demo user is created only if absent, so
re-seeding never resets a password you changed by hand.

**Activities are generated, not hand-written.** 16 name templates
(`"{city} Old Town Walking Tour"`, …) with a base cost, rotated per city by
`offset = (city_index * 6) % 16` so the catalog isn't 54 identical lists.
Costs scale with the city:

```
estimated_cost = base_cost × cost_index / 55        (rounded half-up to cents)
```

55 is `BASELINE_COST_INDEX` — a notional mid-priced city, so a template's base
cost lands as written there. Zurich (97) is ~1.8× the base, Jaipur (20) ~0.36×.

**The whole catalog is `USD`.** `CATALOG_CURRENCY` in the seed. Seeding each
city its local currency was the first attempt and it was wrong: there is no FX in
v1, so the Phase 5 budget service would happily sum VND and CHF into one
`grand_total`. One currency keeps the arithmetic honest. The `currency` column
stays for when conversion arrives.

**No images.** `image_url` is NULL everywhere. Hotlinking a stock-photo host
would make the demo depend on someone else's uptime. The column exists; fill it
if a real asset pipeline appears.

**Demo trips are not seeded yet** — PRD §8 wants a demo user with two populated
trips, and `trips` does not exist until Phase 4. `seed.py` gains that step then.

---

## 6. Config change made this phase

`SQL_ECHO` was split out of `DEBUG`. `echo=settings.debug` meant that the normal
dev setting (`DEBUG=true`) dumped every statement — the seed script's output was
53 KB of SQL with three useful lines at the end. Now:

| var | default | effect |
|---|---|---|
| `DEBUG` | false | reset token in the forgot-password response |
| `SQL_ECHO` | false | log every SQL statement (genuinely noisy) |

Set `SQL_ECHO=true` only while you are debugging a specific query.

---

## 7. Error reference

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | bad `sort`, bad `category`, `limit > 100`, `page < 1`, a `city_id` that isn't a uuid, negative `min_cost` |
| 401 | `UNAUTHORIZED` | saved-destination routes without a bearer token |
| 404 | `NOT_FOUND` | `City not found` / `Activity not found` — unknown **or** `is_active = false` |
| 404 | `NOT_FOUND` | `That city is not in your saved list` on DELETE |
| 409 | `CONFLICT` | `That city is already saved` |

---

## 8. Inspecting live state

```sql
-- catalog size and coverage
SELECT (SELECT count(*) FROM cities) cities,
       (SELECT count(*) FROM activities) activities,
       (SELECT count(DISTINCT category) FROM activities) categories;

-- what a city offers
SELECT a.category, a.estimated_cost, a.currency, a.duration_minutes, a.name
FROM activities a JOIN cities c ON c.id = a.city_id
WHERE c.name = 'Kyoto' ORDER BY a.estimated_cost;

-- rows hidden from the API
SELECT name, country FROM cities WHERE NOT is_active;
SELECT name FROM activities WHERE NOT is_active;

-- price spread, to sanity-check the cost_index scaling
SELECT c.name, c.cost_index, round(avg(a.estimated_cost), 2) avg_cost
FROM cities c JOIN activities a ON a.city_id = c.id
GROUP BY c.name, c.cost_index ORDER BY c.cost_index LIMIT 5;

-- who saved what
SELECT u.email, c.name FROM saved_destinations s
JOIN users u ON u.id = s.user_id JOIN cities c ON c.id = s.city_id;

-- is the trigram extension present? (create_all in tests and the migration both need it)
SELECT extname FROM pg_extension ORDER BY extname;
```

---

## 9. Debugging playbook

| Symptom | Likely cause | Check |
|---|---|---|
| `GET /cities/popular` returns 400 | `/{city_id}` declared first | route order in `cities.py` |
| A city you seeded is missing from `/cities` | `is_active = false` | `SELECT is_active …` |
| `?search=%` returns everything | `_like()` escaping removed | `catalog_service._like` |
| `?search=Paris` finds nothing after a rename | search is substring on `name` only, not country | try `?country=` |
| `?max_duration=60` drops rows you expected | rows with NULL `duration_minutes` are excluded by `<=` | that column |
| `meta.total` equals `len(data)` always | count taken after `.limit()` | `_count` must run on the pre-pagination statement |
| `?category=food` is a 400 | enum values are uppercase | `FOOD` |
| Costs are floats in the client | something re-serialized the Decimal | schemas must keep `Decimal` |
| Migration fails: *operator class "gin_trgm_ops" does not exist* | `pg_trgm` not created | the `op.execute` at the top of the catalog migration |
| Tests fail on the same error | conftest's `create_all` block | it creates `citext` **and** `pg_trgm` |
| Downgrade→upgrade fails: *type activity_category already exists* | enum not dropped in `downgrade()` | `sa.Enum(name='activity_category').drop(op.get_bind())` |
| Seed run prints 50 KB of SQL | `SQL_ECHO=true` | §6 |
| Seed duplicates rows | a unique constraint was dropped | `uq_cities_name_country`, `uq_activities_city_id_name` |
| Saving a city 409s when the list looks empty | the row belongs to a different user, or `SavedDestination` PK collision | query `saved_destinations` directly |
| `MissingGreenlet` reading `SavedDestination.city` | that relationship is `lazy="raise"` on purpose | join `City` explicitly, as `list_saved_destinations` does |

---

## 10. Test map

[tests/test_catalog.py](../tests/test_catalog.py) — 23 tests. The `catalog`
fixture in [tests/conftest.py](../tests/conftest.py) inserts a deliberately tiny
set: 3 active cities (Paris 78/98, Prague 48/84, Bangkok 30/92) + 1 soft-deleted,
and 5 active activities + 1 soft-deleted. Small enough that every assertion can
name the exact rows it expects — the real seed would make ordering assertions
brittle.

| Test | Guards |
|---|---|
| `test_list_cities_hides_soft_deleted_rows` | `is_active` filter + `meta.total` |
| `test_cities_default_to_popularity_order` | default sort |
| `test_city_sort_options` | `name`, `cost_index` |
| `test_unknown_sort_is_rejected` | Literal validation |
| `test_city_search_is_case_insensitive_and_partial` | ILIKE substring |
| `test_search_wildcards_are_taken_literally` | `_like()` escaping |
| `test_city_filters` | country, region, `max_cost_index` |
| `test_city_pagination_reports_the_full_total` | count is pre-pagination |
| `test_limit_above_the_cap_is_rejected` | the 100 cap |
| `test_city_detail_carries_the_extra_fields` | detail schema, Decimal as string |
| `test_soft_deleted_city_is_a_404` | soft delete on detail |
| `test_unknown_city_is_404_and_a_bad_uuid_is_400` | 404 vs 400 split |
| `test_popular_cities_is_routed_before_the_uuid_path` | route ordering |
| `test_list_activities_hides_soft_deleted_rows` | `is_active` filter |
| `test_activities_default_to_cheapest_first` | default sort |
| `test_activity_filters` | city, category, cost range, duration, search |
| `test_unknown_category_is_rejected` | enum validation |
| `test_activity_cost_is_a_decimal_string` | money serialization |
| `test_soft_deleted_activity_is_a_404` | soft delete on detail |
| `test_saved_destinations_require_auth` | 401 |
| `test_save_list_and_remove_a_destination` | 201 → list → 409 → delete → 404 |
| `test_saving_an_unknown_or_retired_city_is_a_404` | inactive cities can't be saved |
| `test_deleting_a_user_drops_their_saved_destinations` | FK cascade |

---

## 11. Deferred out of this phase

| Item | Where it goes |
|---|---|
| `POST/PATCH/DELETE /admin/cities` and `/admin/activities` | Phase 6 — this phase is read-only |
| `/admin/cities/top`, `/admin/activities/top` | Phase 6 |
| Demo trips in the seed | Phase 4, once `trips` exists |
| `image_url` content | whenever there is a real asset source |
| Real activity descriptions | cosmetic; templates carry names only |
| Full-text / ranked search (`similarity()` ordering) | not needed at this size; the trigram index already supports it if it becomes worth doing |

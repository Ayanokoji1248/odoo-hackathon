# Trips & Itinerary

*Build-plan Phase 4. Numbered 5 here because `phase-4-production-auth.md` already
took that slot — see [README](README.md).*

Status: complete. 34 new tests (99 total). Builds on
[phase-1-foundation.md](phase-1-foundation.md) (envelopes, error codes),
[phase-4-production-auth.md](phase-4-production-auth.md) (the session cookie every
route here requires) and [phase-3-catalog.md](phase-3-catalog.md) (the cities and
activities a trip is assembled from).

This is the core of the product: a trip, its ordered city stops, and the
activities scheduled inside each stop.

---

## 1. File map

| File | Purpose |
|---|---|
| [app/models/trip.py](../app/models/trip.py) | `Trip`, `TripStop`, `TripActivity` |
| [app/schemas/trip.py](../app/schemas/trip.py) | request/response models, `_DateRange` validator |
| [app/services/trip_service.py](../app/services/trip_service.py) | all the logic: validation, reordering, snapshotting, deep copy |
| [app/deps.py](../app/deps.py) | `get_owned_trip` / `OwnedTrip` — the authorization gate |
| [app/api/v1/routes/trips.py](../app/api/v1/routes/trips.py) | `/trips*` |
| [app/api/v1/routes/stops.py](../app/api/v1/routes/stops.py) | `/trips/{id}/stops*` |
| [app/api/v1/routes/trip_activities.py](../app/api/v1/routes/trip_activities.py) | `/trips/{id}/stops/{id}/activities*` |
| [app/db/seed.py](../app/db/seed.py) | `seed_demo_trips` — two populated demo trips |
| [alembic/versions/01c372973625_…](../alembic/versions/01c372973625_trips_stops_and_trip_activities.py) | the three tables |

---

## 2. Schema

### `trips`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users` **ON DELETE CASCADE** | |
| `name` | varchar(160) | |
| `description` | text NULL | |
| `start_date` / `end_date` | date | `CHECK (end_date >= start_date)` |
| `cover_photo_url` | text NULL | set via `PATCH`; no upload endpoint yet (§9) |
| `travelers` | smallint | default 1, `CHECK (>= 1)` |
| `currency` | char(3) | default `USD`, **trip-level** — no FX in v1 |
| `is_public` | boolean | default false (Phase 6 flips it) |
| `share_slug` | varchar(16) UNIQUE NULL | Phase 6 fills it |
| `copied_from_trip_id` | uuid FK → `trips` **ON DELETE SET NULL** | provenance |

| index | why |
|---|---|
| `ix_trips_user_id_start_date_desc` | the trip list, which is always user-scoped |
| `ix_trips_share_slug_public` | **partial** (`WHERE is_public`) — the only slug lookup is the public one |

`status` and `duration_days` are **derived properties**, never columns. A stored
status would be wrong the morning after a trip ends.

### `trip_stops`

| column | type | notes |
|---|---|---|
| `trip_id` | uuid FK → `trips` **CASCADE** | |
| `city_id` | uuid FK → `cities` **RESTRICT** | a city in use cannot be deleted |
| `start_date` / `end_date` | date | `CHECK (end_date >= start_date)` |
| `order_index` | integer | 0-based, kept **dense** |
| `notes` | text NULL | |

```
UNIQUE (trip_id, order_index) DEFERRABLE INITIALLY DEFERRED
```

The deferral is the whole reason reordering is simple — see §5.

### `trip_activities`

| column | type | notes |
|---|---|---|
| `trip_stop_id` | uuid FK → `trip_stops` **CASCADE** | |
| `activity_id` | uuid FK → `activities` **ON DELETE SET NULL** | NULL = custom entry |
| `name` | varchar(160) | **snapshot** |
| `category` | enum `activity_category` NULL | **snapshot** |
| `scheduled_date` | date | must fall inside the stop |
| `start_time` | time NULL | |
| `duration_minutes` | integer NULL | `CHECK (> 0)` |
| `cost` | numeric(10,2) | **snapshot**, editable, `CHECK (>= 0)` |
| `order_index` | integer | ordering *within one day* |
| `notes` | text NULL | |

Index: `(trip_stop_id, scheduled_date, order_index)`.

**The `activity_category` enum is shared with `activities`.** One
`ENUM(..., create_type=True)` object in `models/catalog.py` is referenced by both
columns. Declaring `Enum(...)` twice with the same name races on `CREATE TYPE`,
because `metadata.create_all` has no ordering guarantee between the two tables —
and the migration needs `create_type=False` on the second use or it fails with
*type activity_category already exists*.

---

## 3. Why costs are snapshotted

`name`, `category` and `cost` are copied onto `trip_activities` when the activity
is added, and never re-read from the catalog.

Two failure modes this prevents:

1. An admin corrects a seeded price → **every saved trip's budget silently
   changes**, including trips already taken.
2. A catalog activity is deleted → the FK is `SET NULL`, and the itinerary keeps
   its name, category and price instead of showing a blank row.

Both have tests: `test_editing_the_catalog_never_moves_a_saved_trips_price` and
`test_retiring_a_catalog_row_keeps_the_itinerary_intact`.

The corollary: `POST .../activities` with an `activity_id` and an explicit `cost`
uses **your** cost. Omit `cost` and it takes the catalog price at that instant.

---

## 4. Authorization: one gate

Every stop and activity route is nested under `/trips/{trip_id}`, so
`get_owned_trip` authorizes the entire subtree:

```python
async def get_owned_trip(trip_id, db, user) -> Trip:
    trip = await db.get(Trip, trip_id)
    if trip is None:            raise ApiError("NOT_FOUND", …)   # 404
    if trip.user_id != user.id: raise ApiError("FORBIDDEN", …)   # 403
```

There is no leaf route that could forget its own check — that is the point of the
nesting, not an accident of URL design.

**404 vs 403 is deliberate** (AC 6): a trip that does not exist is a 404; one that
exists but belongs to someone else is a **403**. The caller is authenticated, so
hiding existence buys nothing. Phase 6's *public* share route is the opposite —
a non-public slug returns 404 there, because that request is unauthenticated and
existence itself is the secret.

Stops and activities are looked up **scoped to the trip**, so a valid stop id
from someone else's trip is a `404 Stop not found on this trip`, not a leak.

---

## 5. Reordering

`PATCH /trips/{id}/stops/reorder` takes the **full** ordered id list:

```json
{ "order": ["<stop-c>", "<stop-a>", "<stop-b>"] }
```

The service verifies the submitted set matches the stored set exactly — a partial
list or a duplicated id is a 400. Silently appending whatever was omitted would
be worse than making the client be explicit.

Then it rewrites every `order_index` in one pass and commits. That works only
because the unique constraint is `DEFERRABLE INITIALLY DEFERRED`: Postgres checks
it at `COMMIT`, not per row. Without the deferral, assigning index 0 to the row
that used to be 1 collides mid-update, and you need the classic "shift everything
to negative numbers first" two-pass hack.

`order_index` is kept **dense** (0…n-1). Deleting a stop renumbers the survivors,
so there are never gaps for the client to reason about.

Activity reorder works the same way but is scoped to **one day**: every id must
share a `scheduled_date`, or it is a 400 (`Reorder one day at a time`).

---

## 6. Date rules

| Rule | Enforced by | Failure |
|---|---|---|
| `end_date >= start_date` on a trip | DB `CHECK` **and** the `_DateRange` Pydantic validator | 400 |
| Stop dates inside the trip range | service | 400 |
| Activity `scheduled_date` inside its stop | service | 400 |
| Overlapping stops | **allowed** | 201 + `warnings[]` |
| Shrinking a trip past a stop | service | **409**, listing every offender |
| Shrinking a stop past its activities | service | **409**, listing them |

Overlaps are allowed because travel days genuinely overlap — you leave Paris and
arrive in Rome on the same date. The write response carries advice instead:

```json
{ "stop": { … }, "warnings": ["Overlaps stop 1 (2026-09-21 to 2026-09-23)"] }
```

The 409s are the important part. Silently orphaning a stop outside its trip's
dates, or an activity outside its stop's dates, produces data no screen can
render sensibly. The error names each offender so the client can offer a fix:

```json
{ "code": "CONFLICT",
  "message": "Some stops fall outside the new trip dates - move or remove them first",
  "details": [{ "field": "stops[0]", "message": "Paris: 2026-09-21 to 2026-09-23" }] }
```

---

## 7. Endpoints

Base `/api/v1`. All require a session cookie. `{trip_id}` is always
ownership-checked.

| Method | Path | Notes |
|---|---|---|
| POST | `/trips` | **201** `TripListItem` |
| GET | `/trips` | `?status=upcoming\|ongoing\|past&search=&sort=&page=&limit=` |
| GET | `/trips/{trip_id}` | the **full nested tree** |
| PATCH | `/trips/{trip_id}` | 409 if it would orphan stops |
| DELETE | `/trips/{trip_id}` | cascades to stops + activities |
| POST | `/trips/{trip_id}/duplicate` | **201**, deep copy, dates rebased |
| POST | `/trips/{trip_id}/stops` | **201** `{ stop, warnings }` |
| GET | `/trips/{trip_id}/stops` | ordered, city + activities nested |
| PATCH | `/trips/{trip_id}/stops/reorder` | full id list |
| PATCH | `/trips/{trip_id}/stops/{stop_id}` | |
| DELETE | `/trips/{trip_id}/stops/{stop_id}` | reindexes the rest |
| POST | `…/stops/{stop_id}/activities` | **201**, snapshots the catalog row |
| PATCH | `…/activities/reorder` | one day at a time |
| PATCH | `…/activities/{item_id}` | |
| DELETE | `…/activities/{item_id}` | reindexes that day |

`sort` is `start_date` (default, DESC) · `created_at` (DESC) · `name` (ASC).
`search` escapes LIKE wildcards, same as the catalog.

**`reorder` is declared before `{stop_id}`** in both routers. Reverse them and
`reorder` is parsed as a uuid and 400s — the same trap as `/cities/popular`.

---

## 8. The nested read, and N+1

`GET /trips/{trip_id}` loads the tree with:

```python
selectinload(Trip.stops).joinedload(TripStop.city)
selectinload(Trip.stops).selectinload(TripStop.activities)
```

`selectinload` costs **one extra SELECT per collection level**, not per row. The
test `test_trip_detail_query_count_does_not_grow_with_the_trip` builds a 1-stop
trip and a 5-stop trip and asserts both reads issue the *same* number of queries
— which is the actual guarantee AC 3 asks for, rather than a number that happens
to pass today.

Total is ≤ 6 SELECTs: session lookup, user, the ownership check, then trip,
stops, activities. The PRD says "≤ 3 queries"; that counts the tree load only,
and the extra ones are the auth path plus `get_owned_trip`'s PK fetch. Making
the guard eager-load the tree would remove one query but make every activity
`PATCH` pay for a full tree read, which is the wrong trade.

`TripStop.city` is `lazy="raise"`, so any code path that serializes a stop
without joining `City` fails loudly in the service instead of raising
`MissingGreenlet` halfway through writing a response.

---

## 9. Duplicate

`POST /trips/{id}/duplicate` deep-copies trip → stops → activities in **one
transaction**, shifting every date by a single offset:

```
offset   = (body.start_date or today) - source.start_date
new_date = old_date + offset
```

So relative spacing is preserved exactly: a 12-day trip stays 12 days, and an
activity on day 3 stays on day 3. The copy resets `is_public=false` and
`share_slug=null`, and records `copied_from_trip_id`.

Budget items are **not** copied — they do not exist until Phase 5. Add them to
`duplicate_trip` when they do, or copied trips will silently lose their manual
costs. Phase 6's "copy a public trip" reuses this same function.

---

## 10. Error reference

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `end_date` before `start_date`; stop or activity date out of range; reorder list partial/duplicated; cross-day activity reorder; neither `activity_id` nor `name` |
| 401 | `UNAUTHORIZED` | no session cookie |
| 403 | `FORBIDDEN` | the trip belongs to someone else |
| 404 | `NOT_FOUND` | unknown trip; stop/activity not on this trip; unknown or inactive city/activity id |
| 409 | `CONFLICT` | shrinking a trip past its stops, or a stop past its activities — `details[]` names each |

---

## 11. Inspecting live state

```sql
-- a user's trips with derived status
SELECT name, start_date, end_date, travelers, currency,
       CASE WHEN end_date   < current_date THEN 'past'
            WHEN start_date > current_date THEN 'upcoming'
            ELSE 'ongoing' END AS status
FROM trips WHERE user_id = '<uuid>' ORDER BY start_date DESC;

-- the whole itinerary of one trip, flat
SELECT s.order_index, c.name AS city, s.start_date, s.end_date,
       a.scheduled_date, a.order_index AS day_order, a.category, a.cost, a.name
FROM trip_stops s
JOIN cities c ON c.id = s.city_id
LEFT JOIN trip_activities a ON a.trip_stop_id = s.id
WHERE s.trip_id = '<uuid>'
ORDER BY s.order_index, a.scheduled_date, a.order_index;

-- order_index must be dense 0..n-1 per trip; a gap means a reindex was missed
SELECT trip_id, array_agg(order_index ORDER BY order_index) AS indexes
FROM trip_stops GROUP BY trip_id;

-- activities whose catalog row was retired (snapshot still intact)
SELECT name, cost FROM trip_activities WHERE activity_id IS NULL;

-- orphan check (all must be 0)
SELECT (SELECT count(*) FROM trip_stops s LEFT JOIN trips t ON t.id = s.trip_id
          WHERE t.id IS NULL) AS orphan_stops,
       (SELECT count(*) FROM trip_activities a LEFT JOIN trip_stops s ON s.id = a.trip_stop_id
          WHERE s.id IS NULL) AS orphan_activities;

-- the constraint that makes reordering work
SELECT conname, condeferrable, condeferred FROM pg_constraint
WHERE conname = 'uq_trip_stops_trip_id_order_index';   -- both must be 't'
```

---

## 12. Debugging playbook

| Symptom | Likely cause | Check |
|---|---|---|
| `PATCH .../stops/reorder` 400s with a uuid parse error | `{stop_id}` declared before `reorder` | route order in `stops.py` |
| Reorder fails on a duplicate-key violation | the unique constraint lost its deferral | the `pg_constraint` query above; both flags must be `t` |
| Reorder 400: "must list every id exactly once" | client sent a partial list | send all ids, in the new order |
| `order_index` has gaps | a delete path skipped the reindex | `delete_stop` / `delete_activity` |
| 403 where you expected 404 | the trip exists and is someone else's | intended (§4) |
| 404 on a stop id you can see in the DB | it belongs to a different trip | stop lookups are trip-scoped |
| `MissingGreenlet` / `lazy="raise"` on `TripStop.city` | a query serialized a stop without joining City | use `list_stops` / `get_trip_tree`, or add the `joinedload` |
| Trip total changed after an admin edited the catalog | it should not — snapshots are copied | if it did, something re-reads `activities` on serialize |
| A saved activity shows a blank name | the snapshot was not written on add | `add_activity` must set `name` even for catalog rows |
| 409 on a date change you thought was safe | a stop or activity sits outside the new range | `details[]` names each one |
| Migration fails: *type activity_category already exists* | the second enum use lacks `create_type=False` | §2 |
| Duplicated trip has no budget items | expected — they arrive in Phase 5 | §9 |
| `status` is stale in a cached response | it is derived per request; something cached the payload | not a server bug |

---

## 13. Test map

[tests/test_trips.py](../tests/test_trips.py) — 34 tests. Fixtures: `trip` (a
10-day upcoming trip) and `stops` (three consecutive stops — Paris, Prague,
Bangkok) built on the Phase 3 `catalog` fixture.

| Area | Tests |
|---|---|
| Trip CRUD | status/duration derivation, all three status buckets, `end < start` rejected, `exclude_unset` patching |
| List | user scoping, status filter, search, pagination `total` |
| Authorization | another user's trip → 403, missing → 404, no session → 401, cross-trip stop → 404 |
| Nested read | full tree with cities and activities; **query count constant** across trip sizes |
| Stops | dense ordering, nested city, out-of-range rejected, overlap warnings, reindex on delete, reorder persists + survives reload, partial/duplicate reorder rejected |
| Date conflicts | shrinking a trip past its stops (409 + details), moving a stop away from its activities (409) |
| Snapshotting | catalog snapshot on add, catalog edit does **not** move the saved price, catalog delete keeps the itinerary, explicit cost override |
| Activities | custom-by-name, `activity_id`-or-`name` required, out-of-stop date rejected, per-day ordering + reindex, within-day reorder, cross-day reorder rejected, field update |
| Duplicate | date rebasing with preserved offsets, provenance, privacy reset, default start = today, original untouched |
| Cascade | deleting a trip leaves zero stops and zero activities |

---

## 14. Seed data

`seed_demo_trips` gives `demo@globetrotter.app` two populated trips, idempotent
on `(user, trip name)`:

| Trip | When | Stops | Activities |
|---|---|---|---|
| European Highlights | today + 30 | Paris → Rome → Barcelona | 9 (3 per stop, cheapest first, one per day) |
| Southeast Asia Loop | today − 60 | Bangkok → Chiang Mai → Bali | 9 |

One upcoming and one past on purpose, so the trip list and dashboard have
something in more than one status bucket.

---

## 15. Deferred out of this phase

| Item | Where it goes / why |
|---|---|
| `POST /trips/{id}/cover` (multipart upload) | **no storage backend exists** — no Cloudinary/S3 credential, and writing files onto the app container is not a deploy story. `PATCH /trips/{id}` accepts a `cover_photo_url`, so the feature is reachable. Phase 7, with the ≤5 MB + sniffed-content-type rules. |
| Budget items on a duplicated trip | Phase 5 — see §9 |
| Sharing, public read, copy-a-public-trip | Phase 6 (reuses `duplicate_trip`) |
| Per-day totals / budget rollups | Phase 5 |
| Transport between stops as a first-class entity | v1 answer: a `TRANSPORT` budget item, per PRD §11 |
| Sliding `order_index` gaps instead of reindexing | not worth it; dense indexes are simpler for the client |

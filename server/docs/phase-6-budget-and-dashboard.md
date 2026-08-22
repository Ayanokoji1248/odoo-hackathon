# Budget & Dashboard

*Build-plan Phase 5. Numbered 6 here because the file numbers drifted one ahead
of the plan when `phase-4-production-auth.md` took that slot — see
[README](README.md).*

Status: complete. 26 new tests (126 total). Builds on
[phase-5-trips-and-itinerary.md](phase-5-trips-and-itinerary.md) — a budget is an
aggregation over a trip's stops and activities.

Answers two questions the app could not answer before: *what will this trip
cost?* and *what goes on the home screen?*

---

## 1. File map

| File | Purpose |
|---|---|
| [app/models/budget.py](../app/models/budget.py) | `BudgetItem`, `BudgetCategory` |
| [app/schemas/budget.py](../app/schemas/budget.py) | item CRUD, `BudgetSummary`, `Dashboard` |
| [app/services/budget_service.py](../app/services/budget_service.py) | every aggregation query |
| [app/services/dashboard_service.py](../app/services/dashboard_service.py) | the home-screen composite |
| [app/api/v1/routes/budget.py](../app/api/v1/routes/budget.py) | `/trips/{id}/budget`, `/trips/{id}/budget-items*` |
| [app/api/v1/routes/dashboard.py](../app/api/v1/routes/dashboard.py) | `/dashboard` |
| [alembic/versions/c0173d4e0491_…](../alembic/versions/c0173d4e0491_budget_items.py) | the table |

---

## 2. `budget_items`

A manual cost line — a flight, a hotel, a dinner — for money the itinerary does
not already price.

| column | type | notes |
|---|---|---|
| `trip_id` | uuid FK → `trips` **CASCADE** | |
| `trip_stop_id` | uuid FK → `trip_stops` **ON DELETE SET NULL** NULL | optional city attribution |
| `category` | enum `budget_category` | `TRANSPORT` · `ACCOMMODATION` · `MEALS` · `ACTIVITIES` · `MISC` |
| `label` | varchar(160) | |
| `amount` | numeric(10,2) | `CHECK (>= 0)` |
| `incurred_on` | date NULL | must fall inside the trip when present |

Index: `(trip_id, incurred_on)`.

**`SET NULL`, not `CASCADE`, on the stop.** Deleting a city from an itinerary must
not silently delete the flight you booked to get there. The cost survives and
becomes unattributed — there is a test for exactly this.

Adding a value to `budget_category` needs an explicit
`ALTER TYPE budget_category ADD VALUE …` migration; autogenerate will not write
it. And `downgrade()` has to drop the type by hand, because `drop_table` doesn't.

---

## 3. Nothing is stored

Every total is computed on read. There is no denormalised `total` column, on
purpose: a stored total is a cache, and a cache nothing invalidates becomes wrong
the moment somebody edits an activity price.

The formula, per PRD §7.1:

```
activities_total = Σ trip_activities.cost  ×  trip.travelers
manual_total     = Σ budget_items.amount
grand_total      = activities_total + manual_total
avg_per_day      = grand_total / (end_date - start_date + 1)
over_budget      = day_total > avg_per_day × threshold      (threshold default 1.5)
```

### Travelers multiply activities, not hotels

Activity prices are **per person** (PRD §11). A hotel room is not. So
`travelers` scales `activities_total` and leaves `manual_total` alone.

This is the single most likely thing to be questioned about a number on screen,
which is why `travelers` and both subtotals are in the response — the client can
show the arithmetic rather than assert a total.

Two tests pin it: `test_activity_costs_are_multiplied_by_travelers` and
`test_manual_items_are_not_multiplied_by_travelers`.

---

## 4. The per-day series is gap-free

`by_day` returns **one row per calendar day** of the trip, including days that
cost nothing.

```sql
generate_series(start_date, end_date, '1 day')      -- the calendar
  LEFT JOIN activities grouped by scheduled_date    -- × travelers
  LEFT JOIN budget_items grouped by incurred_on
```

A chart needs a point for every day. Filling the gaps client-side is precisely
where off-by-one bugs breed — a day silently missing from the middle of a line
chart looks like a rendering glitch, not a data bug.

Proof: the seeded *Southeast Asia Loop* spans **12 days but has only 9
activities** (each stop's last day is free). `by_day` returns 12 rows, three of
them `0.00`. If it ever returns 9, the `generate_series` join has been lost.

### Two totals that deliberately don't reconcile

| Field | Why it exists |
|---|---|
| `undated_total` | items with no `incurred_on` — they count in `grand_total` but cannot sit on a day |
| `unassigned_total` | items with no `trip_stop_id` — they count in `grand_total` but cannot be attributed to a city |

So:

```
Σ by_day  + undated_total     == grand_total
Σ by_city + unassigned_total  == grand_total
```

Spreading a flight evenly across days, or across cities, would be inventing data.
Reporting the residual is honest and lets the client label it "unscheduled".
Both identities are asserted in tests.

---

## 5. Two category views

| Field | Buckets | Use |
|---|---|---|
| `by_category` | the five **budget** categories | the PRD's split; every trip activity lands in `ACTIVITIES` |
| `by_activity_category` | the eight **activity** categories | the finer chart: `CULTURE` vs `FOOD` vs `NIGHTLIFE` |

`by_category` is what PRD §7.1 specifies, and it sums exactly to `grand_total`.
But it collapses the whole itinerary into one `ACTIVITIES` bar, which tells a
user nothing — so `by_activity_category` is served alongside it. It costs one
extra grouped query.

A manually-added `ACTIVITIES` item **adds to** the activities bucket rather than
competing with it. Empty buckets are omitted.

---

## 6. Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/trips/{trip_id}/budget` | `?threshold=` 1–5, default 1.5 |
| GET | `/trips/{trip_id}/budget-items` | dated first, then undated |
| POST | `/trips/{trip_id}/budget-items` | **201** |
| PATCH | `/trips/{trip_id}/budget-items/{item_id}` | `exclude_unset` |
| DELETE | `/trips/{trip_id}/budget-items/{item_id}` | |
| GET | `/dashboard` | the whole home screen |

All budget routes go through `OwnedTrip`, so they inherit the Phase 4 gate:
404 for an unknown trip, **403** for someone else's.

### `GET /dashboard`

One request instead of six:

```jsonc
{ "counts": { "total": 2, "upcoming": 1, "ongoing": 0, "past": 1 },
  "upcoming_trips": [ … up to 3, soonest first … ],
  "popular_cities": [ … 6 … ],
  "budget_highlight": { "trip": { … }, "grand_total": "509.68",
                        "avg_per_day": "56.63", "currency": "USD" } }
```

`counts` is a single query using `count(case(...))` — four aggregates, one scan,
not four round trips.

`budget_highlight` is the soonest unfinished trip. If every trip is in the past
it falls back to the most recent one, so a returning user still sees something
rather than an empty panel. It is `null` only when the account has no trips.

---

## 7. Verifying the arithmetic by hand

The seeded demo account is set up so the numbers can be checked on paper.
**European Highlights**: 2 travelers, 9 days, one activity per day.

| | |
|---|---|
| Per person | 254.84 |
| `grand_total` (× 2) | **509.68** |
| `avg_per_day` | 509.68 ÷ 9 = **56.63** |
| Over-budget line | 56.63 × 1.5 = 84.95 |

`by_activity_category` — must sum to 509.68:
Culture 215.36 · Sightseeing 132.72 · Adventure 82.48 · Transport 54.40 · Relaxation 24.72

`by_city` — must also sum to 509.68:
Paris 190.04 · Rome 140.94 · Barcelona 178.70

No day exceeds 84.95, so no day is flagged. Add a 400.00 hotel on day 2 and:
`grand_total` → 909.68, `avg_per_day` → 101.08, and that day (468.08) becomes the
only `over_budget` entry. Delete it and the total returns to exactly 509.68.

All of the above was verified live against the running API.

---

## 8. Error reference

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | negative `amount`; `incurred_on` outside the trip; `threshold` outside 1–5; missing `label`/`category` |
| 401 | `UNAUTHORIZED` | no session cookie |
| 403 | `FORBIDDEN` | the trip belongs to someone else |
| 404 | `NOT_FOUND` | unknown trip; budget item not on this trip; `trip_stop_id` belonging to a different trip |

---

## 9. Inspecting live state

```sql
-- grand total the long way, to cross-check the endpoint
SELECT t.name, t.travelers,
       coalesce(sum(a.cost), 0) * t.travelers AS activities,
       (SELECT coalesce(sum(amount), 0) FROM budget_items WHERE trip_id = t.id) AS manual
FROM trips t
LEFT JOIN trip_stops s   ON s.trip_id = t.id
LEFT JOIN trip_activities a ON a.trip_stop_id = s.id
WHERE t.id = '<uuid>' GROUP BY t.id, t.name, t.travelers;

-- the per-day series, exactly as the endpoint builds it
SELECT day::date,
       coalesce(act.amount, 0) * t.travelers + coalesce(man.amount, 0) AS total
FROM trips t
CROSS JOIN generate_series(t.start_date, t.end_date, '1 day') AS day
LEFT JOIN (SELECT a.scheduled_date, sum(a.cost) amount
             FROM trip_activities a JOIN trip_stops s ON s.id = a.trip_stop_id
             WHERE s.trip_id = '<uuid>' GROUP BY a.scheduled_date) act
       ON act.scheduled_date = day::date
LEFT JOIN (SELECT incurred_on, sum(amount) amount FROM budget_items
             WHERE trip_id = '<uuid>' AND incurred_on IS NOT NULL
             GROUP BY incurred_on) man
       ON man.incurred_on = day::date
WHERE t.id = '<uuid>' ORDER BY day;

-- money that cannot be placed
SELECT label, amount, incurred_on, trip_stop_id FROM budget_items
WHERE trip_id = '<uuid>' AND (incurred_on IS NULL OR trip_stop_id IS NULL);

-- items orphaned from their stop by a stop deletion (expected, not a bug)
SELECT label, amount FROM budget_items WHERE trip_stop_id IS NULL;
```

---

## 10. Debugging playbook

| Symptom | Likely cause | Check |
|---|---|---|
| `by_day` is shorter than the trip | the `generate_series` join was replaced with a plain group-by | §4; the Southeast Asia Loop must give 12 rows |
| `Σ by_day` ≠ `grand_total` | undated items exist — expected | `undated_total` should equal the difference exactly |
| `Σ by_city` ≠ `grand_total` | items with no stop — expected | `unassigned_total` should equal the difference |
| Totals look doubled | `travelers` is 2 and activities are per person | `activities_total` vs `manual_total` in the response |
| A hotel got doubled | the multiplier leaked onto `manual_total` | `get_budget` — only activities are scaled |
| Every day flagged over budget | the spend really is flat, and `threshold` is 1.0 | comparison is strictly `>`, so a flat spend flags nothing at 1.5 |
| Nothing ever flagged | one huge undated item inflates the average without landing on any day | give it an `incurred_on` |
| `by_category` shows only `ACTIVITIES` | correct when there are no manual items | use `by_activity_category` for the finer split |
| Deleting a stop deleted a cost | it should not — FK is `SET NULL` | if it cascaded, the FK was changed |
| Budget 404 on a trip you own | wrong trip id, or the item belongs to another trip | item lookups are trip-scoped |
| `/dashboard` `budget_highlight` is null | the account has no trips at all | past-only accounts fall back to the latest trip |
| Migration fails: *type budget_category already exists* | a re-run after a partial downgrade | `downgrade()` must drop the type |

---

## 11. Test map

[tests/test_budget.py](../tests/test_budget.py) — 26 tests. The fixtures use a
5-day trip with 2 travelers and a stop covering the first 3 days, so every
expected figure is small enough to verify mentally.

| Area | Tests |
|---|---|
| Totals | empty trip is all zeros, activities × travelers, manual items **not** × travelers |
| Per-day series | no gaps, correct order, sums to `grand_total`, undated money reported as the residual |
| Over budget | flagged against the average, a genuinely flat spend flags nothing, tunable threshold, out-of-range threshold rejected |
| Categories | `ACTIVITIES` bucket absorbs both sources, empty buckets omitted, `by_activity_category` keeps the finer split |
| Cities | rollup through stops including stop-attributed manual items, unassigned money reported not spread |
| Item CRUD | full lifecycle, `exclude_unset` patching, negative amount rejected, date outside trip rejected, cross-trip stop rejected |
| Cascades | deleting a trip removes its items; deleting a **stop** keeps the item and unassigns it |
| Ownership | 403 for another user, 401 with no session, 404 for an unknown trip |
| Dashboard | full payload, empty account, own trips only, requires a session |

A note on two of these: `test_a_genuinely_flat_spend_flags_nothing` builds its own
3-day trip because three busy days inside a five-day trip is *not* flat — those
days correctly get flagged, which is what caught my first version of the test.

---

## 12. Deferred out of this phase

| Item | Where it goes / why |
|---|---|
| Budget items on a **duplicated** trip | still not copied — `duplicate_trip` predates this table. Add it in Phase 6 when copy-a-public-trip lands, or copies will silently lose manual costs. **This is the one loose end.** |
| Currency conversion | not in v1 — one currency per trip is what makes these sums valid |
| Per-traveller split ("who owes what") | not in the PRD |
| A stored/cached total | deliberately not done; see §3 |
| Budget alerts or limits | no target-budget field exists; over-budget is relative to the trip's own average |

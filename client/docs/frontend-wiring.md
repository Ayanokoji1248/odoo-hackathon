# Frontend wiring — debugging notes

Phase 6 of [../../server/IMPLEMENTATION_PLAN.md](../../server/IMPLEMENTATION_PLAN.md):
replacing the client's `toast()`-over-`useState` writes with the API that already
exists. One section per task, appended as each lands.

**Shared entry points**

```bash
# both halves up
cd server && ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload   # :8000
cd client && npm run dev                                                   # :3000

# the client never calls :8000 directly - next.config.ts rewrites /api/v1/* to it.
# so a 404 on /api/v1/... in the browser means the rewrite, not the route.

# what is left to un-mock
grep -rn "@/data/mock" client/src

# typecheck + lint (both must be silent)
cd client && npx tsc --noEmit && npx eslint src --max-warnings=0
```

Demo login: `demo@globetrotter.app` / `demo12345`.

---

## Task 1 — Trip edit + delete ✅

### API: nothing new

`PATCH /api/v1/trips/{id}` and `DELETE /api/v1/trips/{id}` shipped in Phase 4 with
tests. Verified before touching the client, not assumed:

```bash
cd server && ./.venv/Scripts/python.exe -m pytest tests/test_trips.py -q \
  -k "patch or delete or orphan or shrink"      # 4 passed
```

Live round trip — this is the check to re-run if edit or delete ever breaks:

```bash
B=http://localhost:8000/api/v1
curl -s -c /tmp/c.txt -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@globetrotter.app","password":"demo12345"}' > /dev/null
ID=$(curl -s -b /tmp/c.txt -X POST $B/trips -H 'Content-Type: application/json' \
  -d '{"name":"probe","start_date":"2026-10-01","end_date":"2026-10-06"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
curl -s -b /tmp/c.txt -X PATCH $B/trips/$ID -H 'Content-Type: application/json' \
  -d '{"name":"renamed","travelers":3}'          # data.name == "renamed"
curl -s -b /tmp/c.txt -X DELETE $B/trips/$ID     # {"deleted":true}
curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/c.txt $B/trips/$ID   # 404
```

### Client

| File | Change |
|---|---|
| `lib/api/trips.ts` | new `updateTrip(id, partial)`. `deleteTrip` already existed and was never called. |
| `components/trips/TripEditDialog.tsx` | new — `TripEditDialog` + `TripDeleteDialog` |
| `components/trips/TripCard.tsx` | dropdown: Delete and a new "Edit details" are real; "Edit itinerary" still routes |
| `components/trips/TripHeader.tsx` | "Edit" opens the dialog instead of routing to the itinerary; a `⋮` menu adds Delete |
| `components/trips/TripsExplorer.tsx` | passes `onChanged` through to each card |
| `trips/page.tsx`, `trips/[tripId]/{,itinerary,budget,calendar}/page.tsx` | fetch extracted into a `load()` callback so `onChanged` can refetch |

### Things that will bite

**`PATCH` only sends the keys you set.** `updateTrip` builds its body with
`!== undefined` checks: `undefined` means "leave the column alone", `""` clears it
to `null`. Spreading the whole form object instead would blank every field the
dialog does not show (`currency`, `cover_photo_url`).

**`PATCH` returns a trip with no `stops`.** The response is `TripListItem`, not
`TripRead`. Anything showing the tree must refetch — hence `onChanged` rather than
using the PATCH result as new state. `toTrip()` maps the missing key to `[]`, so
trusting it would silently empty the itinerary on screen.

**Shrinking the dates is a 409, not a 400,** and its `details[]` names every stop
that would be orphaned. The dialog renders those lines inline because they *are*
the fix instructions; a toast would truncate them. Reproduce:

```bash
curl -s -b /tmp/c.txt -X PATCH $B/trips/<seeded-trip-id> \
  -H 'Content-Type: application/json' -d '{"end_date":"2026-09-21"}'
# CONFLICT + details: Paris / Rome / Barcelona with their date ranges
```

**Dialogs are mounted, not toggled** — `{editing && <TripEditDialog …/>}`, no `open`
prop. Keeping them mounted meant resetting five `useState`s from a `useEffect` on
open, which `react-hooks/set-state-in-effect` rejects (correctly: it is a cascading
render). Unmounting makes the `useState` initialisers do it for free.

**Delete from the trip detail page routes away** (`router.push("/trips")`); delete
from a card only refetches the list. Same dialog, different `onDeleted`.

### Deliberately not done here

- Cover photo: `POST /trips/{id}/cover` has no storage backend (Phase 4 deferral),
  and the dialog does not offer the `cover_photo_url` text field because a URL box
  is worse than no box. Cards keep the Unsplash fallback.
- Currency: single-currency in v1, so editing it would let one trip's totals mix.
- Share buttons on `TripCard` and `TripHeader` are **still `toast()` stubs** — there
  is no share endpoint until Phase 7. They are commented as such in both files so
  the next reader does not mistake them for regressions.

---

## Task 2 — Itinerary stops: add, edit, reorder, delete ✅

The screen that most looked finished and saved nothing. `SectionItineraryBuilder`
held an array of invented "sections" — free-text place, a per-section budget that
existed nowhere in the schema — in `useState`, and its Save button was a `toast()`.
Deleted, not repaired: the data model was wrong, not the wiring.

### API: nothing new

All five stop routes shipped in Phase 4. Verified first:

```bash
cd server && ./.venv/Scripts/python.exe -m pytest tests/test_trips.py -q -k stop   # 9 passed
```

### Client

| File | Change |
|---|---|
| `components/itinerary/ItineraryBuilder.tsx` | new — the real stop list. Replaces `SectionItineraryBuilder.tsx` (deleted) |
| `components/itinerary/StopDialog.tsx` | new — add/edit one stop; city picked from the live catalogue |
| `lib/api/trips.ts` | new `updateStop()` — the one stop endpoint with no client function |
| `lib/api/client.ts` | new `errorMessages()` — flattens `error.details[]`, shared with `TripEditDialog` |
| `trips/[tripId]/itinerary/page.tsx` | fetches `getTripTree` (not `getTrip`) and passes the raw stops down |

### Things that will bite

**`getTrip` is not enough for this screen.** `toTrip()` maps a stop to
`{cityName, country, dates}` and *drops* `id`, `order_index`, `notes` and
`activities` — every field an editor needs. The page uses `getTripTree()` and hands
the builder `ApiTripStop[]` in wire shape, then derives the `Trip` for the header
with `toTrip()`. One request, no lossy round trip.

**Reorder needs the complete id list.** A partial one is rejected on purpose:
`The stops order must list every id exactly once (2 expected, 1 given)`. `move()`
swaps two entries in the full array and sends all of it.

**Mutate then refetch — never patch local state.** Delete reindexes `order_index`
to a dense `0..n-1`, and reorder rewrites every row. Any client-side copy is stale
the instant either fires, so every action ends in `onChanged()`, and `busy` locks
the row buttons until the refetch lands.

**Three different failures, three different treatments:**

| API says | UI does |
|---|---|
| `warnings: ["Overlaps stop 1 …"]` on 200 | info toast — overlaps are legal, travel days really do overlap |
| `VALIDATION_ERROR` stop dates outside the trip | prevented up front: the pickers carry `min`/`max` from the trip and Save disables |
| `CONFLICT` + `details[]` — activities outside the stop's new dates | listed inline in the dialog; the messages name each activity and its date |

Reproduce the 409 (the one worth re-checking, it is easy to regress):

```bash
# add an activity, then move the stop off it
curl -s -b /tmp/c.txt -X PATCH $B/trips/$TID/stops/$SID \
  -H 'Content-Type: application/json' -d '{"start_date":"2026-11-09","end_date":"2026-11-09"}'
# CONFLICT | Some activities fall outside the stop's new dates - move them first
#          | [{"field":"activities","message":"Park Picnic in Udaipur on 2026-11-07"}]
```

**`react-hooks/set-state-in-effect` will reject an `async` loader.** `load()` is
written with `.then`, not `async`/`await`, and still returns its promise so
`onChanged()` can be awaited. Same shape in all five trip pages.

### Found here, owed by task 3

`add_activity` checks `scheduled_date` against the stop and the activity against
the catalog — but never that the activity's city **is** the stop's city:

```bash
# a Udaipur activity, attached to a New York stop, 201 Created
curl -s -b /tmp/c.txt -X POST $B/trips/$TID/stops/$NEW_YORK_STOP/activities \
  -H 'Content-Type: application/json' \
  -d '{"activity_id":"<udaipur-activity>","scheduled_date":"2026-11-07"}'
```

Task 3 fixes it in `trip_service.add_activity` and filters the picker by the stop's
city. Server-side too, not just the picker — a client-only filter leaves the hole
open to anyone with curl.

### Deliberately not done here

- **Drag-and-drop reordering.** Up/down buttons hit the same endpoint, work on
  touch, and need no dependency. Add a drag library when someone asks for it.
- **Adding activities from inside a stop.** The stop card lists its activities
  read-only with per-stop cost; the add/remove controls are task 3.
- **The per-section budget field** from the old builder is gone. It mapped to no
  column — trip cost is activities × travellers plus `budget_items` (task 5).

---

## Task 3 — Trip activities: add and remove ✅

### API: one real fix

This is the first task in the phase that needed server work, and it was a bug the
client wiring exposed rather than a missing route.

`trip_service.add_activity` checked the `scheduled_date` against the stop, and the
activity against the catalogue — but never that the activity's city **was** the
stop's city. A Paris museum attached to a New York stop with a 201, and
`budget_service`'s per-city rollup then filed its cost under New York. Now:

```
VALIDATION_ERROR -> Paris History Museum is not in New York
                    - pick an activity from this stop's city, or add a custom one by name
```

Two tests cover it, and the guard is deliberately narrow — a **custom** activity
(name only, no `activity_id`) has no catalogue row and therefore no city to match,
so it stays unrestricted:

```bash
cd server && ./.venv/Scripts/python.exe -m pytest tests/ -q      # 128 passed
```

Fixing it server-side was the point. Filtering the picker by city on the client
alone would have left the hole open to anyone with curl — and the picker filter is
now a convenience, not the enforcement.

### Client

| File | Change |
|---|---|
| `components/itinerary/ActivityPickerDialog.tsx` | new — browse that stop's city, multi-select, pick a day, or type a custom one |
| `components/activities/AddToTripDialog.tsx` | new — the catalogue card's "Add to Trip" |
| `components/itinerary/ItineraryBuilder.tsx` | per-stop "Add activity in X"; per-row `×` to remove |
| `components/activities/ActivityCard.tsx` | "Add Activity" toast → "Add to Trip" dialog |

### Things that will bite

**The catalogue page has no trip context.** `ActivityCard` sits on `/activities`,
which knows nothing about trips, and the API will only take the activity on a stop
in its city. So `AddToTripDialog` works backwards: list the user's trips, keep the
ones whose `cityNames` include this activity's city, fetch only those trees, and
offer their matching stops. No match is not an error — it says "none of your trips
stop in Paris yet" and links to /trips.

The `cityNames` prefilter is a **name** match on the cheap list response; the real
filter is `stop.city_id === activity.cityId`. A same-name city in another country
only costs one wasted request, never a wrong stop.

**Adds are sequential, not `Promise.all`.** `order_index` is assigned per request
from `max(order_index) + 1` for that stop and day, so firing five in parallel makes
the resulting order arbitrary. The picker's loop is deliberate.

**Custom activities cost 0.00.** There is no catalogue row to snapshot a price from,
and inventing one would be a lie. The dialog's hint says so. Editing a saved
activity's cost is `PATCH .../activities/{id}` — built, still unwired (nobody has
asked for it; the budget total is what people actually check).

**Deleting an activity reindexes the rest of that day.** Same reason the stop list
refetches: every action ends in `onChanged()`, never a local splice.

### Where to check it

Both halves running (`server` on :8000, `client` on :3000), signed in as
`demo@globetrotter.app` / `demo12345`:

| Check | Where | Expect |
|---|---|---|
| Add from inside a stop | `/trips/<id>/itinerary` → **Add activity in <city>** | Only that city's activities listed. Pick 2, choose a day, Add → both appear on the stop, cost and header total go up |
| Custom activity | same dialog → "Or add your own" | Appears on the stop at 0.00 |
| Remove one | hover an activity row → `×` | Row goes, totals drop, survives a reload |
| Add from the catalogue | `/activities` → **Add to Trip** | Lists only stops in that activity's city, across all your trips |
| The no-stop case | `/activities` → a city you have no stop in | "None of your trips stop in X yet" + link, no broken request |
| The guard itself | curl, below | 400, not 201 |

```bash
# a Paris activity onto a New York stop - must be refused
curl -s -b /tmp/c.txt -X POST $B/trips/$TID/stops/$NEW_YORK_STOP/activities \
  -H 'Content-Type: application/json' \
  -d '{"activity_id":"<paris-activity>","scheduled_date":"2026-11-02"}'
```

Then reload every page and confirm the numbers agree: the trip card's estimated
total, the itinerary header total, and `/trips/<id>/budget` are three independent
reads of the same rows.

### Deliberately not done here

- **Editing a saved activity** (time, cost, notes): `PATCH .../activities/{id}` and
  `.../activities/reorder` exist and stay unwired until something needs them.
- **Moving an activity between days or stops.** Remove and re-add covers it in two
  clicks; drag-across-days is a much bigger UI for the same result.

---

## Task 4 — Save / un-save a city ✅

`/saved` had a real endpoint behind it since Phase 3 and could still only ever be
empty: nothing in the app called `saveCity`. `CityCard`'s only button said
"Add to Trip" and toasted `"${city.name} added to your trip"`.

### API: nothing new

```bash
cd server && ./.venv/Scripts/python.exe -m pytest tests/test_catalog.py -q -k saved   # 3 passed
```

### Client

| File | Change |
|---|---|
| `components/cities/CityCard.tsx` | the lying "Add to Trip" is now a real **Save / Saved** toggle |
| `components/cities/CitiesExplorer.tsx` | loads the saved-id set on mount and feeds each card |
| `app/(dashboard)/saved/page.tsx` | un-saving drops the card; empty-state copy now matches the button |

### Things that will bite

**Never mirror a prop into state.** The first version did `useState(saved)` — and on
`/cities` the saved set arrives *after* mount, so every card froze at "Save" no
matter what was actually saved. The card now reads the prop directly and keeps only
an optimistic override:

```ts
const [pending, setPending] = useState<boolean | null>(null);
const on = pending ?? saved;   // prop is the truth; pending is in-flight only
```

**The API is not idempotent, but the button has to be.** Live behaviour:

| Call | Status |
|---|---|
| save a city | 201 |
| save the *same* city again | **409** |
| un-save it | 200 |
| un-save something never saved | **404** |
| either, signed out | 401 |

A 409-on-save or 404-on-un-save means the row is already exactly where the user
wanted it, so the card treats both as success. This is reachable in normal use: a
second tab, or a saved-list fetch that failed and left every city reading "Save".
Only 401 and real failures get an error toast.

**`/cities` is a server component**, so it cannot fetch the saved list — the session
cookie only travels with browser requests. `CitiesExplorer` is already
`"use client"`, so the fetch lives there. Same reason `/saved` has always been a
client component.

### Where to check it

| Check | Where | Expect |
|---|---|---|
| Save | `/cities` → **Save** on any card | Button flips to outline **Saved** instantly, toast confirms |
| It persisted | reload `/cities` | Still **Saved** — this is what the prop-mirroring bug broke |
| It landed | `/saved` | The city is there |
| Un-save from Saved | `/saved` → **Saved** | Card disappears from the list |
| Un-save from Explore | `/cities` → **Saved** | Flips back to **Save**, gone from `/saved` |
| Empty state | un-save everything | "Nothing saved yet — hit Save on any city in Explore" |
| Two tabs | save in tab A, click Save in stale tab B | No error toast; tab B just settles on Saved |

```bash
# the two non-obvious statuses, straight from the API
curl -s -b /tmp/c.txt -X POST $B/users/me/saved-destinations \
  -H 'Content-Type: application/json' -d '{"city_id":"<same-city-twice>"}'   # 409
curl -s -b /tmp/c.txt -X DELETE $B/users/me/saved-destinations/<never-saved> # 404
```

**`/saved` had no way in.** It was URL-only - no nav entry, no link from the
profile page. Added in two places, both cheap: a bookmark icon in the header (left
of the bell, visible on mobile too) and a **Saved** entry under the Explore
dropdown, which the mobile menu renders from the same `topNav` constant.

### Deliberately not done here

- **A Saved slot in the mobile bottom bar.** It holds five items and all five earn
  their place; the header bookmark is visible on mobile, so nothing is unreachable.
- **"Add city to trip" from the city card.** It looked like a missing feature but it
  is not: `/trips/<id>/itinerary` → **Add stop** searches the same catalogue and
  already has the trip and its date bounds in hand. A second path to `POST /stops`
  would need a trip picker and its own date validation for no new capability, so the
  card does one true thing instead of two, one of them a lie.
- **A saved count anywhere in the nav.** Nothing asked for it.

---

## Task 5 — Manual budget items ✅

The budget screen drew four charts off a total that only ever counted activities.
For a real trip that is the small half — flights and a hotel dwarf a museum pass —
so every number on the page was honest arithmetic on incomplete data.

### API: nothing new

All four routes shipped in Phase 5, including `PATCH`.

```bash
cd server && ./.venv/Scripts/python.exe -m pytest tests/test_budget.py -q   # 26 passed
```

### Client

| File | Change |
|---|---|
| `components/budget/ManualCosts.tsx` | new — the list, plus an add/edit dialog in the same file |
| `lib/api/budget.ts` | `BUDGET_CATEGORIES` + `budgetCategoryLabel()` exported; new `updateBudgetItem()`; `addBudgetItem` now shares one body builder |
| `trips/[tripId]/budget/page.tsx` | fetches items alongside the summary, re-fetches both on change |

### Things that will bite

**There is no stored total to patch.** `budget_service` computes every figure on
read — deliberately, so an edited activity price cannot leave a stale cached total
behind. So adding an item must re-fetch the summary; the page requests trip, budget
and items together and hands the whole thing back down.

**Manual amounts are NOT multiplied by travellers.** Activity costs are per person
and the API scales them; a hotel room is not per person and is taken as entered.
Verified on a 2-traveller trip: one 17.27 activity → `activities_total` 34.54, a
420.00 hotel → `manual_total` 420.00. The dialog's hint and the card's subtitle both
say "a total, not per traveller", because getting this backwards is the easiest way
to double a budget.

**`""` must become `null`, and `undefined` must stay absent.** Date and city are
both optional *and* both clearable, so the body builder distinguishes them:

```ts
if (input.incurredOn !== undefined) body.incurred_on = input.incurredOn || null;
```

Sending `incurred_on: ""` is a 422; omitting the key on a `PATCH` silently keeps the
old date when the user meant to clear it. Confirmed live: `{"incurred_on": null}`
returns `incurred_on: None`.

**The amount field holds a string, not a number.** `useState(0)` makes an emptied
input snap back to `0`, which is unusable. It parses on submit and disables Save
while empty or negative.

**Two totals fall short of the grand total on purpose.** An undated item counts in
`grand_total` but cannot sit on the daily chart; an unassigned one cannot sit in the
per-city split. The API reports the gaps as `undated_total` / `unassigned_total`
rather than smearing the money across days, and `BudgetView` already prints both as
footnotes — they finally have something to report:

```
manual 1400.00 | grand 1434.54
by_category {TRANSPORT: 980.00, ACCOMMODATION: 420.00, ACTIVITIES: 34.54}
undated 980.00 | unassigned 980.00      # the flights
by_city [(New York, 454.54)]            # 34.54 activities + 420.00 hotel
```

### Where to check it

`/trips/<id>/budget`, signed in as `demo@globetrotter.app` / `demo12345`:

| Check | Do | Expect |
|---|---|---|
| It counts | **Add cost** → "Return flights", Transport, 980, no date, no city | Estimated Total jumps by 980. Donut gains a Transport slice |
| The undated footnote | same item | Under the daily chart: "Plus $980.00 with no set date, not shown above." |
| The unassigned footnote | same item | Under Spending by City: "$980.00 not tied to a city (flights, visas…)" |
| A dated, city-tagged cost | **Add cost** → hotel, pick a date and a city | That day's bar grows; that city's bar grows; both footnotes stay put |
| Not per traveller | trip with 2 travellers, 420 hotel | `manual_total` is 420, not 840. Activities beside it *are* doubled |
| Edit the amount | pencil on a row → 420 → 620 | Total rises 200. This is why `PATCH` got wired instead of delete-and-retype |
| Clear the date | pencil → blank the date → Save | Row shows "no date — not on the daily chart"; the undated footnote grows |
| Out-of-range date | try a date outside the trip | Save is disabled, and the picker's `min`/`max` prevents it. Via curl: 400 |
| Delete | trash on a row | Every total drops; reload agrees |
| Cross-check | compare with `/trips` card and the itinerary header | Card total = activities × travellers + manual. Itinerary header shows **activities only** — it is a different number by design |

```bash
curl -s -b /tmp/c.txt -X POST $B/trips/$TID/budget-items \
  -H 'Content-Type: application/json' \
  -d '{"category":"MISC","label":"Visa","amount":"50.00","incurred_on":"2026-12-25"}'
# incurred_on must fall inside the trip (2026-11-01 to 2026-11-05)
```

### Deliberately not done here

- **A target budget / "remaining" figure.** There is no cap column anywhere in the
  schema, and `BudgetView` already notes this: live budgets are estimates, so
  "remaining" would be invented. Adding a real cap is a migration, not a wiring job.
- **Per-traveller entry for manual costs.** "Split this hotel 2 ways" needs a flag
  on the row and the API takes the amount as final. Divide it yourself for now.
- **Receipts / actual-vs-planned.** No storage, no actual-spend column.

---

## Tasks 6 & 7 — Profile, account and password ✅

`SettingsPanel` had four sections and not one of them wrote anything: `Input`s with
`defaultValue` and no submit, `Toggle`s whose state died on reload, "Change
password" toasting *"Password reset link sent"*, and account deletion toasting
*"disabled in the demo"*. Meanwhile `POST /auth/reset-password` had no page at all.

### API: nothing new

```bash
cd server && ./.venv/Scripts/python.exe -m pytest tests/test_users.py tests/test_auth.py -q   # 37 passed
```

### Client

| File | Change |
|---|---|
| `lib/api/users.ts` | new — `updateProfile`, `changePassword`, `deleteAccount` |
| `lib/api/auth.ts` | new `resetPassword()`; `forgotPassword()` now returns the DEBUG token; `toUser`/`ApiUser` exported for reuse |
| `components/profile/SettingsPanel.tsx` | rebuilt: Profile / Password / Account, three real forms |
| `components/auth/ResetPasswordForm.tsx` + `app/(auth)/reset-password/page.tsx` | new |
| `components/auth/ForgotPasswordForm.tsx` | shows the dev token and a "Continue to reset" link |
| `app/(dashboard)/profile/page.tsx` | dropped the travel-style badges — always an empty array from the API |

### Two sections were deleted, not wired

**Preferences** (travel style, currency) and **Privacy** (four toggles) have no
columns behind them. Every switch reset on reload. They could not be made real
without a migration and an endpoint, so they are gone rather than lying. What
survives is what exists: `first_name`, `last_name`, `phone`, `city`, `country`,
`additional_info`, `language`.

`User.preferences` in the client types is still mostly invented defaults filled in
by `toUser()` — `language` is the only field with a column behind it.

### Things that will bite

**"Signs you out everywhere" is not true, and the copy says so.** This was worth
chasing down. `change_password` revokes every session row *and* clears this
browser's cookies — but `get_current_user` deliberately skips the revocation check
on the access-token hot path. `test_access_hot_path_does_not_check_session_revocation`
asserts exactly that. Measured across two cookie jars:

| After A changes the password | Result |
|---|---|
| A → `/auth/me` | **401** — its cookies were cleared in the response |
| B → `/auth/me` | **200** — B's access token is still inside its 15 minutes |
| B → `/auth/refresh` | **401** — the session row is revoked, so B cannot renew |

So: immediate here, ≤15 minutes elsewhere, and no way back in without the new
password. `SettingsPanel` and `ResetPasswordForm` both say that instead of
overclaiming. The stale "kills sessions immediately" line in
`IMPLEMENTATION_PLAN.md` (true of Phase 2, false since the Phase 4 retrofit) now
carries a correction.

**A wrong current password is a 401, and must not be retried.** `changePassword`
passes `{ retryOnUnauthorized: false }`, otherwise `apiFetch` bounces it through
`/auth/refresh` and the real message — "Current password is incorrect" — gets
replaced by a session error about a session that is perfectly healthy.

**After a password change the UI must leave.** The cookies are gone, so every
subsequent request 401s. `PasswordForm` calls `useAuth().logout()`, which ignores
the (expected) failed logout call, clears context and pushes `/login`.

**`reload()` after a profile save, not local state.** The provider holds the user
for the whole route group, so the navbar avatar and the profile header have to be
re-read — patching only the form would leave the rest of the shell stale.

**Deleting the account cannot log out afterwards.** The row is gone, so there is no
session to revoke; it just pushes `/signup`. Confirmed: `/auth/me` 401s and logging
in with the old credentials 401s.

**The reset flow needs the DEBUG token to be usable at all.** There is no mailer
(the `ponytail:` note in `routes/auth.py` says so), so `/auth/forgot-password`
returns `reset_token` in the response while `DEBUG=true`. `ForgotPasswordForm` now
shows it in an amber, explicitly-labelled dev panel with a link straight to
`/reset-password?token=…`. In production the field is absent and the panel never
renders. Without this, task 7 would have shipped a page nobody could reach.

**`useSearchParams` needs a `Suspense` boundary** or the whole route silently opts
out of static rendering.

### Where to check it

**Profile** — `/settings` → Profile:

| Check | Expect |
|---|---|
| Change first name, city, country, bio, language → Save | Toast, and the **navbar avatar initials + `/profile` header** change too, not just the form |
| Reload | Everything stuck |
| Blank the phone → Save | Cleared. It is `UNIQUE`, so `""` is sent as `null` — two blank accounts would otherwise collide |
| Email field | Disabled, with the reason in the hint |

**Password** — `/settings` → Password:

| Check | Expect |
|---|---|
| Wrong current password | "Current password is incorrect" inline — *not* a session error |
| New password under 8 chars | Save disabled, field explains |
| Mismatched confirm | "Does not match", Save disabled |
| A real change | Toast, then you land on `/login`. Old password no longer works |

**Reset** — the whole loop without an inbox:

1. `/forgot-password` → enter `demo@globetrotter.app` → **Send reset link**
2. Amber dev panel appears with the token → **Continue to reset**
3. `/reset-password?token=…` — token pre-filled. Set a new password
4. "Password updated" → **Go to sign in** → sign in with the new one
5. Go back and reuse the same token → *"Invalid or expired reset token"* (single use)
6. An unknown email still says "if that account exists" with **no** token — no enumeration

**Account** — `/settings` → Account: the Delete button opens a modal that stays
disabled until you type your email exactly. Use a throwaway signup, not the demo
account.

```bash
# the reset loop, headless
TOK=$(curl -s -X POST $B/auth/forgot-password -H 'Content-Type: application/json' \
  -d '{"email":"demo@globetrotter.app"}' | python -c 'import sys,json;print(json.load(sys.stdin)["data"]["reset_token"])')
curl -s -X POST $B/auth/reset-password -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOK\",\"new_password\":\"demo12345\"}"      # Password updated
curl -s -X POST $B/auth/reset-password -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOK\",\"new_password\":\"demo12345\"}"      # Invalid or expired
```

### Deliberately not done here

- **Avatar upload or an avatar-URL field.** `avatar_url` is a real column but there
  is no storage credential (same wall as trip covers), and a URL box is worse than
  no box. The `Avatar` component already renders initials.
- **Changing the sign-in email.** Needs a verify-new-address flow that does not
  exist; the field is disabled and says why.
- **The session list.** `GET /auth/sessions` and `DELETE /auth/sessions/{id}` are
  built and tested — a "signed-in devices" panel is a genuinely nice screen, but
  nobody has asked for it and it is not on the phase list.

---

## Task 9 — Admin ✅ (backend + frontend)

Taken out of order, ahead of sharing. The first task in this phase that needed a
whole new API surface: `router.py` had said *"Mounted as each phase lands: share,
admin"* since Phase 1, and `data/mock/admin.ts` invented 12,480 users.

### API: new — `/api/v1/admin/*`

`app/api/v1/routes/admin.py`, `app/services/admin_service.py`,
`app/schemas/admin.py`. **34 new tests, 160 total.**

| Route | |
|---|---|
| `GET /admin/stats` | counts, hidden counts, avg stops/trip, avg trip budget, 6-month sign-up and trip trends |
| `GET /admin/cities/top`, `/activities/top` | ranked by real usage |
| `GET /admin/users`, `PATCH /admin/users/{id}` | paginated + searchable; role and `is_active` only |
| `GET/POST/PATCH /admin/cities`, `/admin/activities` | catalogue CRUD, hidden rows included in the admin list |

**`require_admin` is on the router, not the routes.** A leaf that forgets its own
check is the failure mode that then cannot happen. Tests assert 401 signed out and
403 for a plain user across every GET *and* the writes.

**Nothing is ever hard deleted.** Users get `is_active=false`, which `get_current_user`
checks — so it bites on their very next request, unlike session revocation which
waits out the access token. Catalogue rows get `is_active=false` because trips
snapshot them and `activities.city_id` is `ON DELETE RESTRICT`.

**An admin cannot demote or deactivate themselves.** That is the one mistake the UI
could not undo — recovering would take a psql session. I also wrote a "last active
admin" guard and then deleted it: unreachable, because the actor is always an active
admin, so demoting anyone *else* always leaves at least one.

**`top_cities` counts `trip_stops`, not `cities.popularity_score`.** The score is an
editorial number an admin types in; ranking by it would just reflect their own
guesses back at them. Verified with a fixture where the two orders disagree.

### The separate admin login

The ask was "admin login will be different than the normal one". Built as a separate
**door**, not a separate auth system: `/admin/login` is its own dark-themed screen at
its own URL, and correct credentials for a non-admin account **do not get in** — the
session is revoked again immediately, so the admin door can never leave a
plain-traveller session behind.

Underneath it posts to the same `/auth/login`. One user table, one password hash, one
session mechanism, and exactly one place where admin access is decided
(`require_admin`). A second credential store would double the attack surface and give
two things to keep in sync for nothing this screen does not already provide. If you
want genuinely separate staff credentials, say so — it is a different job, and worth
saying out loud that it is usually a step backwards.

**Route layout:** `/admin/login` had to sit *outside* the guarded layout, or it would
redirect to itself forever. So the panel moved into a `(panel)` route group —
`app/admin/(panel)/{layout,page}.tsx` — which changes no URLs, and the guard now
sends signed-out visitors to `/admin/login` instead of `/login`.

### Client

| File | Change |
|---|---|
| `lib/api/admin.ts` | new — the whole surface |
| `app/admin/login/page.tsx` + `components/admin/AdminLoginForm.tsx` | new |
| `app/admin/(panel)/page.tsx` | real stats; was four hardcoded numbers |
| `components/admin/ManageCatalog.tsx` | new — cities and activities CRUD, the admin's actual job |
| `components/admin/ManageUsers.tsx` | rebuilt: server-side search/filter/paginate, real role and status actions |
| `components/admin/AdminCharts.tsx` | takes props; empty states instead of invented curves |
| `data/mock/admin.ts` | **deleted** |

### Things that will bite

**Search and filter are server-side.** Filtering a page of ten in the browser would
silently hide every match on page two — precisely the bug a user-management screen
must not have. `?search=` also has its LIKE wildcards escaped: a typed `%` returns
nothing rather than everything.

**Reset the page in the change handler, not an effect.** `useEffect(() => setPage(1),
[search])` is a cascading render and `react-hooks/set-state-in-effect` rejects it.
Each filter's own handler does both.

**Whole-number chart axes.** These are counts of rows; recharts will happily label a
tick "1.5 users".

**Seed the admin, or the panel is unreachable.** `admin@globetrotter.app` /
`admin12345`, and the seed re-asserts the role on every run — otherwise testing the
demote button once locks you out of the screen you were testing.

### Where to check it

Re-run the seed first, or there is no admin account:

```bash
cd server && ./.venv/Scripts/python.exe -m app.db.seed        # prints both logins
./.venv/Scripts/python.exe scripts/check_admin.py             # 30 live assertions
./.venv/Scripts/python.exe -m pytest tests/test_admin.py -q   # 32 passed
```

| # | Where | Do | Expect |
|---|---|---|---|
| 1 | `/admin/login` | sign in with `demo@globetrotter.app` / `demo12345` | **Refused** — "valid, but not an administrator", and you are signed out again |
| 2 | `/admin/login` | sign in with `admin@globetrotter.app` / `admin12345` | Lands on `/admin` |
| 3 | `/admin` signed out | visit directly | Redirects to `/admin/login`, not `/login` |
| 4 | `/admin` as the demo user | visit directly | Bounced to `/dashboard` |
| 5 | `/admin` | read the four stat cards | Real counts. They match `check_admin.py`'s output |
| 6 | Catalogue → Cities | **New city** | Appears immediately, and in `/cities` in the traveller app |
| 7 | same | add it twice | *"… is already in the catalogue"* — a 409, not a 500 |
| 8 | same | eye icon to hide a city | Row dims to "hidden"; gone from `/cities`; **still listed here** so it can come back |
| 9 | Catalogue → Activities | edit a price on an activity already in a saved trip | Catalogue changes; that trip's budget **does not** — the snapshot holds |
| 10 | Manage users | search, filter by status, sort by trips | All server-side; page count updates |
| 11 | same | shield icon on another user | Promotes/demotes; badge flips |
| 12 | same | ban icon on another user | Deactivated. In their browser, the very next request 401s |
| 13 | same | look at your own row | Both buttons disabled — "you cannot change your own role" |
| 14 | Trends | scroll down | Six real months. Empty states, not fake curves, when there is no data |

Row 9 is the one worth doing deliberately: it is the reason catalogue rows are
snapshotted onto `trip_activities` at all.

### Deliberately not done here

- **Deleting users or catalogue rows.** Covered above: deactivate and hide. A real
  delete would either error on the FK or orphan someone's saved plan.
- **"View this user's trips."** The mock had an eye icon that toasted. There is no
  endpoint, and one would need its own privacy decision — an admin reading private
  itineraries is a policy question, not a wiring task. The trip *count* is in the
  table, which is what the brief asked for.
- **Editing a city's lat/long.** In the schema, unused by any screen.
- **Image upload.** Same missing storage credential as trip covers and avatars; both
  catalogue dialogs take a URL and say so.

---

## Task 8 — Share, public view, copy ✅ (backend + frontend)

The one that makes the app feel finished, and the one where the mock was most
misleading: `lib/api/shares.ts` served a fabricated `SharedTrip` with 1,284 views
and 47 copies, and every Share button in the app was a `toast("Share link copied")`
that copied nothing.

### API: new — sharing + a genuinely public surface

`app/api/v1/routes/share.py` (two routers: one nested under the owner's trip, one
public), plus `share_trip` / `unshare_trip` / `get_public_trip` / `count_copies` /
`owner_display_name` in `trip_service`. **13 new tests, 173 total.**

| Route | Auth |
|---|---|
| `POST` / `DELETE /trips/{id}/share` | owner |
| `GET /public/trips/{slug}` | **none** |
| `GET /public/trips/{slug}/budget` | **none** |
| `POST /public/trips/{slug}/copy` | any signed-in user |

Two routers rather than one, so a public path cannot pick up an auth dependency by
accident — the mirror of why `require_admin` sits on the admin router.

### Things that will bite

**Sharing is idempotent; un-sharing is not, and that asymmetry is deliberate.**
A second `POST /share` returns the slug it already had — otherwise re-opening the
dialog would quietly break a link somebody already had. `DELETE /share` clears the
**slug** as well as the flag, so re-sharing later mints a different one. Reviving
the old slug would hand access back to everyone who ever saw it. The dialog says
this on screen, because "make private, then public again" reads like it should be
reversible.

**404, never 403.** An un-shared or non-existent slug both answer 404. A 403 would
confirm the trip exists, which is precisely what someone walking the slug space
wants to learn.

**The PII test greps the raw body.** `PublicTripRead` adds only `owner_name` to
`TripRead`, which has no `user_id` — but "I think it's fine" is not a check. The
test asserts the registered account's email, phone, city and bio appear nowhere in
the response text, so a leak nested inside a stop fails it too. The live script does
the same against the dev server.

**`copy_count` is real and free** — `COUNT(copied_from_trip_id)`. There is
deliberately **no view count**: that needs a column and a write on every public GET,
and nobody asked for it. The mock's "1,284 views" is gone rather than reimplemented,
and `views` / `ownerAvatar` are deleted from the `SharedTrip` type with a comment
saying why.

**A real bug this uncovered: `duplicate_trip` was dropping budget items.** Copying a
trip lost its flights and hotels, and the copy's total silently fell to activities
only. Fixed in the shared function — which also fixes the pre-existing
`POST /trips/{id}/duplicate` that nothing had called yet. Two details it needs:
old-stop-id → new-stop-id remapping so an item attributed to a city follows the
right one, and `incurred_on` shifting by the same offset while an undated item stays
undated.

**Copying while signed out is a 401, not a failure to handle.** `PublicTripStory`
catches it and redirects to `/login?next=/shared/<slug>`, so the viewer lands back on
the trip they wanted instead of on a dashboard.

**The clipboard can just say no.** `navigator.clipboard` needs a secure context and
can be denied. Both copy buttons catch it and say so — a success toast over a failed
write is the exact lie this whole phase has been removing.

**`/shared/[shareToken]` became `/shared/[slug]`** to match what the API calls it.
The public page is a **server** component: `/public/trips/{slug}` needs no cookie, so
there is nothing to forward, and a link pasted into a chat app renders real HTML
instead of a spinner. It has `generateMetadata` for the same reason.

### `/shared` changed meaning, on purpose

It used to be a directory of everyone's public trips, off `mockTrips`. It is now
**your** shared trips with their links.

Turning link-shared trips into a browsable feed is not a wiring decision — "public
by link" and "listed in a directory anyone can scroll" are different promises, and
silently upgrading one to the other would expose trips people only meant to hand to
a friend. A discovery feed needs its own opt-in flag and its own screen. Meanwhile
the page now answers the question that actually had no answer: *where do I find that
link again after I closed the dialog?*

### Client

| File | Change |
|---|---|
| `lib/api/shares.ts` | rewritten — was 100% mock |
| `components/share/ShareDialog.tsx` | new — toggle, link, copy, un-share warning |
| `components/share/PublicTripStory.tsx` | real copy + share actions, real copy count, no invented views |
| `app/shared/[slug]/page.tsx` | new — server-rendered, with metadata |
| `app/(dashboard)/shared/page.tsx` | rewritten as "my shared trips" |
| `lib/api/budget.ts` | `toBudget()` extracted so the public budget maps identically |
| `TripCard` · `TripHeader` · `ItineraryBuilder` | the three Share stubs are now one real dialog |
| `data/mock/{trips,itinerary,budget,users,cities,activities}.ts` | **deleted** |

### Where to check it

```bash
cd server && ./.venv/Scripts/python.exe scripts/check_share.py   # 40 live assertions
./.venv/Scripts/python.exe -m pytest tests/test_share.py -q      # 13 passed
```

| # | Where | Do | Expect |
|---|---|---|---|
| 1 | `/trips/<id>` | **Share** → **Create a public link** | A real link appears. Button label becomes "Sharing" |
| 2 | same dialog | **Copy** | Link on your clipboard |
| 3 | paste it in a **private window** | — | The itinerary renders with no login at all |
| 4 | that page | check the header | Owner's **name** only. No email anywhere — view source and search for it |
| 5 | that page | **Copy this trip** while signed out | Sent to `/login`, and back to the same trip after signing in |
| 6 | sign in as another account, then copy | — | Lands on **your** new trip. Stops, activities **and** the flights/hotel costs all came across |
| 7 | that copy | check dates and totals | Rebased, same shape, same total as the original |
| 8 | reload the public page | — | **Copies: 1** — real, not decorative |
| 9 | owner: `/shared` | — | The trip is listed with its link |
| 10 | owner: **Manage** → **Make private** | reload the public link | **404**, and the dialog warned you the link dies for good |
| 11 | owner: **Share** again | try the *old* link | Still 404. The new link works |
| 12 | try `/shared/notarealslug` | — | Not-found page, no hint that anything exists |

Rows 10–11 are the pair worth doing deliberately: they are the difference between
"private" meaning something and meaning nothing.

### Deliberately not done here

- **A public discovery feed** — see above. That is task 10 and a product call.
- **View counts.** No column, no request, and a write on every public read is not
  free. Copies are the honest metric and cost nothing.
- **Copy with a custom name.** The API takes `name`; the UI sends only `start_date`
  and lets the server default to "… (copy)". Rename it afterwards — the trip edit
  dialog from task 1 already does that.

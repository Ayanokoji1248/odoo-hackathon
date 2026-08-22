import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import event, func, select

from app.db.session import SessionLocal, engine
from app.models.trip import Trip, TripActivity, TripStop

TRIPS = "/api/v1/trips"

TODAY = date.today()
START = TODAY + timedelta(days=30)
END = START + timedelta(days=9)  # a 10-day trip


def d(value: date) -> str:
    return value.isoformat()


@pytest.fixture
async def trip(client, auth):
    r = await client.post(
        TRIPS,
        json={
            "name": "Euro Loop",
            "description": "Three cities",
            "start_date": d(START),
            "end_date": d(END),
            "travelers": 2,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]


@pytest.fixture
async def stops(client, trip, catalog):
    """Three consecutive, non-overlapping stops: Paris, Prague, Bangkok."""
    created = []
    for index, key in enumerate(("paris", "prague", "bangkok")):
        start = START + timedelta(days=index * 3)
        r = await client.post(
            f"{TRIPS}/{trip['id']}/stops",
            json={
                "city_id": str(catalog["cities"][key]),
                "start_date": d(start),
                "end_date": d(start + timedelta(days=2)),
            },
        )
        assert r.status_code == 201, r.text
        created.append(r.json()["data"]["stop"])
    return created


# --- trips --------------------------------------------------------------------


async def test_create_trip_derives_status_and_duration(client, trip):
    assert trip["status"] == "upcoming"
    assert trip["duration_days"] == 10
    assert trip["currency"] == "USD"
    assert trip["is_public"] is False
    assert trip["share_slug"] is None


async def test_trip_status_reflects_the_dates(client, auth):
    for name, start, end, expected in [
        ("Past", TODAY - timedelta(days=10), TODAY - timedelta(days=5), "past"),
        ("Now", TODAY - timedelta(days=1), TODAY + timedelta(days=1), "ongoing"),
        ("Later", TODAY + timedelta(days=5), TODAY + timedelta(days=6), "upcoming"),
    ]:
        r = await client.post(
            TRIPS, json={"name": name, "start_date": d(start), "end_date": d(end)}
        )
        assert r.json()["data"]["status"] == expected, name


async def test_end_before_start_is_rejected(client, auth):
    r = await client.post(
        TRIPS, json={"name": "Backwards", "start_date": d(END), "end_date": d(START)}
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_trip_list_is_scoped_filtered_and_paginated(client, auth, trip):
    await client.post(
        TRIPS,
        json={
            "name": "Old Trip",
            "start_date": d(TODAY - timedelta(days=20)),
            "end_date": d(TODAY - timedelta(days=15)),
        },
    )

    everything = await client.get(TRIPS)
    assert everything.json()["meta"]["total"] == 2

    upcoming = await client.get(TRIPS, params={"status": "upcoming"})
    assert [t["name"] for t in upcoming.json()["data"]] == ["Euro Loop"]

    past = await client.get(TRIPS, params={"status": "past"})
    assert [t["name"] for t in past.json()["data"]] == ["Old Trip"]

    found = await client.get(TRIPS, params={"search": "euro"})
    assert [t["name"] for t in found.json()["data"]] == ["Euro Loop"]

    page = await client.get(TRIPS, params={"limit": 1, "page": 1})
    assert len(page.json()["data"]) == 1
    assert page.json()["meta"]["total"] == 2


async def test_another_users_trip_is_403_and_a_missing_one_is_404(client, trip, make_client):
    async with make_client() as other:
        await other.post(
            "/api/v1/auth/register",
            json={
                "first_name": "Bob",
                "last_name": "Other",
                "email": "bob@example.com",
                "password": "hunter2hunter2",
            },
        )
        forbidden = await other.get(f"{TRIPS}/{trip['id']}")
        missing = await other.get(f"{TRIPS}/{uuid.uuid4()}")

    assert forbidden.status_code == 403, "the trip exists, the caller just may not see it"
    assert forbidden.json()["error"]["code"] == "FORBIDDEN"
    assert missing.status_code == 404


async def test_trip_routes_require_a_session(client, trip, make_client):
    async with make_client() as anon:
        assert (await anon.get(TRIPS)).status_code == 401
        assert (await anon.get(f"{TRIPS}/{trip['id']}")).status_code == 401


async def test_patch_updates_only_supplied_fields(client, trip):
    r = await client.patch(f"{TRIPS}/{trip['id']}", json={"travelers": 4})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["travelers"] == 4
    assert data["name"] == "Euro Loop"


async def test_shrinking_dates_past_a_stop_is_a_409_naming_it(client, trip, stops):
    r = await client.patch(
        f"{TRIPS}/{trip['id']}", json={"end_date": d(START + timedelta(days=1))}
    )
    assert r.status_code == 409
    body = r.json()["error"]
    assert body["code"] == "CONFLICT"
    # Every offending stop is named, not silently orphaned. All three overflow
    # here: even Paris runs to START+2, past the new end of START+1.
    assert len(body["details"]) == 3
    assert "Paris" in body["details"][0]["message"]
    assert [x["field"] for x in body["details"]] == ["stops[0]", "stops[1]", "stops[2]"]


async def test_deleting_a_trip_leaves_no_orphans(client, trip, stops, catalog):
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["louvre"]),
            "scheduled_date": stops[0]["start_date"],
        },
    )

    assert (await client.delete(f"{TRIPS}/{trip['id']}")).status_code == 200
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(Trip)) == 0
        assert await db.scalar(select(func.count()).select_from(TripStop)) == 0
        assert await db.scalar(select(func.count()).select_from(TripActivity)) == 0


# --- the nested read ----------------------------------------------------------


async def test_trip_detail_returns_the_whole_tree(client, trip, stops, catalog):
    for stop in stops:
        await client.post(
            f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
            json={"name": "Wander about", "scheduled_date": stop["start_date"]},
        )

    r = await client.get(f"{TRIPS}/{trip['id']}")
    assert r.status_code == 200, r.text
    tree = r.json()["data"]
    assert [s["city"]["name"] for s in tree["stops"]] == ["Paris", "Prague", "Bangkok"]
    assert all(len(s["activities"]) == 1 for s in tree["stops"])
    assert [s["order_index"] for s in tree["stops"]] == [0, 1, 2]


async def _count_selects(client, path: str) -> int:
    statements: list[str] = []

    def record(conn, cursor, statement, params, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", record)
    try:
        assert (await client.get(path)).status_code == 200
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", record)
    return len(statements)


async def test_trip_detail_query_count_does_not_grow_with_the_trip(
    client, auth, catalog
):
    """AC 3: no N+1. A 1-stop trip and a 5-stop trip must cost the same queries."""

    async def build(name: str, stop_count: int) -> str:
        created = await client.post(
            TRIPS, json={"name": name, "start_date": d(START), "end_date": d(END)}
        )
        trip_id = created.json()["data"]["id"]
        for index in range(stop_count):
            day = START + timedelta(days=index)
            stop = await client.post(
                f"{TRIPS}/{trip_id}/stops",
                json={
                    "city_id": str(catalog["cities"]["paris"]),
                    "start_date": d(day),
                    "end_date": d(day),
                },
            )
            stop_id = stop.json()["data"]["stop"]["id"]
            for label in ("one", "two"):
                await client.post(
                    f"{TRIPS}/{trip_id}/stops/{stop_id}/activities",
                    json={"name": label, "scheduled_date": d(day)},
                )
        return trip_id

    small = await build("Small", 1)
    large = await build("Large", 5)

    small_queries = await _count_selects(client, f"{TRIPS}/{small}")
    large_queries = await _count_selects(client, f"{TRIPS}/{large}")

    assert small_queries == large_queries, (
        f"query count grew with trip size: {small_queries} -> {large_queries}"
    )
    # session + user + ownership check + trip + stops + activities, plus the three
    # aggregate queries that fill activity_count / estimated_total / city_names.
    # The ceiling only guards against creep; the equality above is the real
    # N+1 guarantee.
    assert large_queries <= 9, f"{large_queries} SELECTs for one trip read"


# --- stops --------------------------------------------------------------------


async def test_stops_get_dense_order_and_a_nested_city(client, stops):
    assert [s["order_index"] for s in stops] == [0, 1, 2]
    assert stops[0]["city"]["name"] == "Paris"
    assert stops[0]["city"]["country"] == "France"


async def test_stop_outside_the_trip_range_is_rejected(client, trip, catalog):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops",
        json={
            "city_id": str(catalog["cities"]["paris"]),
            "start_date": d(END + timedelta(days=1)),
            "end_date": d(END + timedelta(days=2)),
        },
    )
    assert r.status_code == 400
    assert "inside the trip" in r.json()["error"]["message"]


async def test_overlapping_stops_are_allowed_but_warned_about(client, trip, stops, catalog):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops",
        json={
            "city_id": str(catalog["cities"]["retired"] if False else catalog["cities"]["paris"]),
            "start_date": stops[0]["start_date"],
            "end_date": stops[0]["end_date"],
        },
    )
    assert r.status_code == 201, "an overlap is a travel day, not an error"
    assert r.json()["data"]["warnings"], "but the client should be told"


async def test_non_overlapping_stops_warn_about_nothing(client, stops):
    assert stops[1]["order_index"] == 1
    # the fixture's three stops are consecutive
    assert all(not s.get("warnings") for s in stops)


async def test_deleting_a_stop_closes_the_index_gap(client, trip, stops):
    assert (
        await client.delete(f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}")
    ).status_code == 200

    remaining = await client.get(f"{TRIPS}/{trip['id']}/stops")
    rows = remaining.json()["data"]
    assert [s["order_index"] for s in rows] == [0, 1], "indexes must stay dense"
    assert [s["city"]["name"] for s in rows] == ["Prague", "Bangkok"]


async def test_reorder_rewrites_every_index_in_one_go(client, trip, stops):
    reversed_ids = [s["id"] for s in reversed(stops)]
    r = await client.patch(f"{TRIPS}/{trip['id']}/stops/reorder", json={"order": reversed_ids})
    assert r.status_code == 200, r.text
    assert [s["city"]["name"] for s in r.json()["data"]] == ["Bangkok", "Prague", "Paris"]

    # and it survives a reload
    again = await client.get(f"{TRIPS}/{trip['id']}/stops")
    assert [s["city"]["name"] for s in again.json()["data"]] == ["Bangkok", "Prague", "Paris"]


async def test_reorder_rejects_a_partial_or_duplicated_list(client, trip, stops):
    partial = await client.patch(
        f"{TRIPS}/{trip['id']}/stops/reorder", json={"order": [stops[0]["id"]]}
    )
    assert partial.status_code == 400

    duped = await client.patch(
        f"{TRIPS}/{trip['id']}/stops/reorder",
        json={"order": [stops[0]["id"], stops[0]["id"], stops[1]["id"]]},
    )
    assert duped.status_code == 400


async def test_a_stop_from_another_trip_is_a_404(client, auth, trip, stops):
    other = await client.post(
        TRIPS, json={"name": "Second", "start_date": d(START), "end_date": d(END)}
    )
    other_id = other.json()["data"]["id"]
    r = await client.patch(
        f"{TRIPS}/{other_id}/stops/{stops[0]['id']}", json={"notes": "hijack"}
    )
    assert r.status_code == 404


async def test_moving_a_stop_away_from_its_activities_is_a_409(client, trip, stops, catalog):
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={"name": "Museum", "scheduled_date": stops[0]["end_date"]},
    )
    r = await client.patch(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}",
        json={"end_date": stops[0]["start_date"]},
    )
    assert r.status_code == 409
    assert "Museum" in r.json()["error"]["details"][0]["message"]


# --- trip activities ---------------------------------------------------------


async def test_adding_from_the_catalog_snapshots_name_category_and_cost(
    client, trip, stops, catalog
):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["louvre"]),
            "scheduled_date": stops[0]["start_date"],
        },
    )
    assert r.status_code == 201, r.text
    item = r.json()["data"]
    assert item["name"] == "Louvre Museum Pass"
    assert item["category"] == "CULTURE"
    assert item["cost"] == "22.00"
    assert item["order_index"] == 0


async def test_editing_the_catalog_never_moves_a_saved_trips_price(
    client, trip, stops, catalog
):
    added = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["louvre"]),
            "scheduled_date": stops[0]["start_date"],
        },
    )
    item_id = added.json()["data"]["id"]

    async with SessionLocal() as db:
        from app.models.catalog import Activity

        catalog_row = await db.get(Activity, catalog["activities"]["louvre"])
        catalog_row.estimated_cost = 999
        catalog_row.name = "Renamed By Admin"
        await db.commit()

    tree = await client.get(f"{TRIPS}/{trip['id']}")
    saved = tree.json()["data"]["stops"][0]["activities"][0]
    assert saved["id"] == item_id
    assert saved["cost"] == "22.00", "the snapshot must not follow the catalog"
    assert saved["name"] == "Louvre Museum Pass"


async def test_retiring_a_catalog_row_keeps_the_itinerary_intact(
    client, trip, stops, catalog
):
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["louvre"]),
            "scheduled_date": stops[0]["start_date"],
        },
    )

    async with SessionLocal() as db:
        from app.models.catalog import Activity

        await db.delete(await db.get(Activity, catalog["activities"]["louvre"]))
        await db.commit()

    saved = (await client.get(f"{TRIPS}/{trip['id']}")).json()["data"]["stops"][0][
        "activities"
    ][0]
    assert saved["activity_id"] is None, "ON DELETE SET NULL"
    assert saved["name"] == "Louvre Museum Pass", "the snapshot survives"
    assert saved["cost"] == "22.00"


async def test_a_custom_activity_needs_only_a_name(client, trip, stops):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={"name": "Picnic by the river", "scheduled_date": stops[0]["start_date"]},
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["cost"] == "0.00"
    assert r.json()["data"]["activity_id"] is None


async def test_an_activity_needs_either_an_id_or_a_name(client, trip, stops):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={"scheduled_date": stops[0]["start_date"]},
    )
    assert r.status_code == 400


async def test_a_supplied_cost_overrides_the_catalog_price(client, trip, stops, catalog):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["louvre"]),
            "scheduled_date": stops[0]["start_date"],
            "cost": "5.50",
        },
    )
    assert r.json()["data"]["cost"] == "5.50"


async def test_an_activity_outside_its_stop_is_rejected(client, trip, stops):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={"name": "Too late", "scheduled_date": d(END)},
    )
    assert r.status_code == 400
    assert "inside the stop" in r.json()["error"]["message"]


async def test_activities_order_within_a_day_and_reindex_on_delete(client, trip, stops):
    day = stops[0]["start_date"]
    ids = []
    for label in ("First", "Second", "Third"):
        r = await client.post(
            f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
            json={"name": label, "scheduled_date": day},
        )
        ids.append(r.json()["data"]["id"])
    assert [0, 1, 2] == [
        a["order_index"]
        for a in (await client.get(f"{TRIPS}/{trip['id']}")).json()["data"]["stops"][0][
            "activities"
        ]
    ]

    await client.delete(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities/{ids[0]}"
    )
    remaining = (await client.get(f"{TRIPS}/{trip['id']}")).json()["data"]["stops"][0][
        "activities"
    ]
    assert [a["name"] for a in remaining] == ["Second", "Third"]
    assert [a["order_index"] for a in remaining] == [0, 1]


async def test_reordering_activities_within_a_day(client, trip, stops):
    day = stops[0]["start_date"]
    ids = []
    for label in ("A", "B", "C"):
        r = await client.post(
            f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
            json={"name": label, "scheduled_date": day},
        )
        ids.append(r.json()["data"]["id"])

    r = await client.patch(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities/reorder",
        json={"order": [ids[2], ids[0], ids[1]]},
    )
    assert r.status_code == 200, r.text
    assert [a["name"] for a in r.json()["data"]] == ["C", "A", "B"]


async def test_reordering_across_two_days_is_rejected(client, trip, stops):
    first, second = stops[0]["start_date"], stops[0]["end_date"]
    ids = []
    for label, day in (("Day one", first), ("Day two", second)):
        r = await client.post(
            f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
            json={"name": label, "scheduled_date": day},
        )
        ids.append(r.json()["data"]["id"])

    r = await client.patch(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities/reorder",
        json={"order": ids},
    )
    assert r.status_code == 400
    assert "one day at a time" in r.json()["error"]["message"]


async def test_updating_an_activity(client, trip, stops):
    added = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={"name": "Lunch", "scheduled_date": stops[0]["start_date"]},
    )
    item_id = added.json()["data"]["id"]

    r = await client.patch(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities/{item_id}",
        json={"cost": "12.75", "start_time": "13:30:00", "notes": "book ahead"},
    )
    assert r.status_code == 200, r.text
    item = r.json()["data"]
    assert item["cost"] == "12.75"
    assert item["start_time"] == "13:30:00"
    assert item["name"] == "Lunch"


# --- duplicate ----------------------------------------------------------------


async def test_duplicate_rebases_dates_and_keeps_provenance(client, trip, stops, catalog):
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["louvre"]),
            "scheduled_date": stops[0]["start_date"],
        },
    )

    new_start = TODAY + timedelta(days=100)
    r = await client.post(
        f"{TRIPS}/{trip['id']}/duplicate", json={"start_date": d(new_start)}
    )
    assert r.status_code == 201, r.text
    copy = r.json()["data"]

    assert copy["id"] != trip["id"]
    assert copy["name"] == "Euro Loop (copy)"
    assert copy["copied_from_trip_id"] == trip["id"]
    assert copy["is_public"] is False and copy["share_slug"] is None
    assert copy["start_date"] == d(new_start)
    # the 10-day span is preserved, not just the start
    assert copy["duration_days"] == trip["duration_days"]

    offset = new_start - START
    assert [s["city"]["name"] for s in copy["stops"]] == ["Paris", "Prague", "Bangkok"]
    assert copy["stops"][0]["start_date"] == d(START + offset)
    assert copy["stops"][0]["activities"][0]["scheduled_date"] == d(START + offset)
    assert copy["stops"][0]["activities"][0]["cost"] == "22.00"


async def test_duplicate_defaults_to_starting_today(client, trip, stops):
    r = await client.post(f"{TRIPS}/{trip['id']}/duplicate", json={})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["start_date"] == d(TODAY)


async def test_the_original_is_untouched_by_a_duplicate(client, trip, stops):
    await client.post(f"{TRIPS}/{trip['id']}/duplicate", json={})
    original = await client.get(f"{TRIPS}/{trip['id']}")
    assert original.json()["data"]["start_date"] == d(START)
    assert len(original.json()["data"]["stops"]) == 3

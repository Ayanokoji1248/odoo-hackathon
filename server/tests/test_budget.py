import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest

TRIPS = "/api/v1/trips"
DASHBOARD = "/api/v1/dashboard"

TODAY = date.today()
START = TODAY + timedelta(days=30)
END = START + timedelta(days=4)  # a 5-day trip, easy arithmetic


def d(value: date) -> str:
    return value.isoformat()


@pytest.fixture
async def trip(client, auth):
    """5 days, 2 travelers - so activity costs double."""
    r = await client.post(
        TRIPS,
        json={
            "name": "Budget Trip",
            "start_date": d(START),
            "end_date": d(END),
            "travelers": 2,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]


@pytest.fixture
async def stop(client, trip, catalog):
    """One stop covering the first three days."""
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops",
        json={
            "city_id": str(catalog["cities"]["paris"]),
            "start_date": d(START),
            "end_date": d(START + timedelta(days=2)),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]["stop"]


async def add_activity(client, trip, stop, name, day_offset, cost):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
        json={
            "name": name,
            "scheduled_date": d(START + timedelta(days=day_offset)),
            "cost": cost,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def budget(client, trip, **params):
    r = await client.get(f"{TRIPS}/{trip['id']}/budget", params=params)
    assert r.status_code == 200, r.text
    return r.json()["data"]


# --- totals -------------------------------------------------------------------


async def test_an_empty_trip_totals_zero(client, trip):
    b = await budget(client, trip)
    assert b["grand_total"] == "0.00"
    assert b["activities_total"] == "0.00"
    assert b["manual_total"] == "0.00"
    assert b["avg_per_day"] == "0.00"
    assert len(b["by_day"]) == 5, "every day still appears"
    assert all(day["amount"] == "0.00" for day in b["by_day"])


async def test_activity_costs_are_multiplied_by_travelers(client, trip, stop):
    await add_activity(client, trip, stop, "Museum", 0, "10.00")
    await add_activity(client, trip, stop, "Dinner", 1, "15.00")

    b = await budget(client, trip)
    assert b["travelers"] == 2
    # 25.00 per person, 2 travelers
    assert b["activities_total"] == "50.00"
    assert b["grand_total"] == "50.00"
    assert b["avg_per_day"] == "10.00", "50.00 over 5 days"


async def test_manual_items_are_not_multiplied_by_travelers(client, trip, stop):
    await add_activity(client, trip, stop, "Museum", 0, "10.00")
    r = await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "ACCOMMODATION", "label": "Hotel", "amount": "100.00"},
    )
    assert r.status_code == 201, r.text

    b = await budget(client, trip)
    assert b["activities_total"] == "20.00", "10 x 2 travelers"
    assert b["manual_total"] == "100.00", "one hotel room, not one per traveller"
    assert b["grand_total"] == "120.00"


# --- the per-day series -------------------------------------------------------


async def test_the_day_series_has_no_gaps(client, trip, stop):
    """AC 5: the chart needs a point for every day, including free ones."""
    await add_activity(client, trip, stop, "Only thing booked", 0, "30.00")

    b = await budget(client, trip)
    days = b["by_day"]
    assert len(days) == 5, "5 calendar days, 1 with a cost"
    assert [row["day"] for row in days] == [
        d(START + timedelta(days=i)) for i in range(5)
    ], "consecutive, in order"
    assert days[0]["amount"] == "60.00"
    assert [row["amount"] for row in days[1:]] == ["0.00"] * 4


async def test_the_day_series_sums_to_the_grand_total(client, trip, stop):
    await add_activity(client, trip, stop, "One", 0, "10.00")
    await add_activity(client, trip, stop, "Two", 2, "20.00")
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={
            "category": "MEALS",
            "label": "Lunch",
            "amount": "5.00",
            "incurred_on": d(START + timedelta(days=1)),
        },
    )

    b = await budget(client, trip)
    total = sum(Decimal(row["amount"]) for row in b["by_day"])
    assert total == Decimal(b["grand_total"]) == Decimal("65.00")


async def test_an_undated_item_counts_but_cannot_be_placed_on_a_day(client, trip, stop):
    await add_activity(client, trip, stop, "Thing", 0, "10.00")
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "MISC", "label": "Visa fee", "amount": "40.00"},
    )

    b = await budget(client, trip)
    assert b["grand_total"] == "60.00"
    assert b["undated_total"] == "40.00"
    day_sum = sum(Decimal(row["amount"]) for row in b["by_day"])
    assert day_sum == Decimal("20.00")
    assert day_sum + Decimal(b["undated_total"]) == Decimal(b["grand_total"]), (
        "the shortfall is exactly the undated money, which is why it is reported"
    )


# --- over budget --------------------------------------------------------------


async def test_over_budget_days_are_flagged_against_the_average(client, trip, stop):
    # 20 (x2 = 40) spread over 5 days -> avg 8.00, line at 12.00
    await add_activity(client, trip, stop, "Cheap", 0, "5.00")
    await add_activity(client, trip, stop, "Spendy", 1, "15.00")

    b = await budget(client, trip)
    assert b["avg_per_day"] == "8.00"
    flagged = [row["day"] for row in b["by_day"] if row["over_budget"]]
    assert flagged == [d(START + timedelta(days=1))], "only the 30.00 day beats 12.00"


async def test_a_genuinely_flat_spend_flags_nothing(client, auth, catalog):
    """Spending the same amount every single day means no day is an outlier.

    Note the spend has to cover the *whole* trip: three busy days inside a
    five-day trip is not flat, and those days correctly get flagged.
    """
    created = await client.post(
        TRIPS,
        json={"name": "Flat", "start_date": d(START), "end_date": d(START + timedelta(days=2))},
    )
    flat = created.json()["data"]
    made = await client.post(
        f"{TRIPS}/{flat['id']}/stops",
        json={
            "city_id": str(catalog["cities"]["paris"]),
            "start_date": d(START),
            "end_date": d(START + timedelta(days=2)),
        },
    )
    only_stop = made.json()["data"]["stop"]

    for offset in range(3):
        await add_activity(client, flat, only_stop, f"Day {offset}", offset, "10.00")

    b = await budget(client, flat)
    # this trip has the default 1 traveller, so no doubling here
    assert [row["amount"] for row in b["by_day"]] == ["10.00"] * 3
    assert b["avg_per_day"] == "10.00"
    assert not any(row["over_budget"] for row in b["by_day"])


async def test_the_threshold_is_tunable(client, trip, stop):
    await add_activity(client, trip, stop, "Cheap", 0, "5.00")
    await add_activity(client, trip, stop, "Spendy", 1, "15.00")

    strict = await budget(client, trip, threshold="1.0")
    assert sum(1 for row in strict["by_day"] if row["over_budget"]) == 2

    loose = await budget(client, trip, threshold="5")
    assert not any(row["over_budget"] for row in loose["by_day"])


async def test_an_out_of_range_threshold_is_rejected(client, trip):
    r = await client.get(f"{TRIPS}/{trip['id']}/budget", params={"threshold": "0.1"})
    assert r.status_code == 400


# --- category and city splits -------------------------------------------------


async def test_by_category_puts_activities_in_one_bucket(client, trip, stop, catalog):
    await add_activity(client, trip, stop, "Museum", 0, "10.00")
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "TRANSPORT", "label": "Flights", "amount": "300.00"},
    )
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "ACTIVITIES", "label": "Concert ticket", "amount": "50.00"},
    )

    b = await budget(client, trip)
    buckets = {row["category"]: row["amount"] for row in b["by_category"]}
    assert buckets["TRANSPORT"] == "300.00"
    # 10 x 2 travelers, plus the manual ACTIVITIES line - they add, not compete
    assert buckets["ACTIVITIES"] == "70.00"
    assert sum(Decimal(v) for v in buckets.values()) == Decimal(b["grand_total"])
    assert "MEALS" not in buckets, "empty buckets are omitted"


async def test_by_activity_category_keeps_the_finer_split(client, trip, stop, catalog):
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["louvre"]),  # CULTURE 22.00
            "scheduled_date": d(START),
        },
    )
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
        json={
            "activity_id": str(catalog["activities"]["seine"]),  # SIGHTSEEING 18.50
            "scheduled_date": d(START),
        },
    )

    b = await budget(client, trip)
    split = {row["category"]: row["amount"] for row in b["by_activity_category"]}
    assert split == {"CULTURE": "44.00", "SIGHTSEEING": "37.00"}, "each x2 travelers"


async def test_by_city_rolls_up_through_the_stops(client, trip, stop, catalog):
    await add_activity(client, trip, stop, "Paris thing", 0, "10.00")

    second = await client.post(
        f"{TRIPS}/{trip['id']}/stops",
        json={
            "city_id": str(catalog["cities"]["prague"]),
            "start_date": d(START + timedelta(days=3)),
            "end_date": d(END),
        },
    )
    prague = second.json()["data"]["stop"]
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{prague['id']}/activities",
        json={"name": "Prague thing", "scheduled_date": d(END), "cost": "30.00"},
    )
    # a manual cost attributed to the Prague stop
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={
            "category": "ACCOMMODATION",
            "label": "Prague hostel",
            "amount": "45.00",
            "trip_stop_id": prague["id"],
        },
    )

    b = await budget(client, trip)
    cities = {row["city_name"]: row["amount"] for row in b["by_city"]}
    assert cities["Paris"] == "20.00"
    assert cities["Prague"] == "105.00", "60.00 of activities plus the 45.00 hostel"
    assert b["unassigned_total"] == "0.00"
    assert sum(Decimal(v) for v in cities.values()) == Decimal(b["grand_total"])


async def test_an_unassigned_item_is_reported_not_spread(client, trip, stop):
    await add_activity(client, trip, stop, "Thing", 0, "10.00")
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "TRANSPORT", "label": "Flights", "amount": "500.00"},
    )

    b = await budget(client, trip)
    assert b["unassigned_total"] == "500.00"
    city_sum = sum(Decimal(row["amount"]) for row in b["by_city"])
    assert city_sum == Decimal("20.00")
    assert city_sum + Decimal(b["unassigned_total"]) == Decimal(b["grand_total"])


# --- budget items CRUD --------------------------------------------------------


async def test_budget_item_lifecycle(client, trip):
    created = await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={
            "category": "MEALS",
            "label": "Street food",
            "amount": "12.50",
            "incurred_on": d(START),
        },
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["data"]["id"]

    listed = await client.get(f"{TRIPS}/{trip['id']}/budget-items")
    assert [i["label"] for i in listed.json()["data"]] == ["Street food"]

    patched = await client.patch(
        f"{TRIPS}/{trip['id']}/budget-items/{item_id}",
        json={"amount": "20.00", "category": "MISC"},
    )
    assert patched.json()["data"]["amount"] == "20.00"
    assert patched.json()["data"]["label"] == "Street food", "omitted fields untouched"

    assert (
        await client.delete(f"{TRIPS}/{trip['id']}/budget-items/{item_id}")
    ).status_code == 200
    assert (await budget(client, trip))["grand_total"] == "0.00"


async def test_a_negative_amount_is_rejected(client, trip):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "MISC", "label": "Refund", "amount": "-5.00"},
    )
    assert r.status_code == 400


async def test_an_item_dated_outside_the_trip_is_rejected(client, trip):
    r = await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={
            "category": "MISC",
            "label": "Too early",
            "amount": "5.00",
            "incurred_on": d(START - timedelta(days=1)),
        },
    )
    assert r.status_code == 400
    assert "inside the trip" in r.json()["error"]["message"]


async def test_an_item_cannot_point_at_another_trips_stop(client, trip, auth, catalog):
    other = await client.post(
        TRIPS, json={"name": "Other", "start_date": d(START), "end_date": d(END)}
    )
    other_id = other.json()["data"]["id"]
    other_stop = await client.post(
        f"{TRIPS}/{other_id}/stops",
        json={
            "city_id": str(catalog["cities"]["paris"]),
            "start_date": d(START),
            "end_date": d(START),
        },
    )
    r = await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={
            "category": "MISC",
            "label": "Cross-trip",
            "amount": "5.00",
            "trip_stop_id": other_stop.json()["data"]["stop"]["id"],
        },
    )
    assert r.status_code == 404


async def test_budget_routes_enforce_ownership(client, trip, make_client):
    async with make_client() as other:
        await other.post(
            "/api/v1/auth/register",
            json={
                "first_name": "Eve",
                "last_name": "Other",
                "email": "eve@example.com",
                "password": "hunter2hunter2",
            },
        )
        assert (await other.get(f"{TRIPS}/{trip['id']}/budget")).status_code == 403
        assert (
            await other.post(
                f"{TRIPS}/{trip['id']}/budget-items",
                json={"category": "MISC", "label": "x", "amount": "1.00"},
            )
        ).status_code == 403

    async with make_client() as anon:
        assert (await anon.get(f"{TRIPS}/{trip['id']}/budget")).status_code == 401


async def test_deleting_a_trip_takes_its_budget_items(client, trip):
    from sqlalchemy import func, select

    from app.db.session import SessionLocal
    from app.models.budget import BudgetItem

    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "MISC", "label": "Thing", "amount": "5.00"},
    )
    await client.delete(f"{TRIPS}/{trip['id']}")

    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(BudgetItem)) == 0


async def test_deleting_a_stop_keeps_the_item_but_unassigns_it(client, trip, stop):
    """SET NULL, not CASCADE: dropping a city must not delete the flight there."""
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={
            "category": "TRANSPORT",
            "label": "Train to Paris",
            "amount": "60.00",
            "trip_stop_id": stop["id"],
        },
    )
    await client.delete(f"{TRIPS}/{trip['id']}/stops/{stop['id']}")

    items = (await client.get(f"{TRIPS}/{trip['id']}/budget-items")).json()["data"]
    assert len(items) == 1, "the cost survives"
    assert items[0]["trip_stop_id"] is None, "but is no longer attributed to a city"

    b = await budget(client, trip)
    assert b["grand_total"] == "60.00"
    assert b["unassigned_total"] == "60.00"


# --- dashboard ----------------------------------------------------------------


async def test_dashboard_is_one_call_with_everything(client, auth, trip, stop, catalog):
    await add_activity(client, trip, stop, "Thing", 0, "10.00")
    await client.post(
        TRIPS,
        json={
            "name": "Finished Trip",
            "start_date": d(TODAY - timedelta(days=10)),
            "end_date": d(TODAY - timedelta(days=8)),
        },
    )

    r = await client.get(DASHBOARD)
    assert r.status_code == 200, r.text
    data = r.json()["data"]

    assert data["counts"] == {"total": 2, "upcoming": 1, "ongoing": 0, "past": 1}
    assert [t["name"] for t in data["upcoming_trips"]] == ["Budget Trip"]
    assert data["popular_cities"], "the catalog block is filled"
    assert data["budget_highlight"]["trip"]["name"] == "Budget Trip"
    assert data["budget_highlight"]["grand_total"] == "20.00"


async def test_dashboard_survives_an_account_with_no_trips(client, auth):
    r = await client.get(DASHBOARD)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["counts"]["total"] == 0
    assert data["upcoming_trips"] == []
    assert data["budget_highlight"] is None


async def test_dashboard_needs_a_session(client, make_client):
    async with make_client() as anon:
        assert (await anon.get(DASHBOARD)).status_code == 401


async def test_dashboard_only_counts_your_own_trips(client, trip, make_client):
    async with make_client() as other:
        await other.post(
            "/api/v1/auth/register",
            json={
                "first_name": "Mal",
                "last_name": "Other",
                "email": "mal@example.com",
                "password": "hunter2hunter2",
            },
        )
        data = (await other.get(DASHBOARD)).json()["data"]
    assert data["counts"]["total"] == 0
    assert data["budget_highlight"] is None


async def test_budget_for_an_unknown_trip_is_404(client, auth):
    r = await client.get(f"{TRIPS}/{uuid.uuid4()}/budget")
    assert r.status_code == 404

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import User, UserRole

ADMIN = "/api/v1/admin"
TRIPS = "/api/v1/trips"

TODAY = date.today()
START = TODAY + timedelta(days=30)


def d(value: date) -> str:
    return value.isoformat()


async def _promote(email: str) -> None:
    async with SessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one()
        user.role = UserRole.ADMIN
        await db.commit()


@pytest.fixture
async def admin(client, auth):
    """The `auth` user, promoted. Its cookies are already in `client`'s jar, and
    the role is read fresh from the DB on every request - so no re-login."""
    await _promote(auth["email"])
    return auth


# --- the boundary -------------------------------------------------------------


ADMIN_GETS = ["/stats", "/cities/top", "/activities/top", "/users", "/cities", "/activities"]


@pytest.mark.parametrize("path", ADMIN_GETS)
async def test_signed_out_is_401(client, path):
    assert (await client.get(f"{ADMIN}{path}")).status_code == 401


@pytest.mark.parametrize("path", ADMIN_GETS)
async def test_plain_user_is_403(client, auth, path):
    r = await client.get(f"{ADMIN}{path}")
    assert r.status_code == 403, r.text
    assert r.json()["error"]["code"] == "FORBIDDEN"


async def test_writes_are_gated_too(client, auth, catalog):
    """The router-level dependency has to cover POST and PATCH, not just the
    reads someone remembered to check."""
    assert (
        await client.post(
            f"{ADMIN}/cities", json={"name": "Nowhere", "country": "Nowhere", "cost_index": 10}
        )
    ).status_code == 403
    paris = catalog["cities"]["paris"]
    assert (
        await client.patch(f"{ADMIN}/cities/{paris}", json={"is_active": False})
    ).status_code == 403


# --- analytics ----------------------------------------------------------------


async def test_stats_counts_and_trend_shape(client, admin, catalog):
    r = await client.get(f"{ADMIN}/stats")
    assert r.status_code == 200, r.text
    s = r.json()["data"]

    assert s["users_total"] == 1
    assert s["users_active"] == 1
    assert s["admins_total"] == 1
    assert s["cities_total"] == 4, "3 active + 1 retired"
    assert s["cities_hidden"] == 1
    assert s["activities_total"] == 6
    assert s["activities_hidden"] == 1
    assert s["currency"] == "USD"

    # Six gap-free months, oldest first, and this user landed in the last one.
    months = s["new_users_by_month"]
    assert len(months) == 6
    assert [m["month"] for m in months] == sorted(m["month"] for m in months)
    assert months[-1]["count"] == 1
    assert sum(m["count"] for m in months) == 1


async def test_avg_budget_matches_the_budget_service_arithmetic(client, admin, catalog):
    """Two travelers, one 22.00 activity, one 100.00 manual item. Activities scale
    with travelers, manual items do not: 22*2 + 100 = 144.00 on the only trip."""
    trip = (
        await client.post(
            TRIPS,
            json={
                "name": "Solo maths",
                "start_date": d(START),
                "end_date": d(START + timedelta(days=3)),
                "travelers": 2,
            },
        )
    ).json()["data"]
    stop = (
        await client.post(
            f"{TRIPS}/{trip['id']}/stops",
            json={
                "city_id": str(catalog["cities"]["paris"]),
                "start_date": d(START),
                "end_date": d(START + timedelta(days=2)),
            },
        )
    ).json()["data"]["stop"]
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
        json={"activity_id": str(catalog["activities"]["louvre"]), "scheduled_date": d(START)},
    )
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "TRANSPORT", "label": "Flights", "amount": "100.00"},
    )

    s = (await client.get(f"{ADMIN}/stats")).json()["data"]
    assert Decimal(s["avg_trip_budget"]) == Decimal("144.00")
    assert Decimal(s["avg_stops_per_trip"]) == Decimal("1.00")
    assert s["trips_total"] == 1


async def test_top_cities_counts_stops_not_popularity_score(client, admin, catalog):
    trip = (
        await client.post(
            TRIPS,
            json={
                "name": "Twice to Prague",
                "start_date": d(START),
                "end_date": d(START + timedelta(days=9)),
            },
        )
    ).json()["data"]
    # Prague twice, Paris once. Paris has the higher popularity_score (98 vs 84),
    # so a ranking that used it would put Paris first.
    for index, key in enumerate(("prague", "paris", "prague")):
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

    rows = (await client.get(f"{ADMIN}/cities/top?limit=5")).json()["data"]
    assert [(row["name"], row["trip_count"]) for row in rows] == [("Prague", 2), ("Paris", 1)]


async def test_top_activities_ignores_custom_ones(client, admin, catalog):
    trip = (
        await client.post(
            TRIPS,
            json={
                "name": "Paris",
                "start_date": d(START),
                "end_date": d(START + timedelta(days=3)),
            },
        )
    ).json()["data"]
    stop = (
        await client.post(
            f"{TRIPS}/{trip['id']}/stops",
            json={
                "city_id": str(catalog["cities"]["paris"]),
                "start_date": d(START),
                "end_date": d(START + timedelta(days=2)),
            },
        )
    ).json()["data"]["stop"]
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
        json={"activity_id": str(catalog["activities"]["louvre"]), "scheduled_date": d(START)},
    )
    # No activity_id, so it cannot be attributed to a catalog row.
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
        json={"name": "Dinner with a friend", "scheduled_date": d(START)},
    )

    rows = (await client.get(f"{ADMIN}/activities/top")).json()["data"]
    assert [(row["name"], row["add_count"]) for row in rows] == [("Louvre Museum Pass", 1)]
    assert rows[0]["city_name"] == "Paris"


# --- users --------------------------------------------------------------------


async def test_users_list_carries_trip_counts_and_searches(client, admin):
    trip = await client.post(
        TRIPS, json={"name": "One", "start_date": d(START), "end_date": d(START)}
    )
    assert trip.status_code == 201

    body = (await client.get(f"{ADMIN}/users")).json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["trip_count"] == 1
    assert body["data"][0]["role"] == "ADMIN"

    assert len((await client.get(f"{ADMIN}/users?search=lovelace")).json()["data"]) == 1
    assert len((await client.get(f"{ADMIN}/users?search=nobody")).json()["data"]) == 0
    # A LIKE wildcard typed by a user must be a literal, not an operator.
    assert len((await client.get(f"{ADMIN}/users?search=%25")).json()["data"]) == 0


async def test_deactivating_a_user_locks_them_out(client, admin, make_client, register_payload):
    # On its own client: /auth/register signs the new account in, which would
    # otherwise overwrite the admin's cookies in `client`'s jar.
    async with make_client() as bob:
        other = await bob.post(
            "/api/v1/auth/register",
            json={**register_payload, "email": "bob@example.com", "phone": "+91 90000 00001"},
        )
        assert other.status_code == 201, other.text
        target = other.json()["data"]["id"]
        assert (await bob.get("/api/v1/auth/me")).status_code == 200

        r = await client.patch(f"{ADMIN}/users/{target}", json={"is_active": False})
        assert r.status_code == 200, r.text
        assert r.json()["data"]["is_active"] is False

        # is_active is checked in get_current_user, so this bites immediately -
        # unlike session revocation, which waits for the access token to expire.
        assert (await bob.get("/api/v1/auth/me")).status_code == 401


async def test_promoting_and_demoting_another_user(client, admin, make_client, register_payload):
    async with make_client() as carol:
        other = await carol.post(
            "/api/v1/auth/register",
            json={**register_payload, "email": "carol@example.com", "phone": "+91 90000 00002"},
        )
    target = other.json()["data"]["id"]

    up = await client.patch(f"{ADMIN}/users/{target}", json={"role": "ADMIN"})
    assert up.status_code == 200, up.text
    assert up.json()["data"]["role"] == "ADMIN"

    # Demoting another admin is fine and never leaves zero: the actor is one.
    down = await client.patch(f"{ADMIN}/users/{target}", json={"role": "USER"})
    assert down.status_code == 200, down.text
    assert down.json()["data"]["role"] == "USER"


async def test_an_admin_cannot_lock_themselves_out(client, admin):
    me = admin["id"]

    demote = await client.patch(f"{ADMIN}/users/{me}", json={"role": "USER"})
    assert demote.status_code == 400
    assert "own admin role" in demote.json()["error"]["message"]

    off = await client.patch(f"{ADMIN}/users/{me}", json={"is_active": False})
    assert off.status_code == 400
    assert "own account" in off.json()["error"]["message"]

    # Still usable afterwards.
    assert (await client.get(f"{ADMIN}/stats")).status_code == 200


async def test_updating_a_missing_user_is_404(client, admin):
    r = await client.patch(
        f"{ADMIN}/users/00000000-0000-0000-0000-000000000000", json={"role": "USER"}
    )
    assert r.status_code == 404


# --- catalog ------------------------------------------------------------------


async def test_admin_city_list_shows_hidden_rows(client, admin, catalog):
    body = (await client.get(f"{ADMIN}/cities")).json()
    assert body["meta"]["total"] == 4, "the public list only ever shows 3"
    names = {row["name"]: row["is_active"] for row in body["data"]}
    assert names["Retired City"] is False
    # Active rows sort first, so the hidden one is last.
    assert body["data"][-1]["name"] == "Retired City"
    assert next(r for r in body["data"] if r["name"] == "Paris")["activity_count"] == 2


async def test_create_city_then_it_appears_publicly(client, admin):
    r = await client.post(
        f"{ADMIN}/cities",
        json={
            "name": "Reykjavik",
            "country": "Iceland",
            "region": "Europe",
            "cost_index": 85,
            "popularity_score": 60,
            "tags": ["Nature", "Northern lights"],
            "avg_daily_cost": "140.00",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["is_active"] is True

    public = (await client.get("/api/v1/cities?search=Reykjavik")).json()["data"]
    assert [c["name"] for c in public] == ["Reykjavik"]


async def test_duplicate_city_is_409_not_a_500(client, admin, catalog):
    r = await client.post(
        f"{ADMIN}/cities", json={"name": "Paris", "country": "France", "cost_index": 78}
    )
    assert r.status_code == 409, r.text
    assert "already in the catalog" in r.json()["error"]["message"]


async def test_cost_index_is_range_checked(client, admin):
    r = await client.post(
        f"{ADMIN}/cities", json={"name": "Bad", "country": "Nowhere", "cost_index": 500}
    )
    assert r.status_code == 400


async def test_hiding_a_city_removes_it_from_public_reads_only(client, admin, catalog):
    city_id = str(catalog["cities"]["paris"])
    r = await client.patch(f"{ADMIN}/cities/{city_id}", json={"is_active": False})
    assert r.status_code == 200
    assert r.json()["data"]["is_active"] is False

    assert (await client.get(f"/api/v1/cities/{city_id}")).status_code == 404
    # Still visible to the admin, so it can be brought back.
    rows = (await client.get(f"{ADMIN}/cities")).json()["data"]
    assert any(row["name"] == "Paris" for row in rows)

    back = await client.patch(f"{ADMIN}/cities/{city_id}", json={"is_active": True})
    assert back.status_code == 200
    assert (await client.get(f"/api/v1/cities/{city_id}")).status_code == 200


async def test_fixing_a_price_does_not_move_a_saved_trip(client, admin, catalog):
    """The whole reason catalog rows are snapshotted onto trip_activities."""
    trip = (
        await client.post(
            TRIPS,
            json={
                "name": "Snapshot",
                "start_date": d(START),
                "end_date": d(START + timedelta(days=2)),
            },
        )
    ).json()["data"]
    stop = (
        await client.post(
            f"{TRIPS}/{trip['id']}/stops",
            json={
                "city_id": str(catalog["cities"]["paris"]),
                "start_date": d(START),
                "end_date": d(START + timedelta(days=2)),
            },
        )
    ).json()["data"]["stop"]
    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stop['id']}/activities",
        json={"activity_id": str(catalog["activities"]["louvre"]), "scheduled_date": d(START)},
    )

    r = await client.patch(
        f"{ADMIN}/activities/{catalog['activities']['louvre']}", json={"estimated_cost": "99.00"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["estimated_cost"] == "99.00"

    saved = (await client.get(f"{TRIPS}/{trip['id']}")).json()["data"]
    assert saved["stops"][0]["activities"][0]["cost"] == "22.00"


async def test_create_activity_needs_a_real_city(client, admin):
    r = await client.post(
        f"{ADMIN}/activities",
        json={
            "city_id": "00000000-0000-0000-0000-000000000000",
            "name": "Ghost tour",
            "category": "CULTURE",
            "estimated_cost": "10.00",
        },
    )
    assert r.status_code == 404


async def test_create_activity_and_filter_by_city(client, admin, catalog):
    r = await client.post(
        f"{ADMIN}/activities",
        json={
            "city_id": str(catalog["cities"]["prague"]),
            "name": "Astronomical Clock",
            "category": "SIGHTSEEING",
            "estimated_cost": "0.00",
            "duration_minutes": 30,
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["city_name"] == "Prague"

    listed = (
        await client.get(f"{ADMIN}/activities?city_id={catalog['cities']['prague']}")
    ).json()
    assert listed["meta"]["total"] == 2
    assert {row["name"] for row in listed["data"]} == {
        "Prague Castle Tour",
        "Astronomical Clock",
    }


async def test_duplicate_activity_in_the_same_city_is_409(client, admin, catalog):
    r = await client.post(
        f"{ADMIN}/activities",
        json={
            "city_id": str(catalog["cities"]["paris"]),
            "name": "Louvre Museum Pass",
            "category": "CULTURE",
            "estimated_cost": "22.00",
        },
    )
    assert r.status_code == 409, r.text


async def test_admin_activity_list_shows_hidden_rows(client, admin, catalog):
    body = (await client.get(f"{ADMIN}/activities")).json()
    assert body["meta"]["total"] == 6, "the public list only ever shows 5"
    assert body["data"][-1]["name"] == "Retired Tour"
    assert body["data"][-1]["is_active"] is False

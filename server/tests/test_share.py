from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.budget import BudgetItem
from app.models.trip import Trip, TripStop

TRIPS = "/api/v1/trips"
PUBLIC = "/api/v1/public/trips"

TODAY = date.today()
START = TODAY + timedelta(days=30)
END = START + timedelta(days=9)


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
async def furnished(client, trip, catalog):
    """A trip with two stops, one catalog activity and two budget items - one
    attributed to a stop, one not. Enough for the copy to be worth checking."""
    stops = []
    for index, key in enumerate(("paris", "prague")):
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
        stops.append(r.json()["data"]["stop"])

    await client.post(
        f"{TRIPS}/{trip['id']}/stops/{stops[0]['id']}/activities",
        json={"activity_id": str(catalog["activities"]["louvre"]), "scheduled_date": d(START)},
    )
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={
            "category": "ACCOMMODATION",
            "label": "Hotel",
            "amount": "300.00",
            "incurred_on": d(START),
            "trip_stop_id": stops[0]["id"],
        },
    )
    await client.post(
        f"{TRIPS}/{trip['id']}/budget-items",
        json={"category": "TRANSPORT", "label": "Flights", "amount": "500.00"},
    )
    return {"trip": trip, "stops": stops}


async def share(client, trip_id: str) -> str:
    r = await client.post(f"{TRIPS}/{trip_id}/share")
    assert r.status_code == 200, r.text
    return r.json()["data"]["share_slug"]


# --- the toggle ---------------------------------------------------------------


async def test_a_new_trip_is_private_with_no_slug(client, trip):
    assert trip["is_public"] is False
    assert trip["share_slug"] is None


async def test_sharing_is_idempotent(client, trip):
    first = await share(client, trip["id"])
    assert len(first) >= 8

    # Calling again must not rotate the slug: links already sent out keep working.
    assert await share(client, trip["id"]) == first


async def test_unsharing_clears_the_slug_and_reshare_mints_a_new_one(client, trip):
    first = await share(client, trip["id"])

    off = await client.delete(f"{TRIPS}/{trip['id']}/share")
    assert off.status_code == 200
    assert off.json()["data"] == {"is_public": False, "share_slug": None}

    # The old link is dead, not merely dormant.
    assert (await client.get(f"{PUBLIC}/{first}")).status_code == 404

    second = await share(client, trip["id"])
    assert second != first
    assert (await client.get(f"{PUBLIC}/{first}")).status_code == 404
    assert (await client.get(f"{PUBLIC}/{second}")).status_code == 200


async def test_only_the_owner_can_share(client, trip, make_client, register_payload):
    async with make_client() as other:
        await other.post(
            "/api/v1/auth/register",
            json={**register_payload, "email": "eve@example.com", "phone": "+91 90000 00009"},
        )
        assert (await other.post(f"{TRIPS}/{trip['id']}/share")).status_code == 403
        assert (await other.delete(f"{TRIPS}/{trip['id']}/share")).status_code == 403


# --- reading it ---------------------------------------------------------------


async def test_a_stranger_can_read_a_shared_trip(client, furnished, make_client):
    slug = await share(client, furnished["trip"]["id"])

    async with make_client() as anon:
        r = await anon.get(f"{PUBLIC}/{slug}")
        assert r.status_code == 200, r.text
        body = r.json()["data"]

    assert body["name"] == "Euro Loop"
    assert [s["city"]["name"] for s in body["stops"]] == ["Paris", "Prague"]
    assert body["stops"][0]["activities"][0]["name"] == "Louvre Museum Pass"
    assert body["copy_count"] == 0
    # 22.00 x 2 travelers + 300 + 500
    assert Decimal(body["estimated_total"]) == Decimal("844.00")


async def test_the_public_payload_carries_no_owner_pii(client, furnished, make_client):
    slug = await share(client, furnished["trip"]["id"])

    async with make_client() as anon:
        raw = (await anon.get(f"{PUBLIC}/{slug}")).text
        body = (await anon.get(f"{PUBLIC}/{slug}")).json()["data"]

    assert body["owner_name"] == "Ada Lovelace"
    # The registered account's real details, none of which may appear anywhere in
    # the response - not even nested inside a stop.
    for secret in ("ada@example.com", "9876543210", "Bengaluru", "window seats"):
        assert secret not in raw, f"{secret} leaked into the public payload"
    assert "user_id" not in raw
    assert "password" not in raw


async def test_an_unshared_trip_is_404_never_403(client, trip, make_client):
    slug = await share(client, trip["id"])
    await client.delete(f"{TRIPS}/{trip['id']}/share")

    async with make_client() as anon:
        r = await anon.get(f"{PUBLIC}/{slug}")
    # 403 would confirm the trip exists, which is what a slug-prober wants.
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


async def test_a_nonsense_slug_is_404(client, make_client):
    async with make_client() as anon:
        assert (await anon.get(f"{PUBLIC}/notarealslug")).status_code == 404


async def test_the_public_budget_matches_the_owners(client, furnished, make_client):
    trip_id = furnished["trip"]["id"]
    slug = await share(client, trip_id)

    mine = (await client.get(f"{TRIPS}/{trip_id}/budget")).json()["data"]
    async with make_client() as anon:
        theirs = (await anon.get(f"{PUBLIC}/{slug}/budget")).json()["data"]

    assert mine["grand_total"] == theirs["grand_total"] == "844.00"
    assert mine["by_category"] == theirs["by_category"]


# --- copying ------------------------------------------------------------------


async def test_copying_needs_an_account(client, furnished, make_client):
    slug = await share(client, furnished["trip"]["id"])
    async with make_client() as anon:
        assert (await anon.post(f"{PUBLIC}/{slug}/copy", json={})).status_code == 401


async def test_a_copy_is_private_rebased_and_complete(
    client, furnished, make_client, register_payload
):
    slug = await share(client, furnished["trip"]["id"])
    new_start = TODAY + timedelta(days=100)

    async with make_client() as other:
        await other.post(
            "/api/v1/auth/register",
            json={**register_payload, "email": "mallory@example.com", "phone": "+91 90000 00010"},
        )
        r = await other.post(f"{PUBLIC}/{slug}/copy", json={"start_date": d(new_start)})
        assert r.status_code == 201, r.text
        copy = r.json()["data"]

        # It belongs to the copier and shows up in *their* list.
        listed = (await other.get(TRIPS)).json()["data"]
        assert [t["id"] for t in listed] == [copy["id"]]

    assert copy["is_public"] is False, "a copy is private until its new owner says otherwise"
    assert copy["share_slug"] is None
    assert copy["copied_from_trip_id"] == furnished["trip"]["id"]

    # Every date shifted by the same offset, so the shape of the trip survives.
    offset = new_start - START
    assert copy["start_date"] == d(START + offset)
    assert copy["end_date"] == d(END + offset)
    assert [s["city"]["name"] for s in copy["stops"]] == ["Paris", "Prague"]
    assert copy["stops"][0]["start_date"] == d(START + offset)
    assert copy["stops"][0]["activities"][0]["scheduled_date"] == d(START + offset)
    # The snapshot travels: an admin editing the catalog later cannot move it.
    assert copy["stops"][0]["activities"][0]["cost"] == "22.00"

    # Budget items come too - this is what silently went missing before.
    assert Decimal(copy["estimated_total"]) == Decimal("844.00")

    async with SessionLocal() as db:
        items = (
            await db.execute(select(BudgetItem).where(BudgetItem.trip_id == copy["id"]))
        ).scalars().all()
        assert {i.label for i in items} == {"Hotel", "Flights"}

        hotel = next(i for i in items if i.label == "Hotel")
        flights = next(i for i in items if i.label == "Flights")
        assert hotel.incurred_on == START + offset, "a dated item shifts with the trip"
        assert flights.incurred_on is None, "an undated one stays undated"

        # The hotel followed Paris into the copy, not the original's stop row.
        new_stops = (
            await db.execute(select(TripStop).where(TripStop.trip_id == copy["id"]))
        ).scalars().all()
        assert hotel.trip_stop_id in {s.id for s in new_stops}
        assert flights.trip_stop_id is None


async def test_copying_leaves_the_original_untouched_and_counts(
    client, furnished, make_client, register_payload
):
    trip_id = furnished["trip"]["id"]
    slug = await share(client, trip_id)

    async with make_client() as other:
        await other.post(
            "/api/v1/auth/register",
            json={**register_payload, "email": "trent@example.com", "phone": "+91 90000 00011"},
        )
        assert (await other.post(f"{PUBLIC}/{slug}/copy", json={})).status_code == 201
        assert (await other.post(f"{PUBLIC}/{slug}/copy", json={})).status_code == 201

    # The count is derived from copied_from_trip_id, so it cannot drift.
    body = (await client.get(f"{PUBLIC}/{slug}")).json()["data"]
    assert body["copy_count"] == 2

    original = (await client.get(f"{TRIPS}/{trip_id}")).json()["data"]
    assert original["start_date"] == d(START)
    assert len(original["stops"]) == 2

    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(Trip)) == 3


async def test_deleting_the_original_keeps_the_copies(
    client, furnished, make_client, register_payload
):
    """copied_from_trip_id is ON DELETE SET NULL, so provenance is lost but the
    copy is not."""
    trip_id = furnished["trip"]["id"]
    slug = await share(client, trip_id)

    async with make_client() as other:
        await other.post(
            "/api/v1/auth/register",
            json={**register_payload, "email": "peggy@example.com", "phone": "+91 90000 00012"},
        )
        copy_id = (await other.post(f"{PUBLIC}/{slug}/copy", json={})).json()["data"]["id"]

        assert (await client.delete(f"{TRIPS}/{trip_id}")).status_code == 200

        still = await other.get(f"{TRIPS}/{copy_id}")
        assert still.status_code == 200
        assert still.json()["data"]["copied_from_trip_id"] is None

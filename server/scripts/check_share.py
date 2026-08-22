"""End-to-end check of sharing against a running server.

Companion to check_admin.py. The suite covers the logic on an isolated database;
this drives the live dev server the frontend talks to, and in particular checks the
two things that are embarrassing to get wrong in public: that an un-shared link is
really dead, and that no owner PII rides along in the payload.

    ./.venv/Scripts/python.exe scripts/check_share.py
"""

import sys
import time
from datetime import date, timedelta

import httpx

BASE = "http://localhost:8000/api/v1"
OWNER = ("demo@globetrotter.app", "demo12345")

failures: list[str] = []


def check(label: str, got, want) -> None:
    ok = got == want
    print(f"  {'PASS' if ok else 'FAIL'}  {label}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        failures.append(label)


def show(label: str, value) -> None:
    print(f"        {label}: {value}")


def main() -> int:
    stamp = int(time.time())
    start = date.today() + timedelta(days=60)

    with httpx.Client() as owner, httpx.Client() as anon, httpx.Client() as copier:
        owner.post(
            f"{BASE}/auth/login", json={"email": OWNER[0], "password": OWNER[1]}
        ).raise_for_status()

        print("\n[set up a furnished trip]")
        trip = owner.post(
            f"{BASE}/trips",
            json={
                "name": f"Share Probe {stamp}",
                "description": "Two cities, one hotel, one flight.",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(days=5)).isoformat(),
                "travelers": 2,
            },
        ).json()["data"]
        trip_id = trip["id"]
        check("starts private", trip["is_public"], False)
        check("no slug yet", trip["share_slug"], None)

        cities = owner.get(f"{BASE}/cities", params={"limit": 2}).json()["data"]
        stop = owner.post(
            f"{BASE}/trips/{trip_id}/stops",
            json={
                "city_id": cities[0]["id"],
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(days=2)).isoformat(),
            },
        ).json()["data"]["stop"]
        act = owner.get(
            f"{BASE}/activities", params={"city_id": cities[0]["id"], "limit": 1}
        ).json()["data"][0]
        owner.post(
            f"{BASE}/trips/{trip_id}/stops/{stop['id']}/activities",
            json={"activity_id": act["id"], "scheduled_date": start.isoformat()},
        )
        owner.post(
            f"{BASE}/trips/{trip_id}/budget-items",
            json={
                "category": "ACCOMMODATION",
                "label": "Hotel",
                "amount": "300.00",
                "incurred_on": start.isoformat(),
                "trip_stop_id": stop["id"],
            },
        )
        owner.post(
            f"{BASE}/trips/{trip_id}/budget-items",
            json={"category": "TRANSPORT", "label": "Flights", "amount": "500.00"},
        )
        mine = owner.get(f"{BASE}/trips/{trip_id}").json()["data"]
        show("trip total", f"{mine['estimated_total']} {mine['currency']}")

        print("\n[share]")
        slug = owner.post(f"{BASE}/trips/{trip_id}/share").json()["data"]["share_slug"]
        show("slug", slug)
        check("slug length is paste-able", 8 <= len(slug) <= 16, True)
        again = owner.post(f"{BASE}/trips/{trip_id}/share").json()["data"]["share_slug"]
        check("idempotent - link does not rotate", again, slug)

        print("\n[a stranger reads it]")
        r = anon.get(f"{BASE}/public/trips/{slug}")
        check("no auth needed", r.status_code, 200)
        public = r.json()["data"]
        check("same trip", public["name"], trip["name"])
        check("itinerary included", len(public["stops"]), 1)
        check("owner display name only", public["owner_name"], "Demo Traveller")
        check("copies start at zero", public["copy_count"], 0)
        check("totals match the owner's view", public["estimated_total"], mine["estimated_total"])

        budget = anon.get(f"{BASE}/public/trips/{slug}/budget").json()["data"]
        owner_budget = owner.get(f"{BASE}/trips/{trip_id}/budget").json()["data"]
        check("public budget == owner budget", budget["grand_total"], owner_budget["grand_total"])

        print("\n[no PII leaks]")
        raw = anon.get(f"{BASE}/public/trips/{slug}").text
        for secret in ("demo@globetrotter.app", "9000000000", "Bengaluru", "window seats"):
            check(f"'{secret}' absent", secret in raw, False)
        check("no user_id", "user_id" in raw, False)

        print("\n[copy]")
        blocked = anon.post(f"{BASE}/public/trips/{slug}/copy", json={})
        check("copying signed out -> 401", blocked.status_code, 401)

        email = f"copier{stamp}@example.com"
        copier.post(
            f"{BASE}/auth/register",
            json={
                "first_name": "Cara",
                "last_name": "Copier",
                "email": email,
                "password": "copier12345",
            },
        ).raise_for_status()

        rebased = date.today() + timedelta(days=200)
        made = copier.post(
            f"{BASE}/public/trips/{slug}/copy", json={"start_date": rebased.isoformat()}
        )
        check("copy -> 201", made.status_code, 201)
        copy = made.json()["data"]
        check("copy is private", copy["is_public"], False)
        check("copy has no slug", copy["share_slug"], None)
        check("provenance recorded", copy["copied_from_trip_id"], trip_id)
        check("dates rebased", copy["start_date"], rebased.isoformat())
        offset = rebased - start
        check(
            "relative shape preserved",
            copy["stops"][0]["start_date"],
            (start + offset).isoformat(),
        )
        check(
            "activity snapshot travels",
            copy["stops"][0]["activities"][0]["cost"],
            mine["stops"][0]["activities"][0]["cost"],
        )
        # The bug this run exists to catch: budget items used to be dropped.
        check("budget items came too", copy["estimated_total"], mine["estimated_total"])
        copy_items = copier.get(f"{BASE}/trips/{copy['id']}/budget-items").json()["data"]
        check("both manual costs", sorted(i["label"] for i in copy_items), ["Flights", "Hotel"])
        dated = next(i for i in copy_items if i["label"] == "Hotel")
        undated = next(i for i in copy_items if i["label"] == "Flights")
        check("dated item shifted", dated["incurred_on"], (start + offset).isoformat())
        check("undated item stays undated", undated["incurred_on"], None)

        reread = anon.get(f"{BASE}/public/trips/{slug}").json()["data"]
        check("copy count is now 1", reread["copy_count"], 1)
        check(
            "original untouched",
            owner.get(f"{BASE}/trips/{trip_id}").json()["data"]["start_date"],
            start.isoformat(),
        )

        print("\n[un-share kills the link]")
        off = owner.delete(f"{BASE}/trips/{trip_id}/share").json()["data"]
        check("flag cleared", off["is_public"], False)
        check("slug cleared", off["share_slug"], None)
        check("old link -> 404 not 403", anon.get(f"{BASE}/public/trips/{slug}").status_code, 404)
        nonsense = anon.get(f"{BASE}/public/trips/notarealslug")
        check("nonsense slug -> 404", nonsense.status_code, 404)

        fresh = owner.post(f"{BASE}/trips/{trip_id}/share").json()["data"]["share_slug"]
        check("re-sharing mints a new slug", fresh != slug, True)
        check("the dead link stays dead", anon.get(f"{BASE}/public/trips/{slug}").status_code, 404)
        check("the new one works", anon.get(f"{BASE}/public/trips/{fresh}").status_code, 200)

        print("\n[cleanup]")
        owner.delete(f"{BASE}/trips/{trip_id}")
        copier.delete(f"{BASE}/trips/{copy['id']}")
        copier.delete(f"{BASE}/users/me")
        check("probe trip gone", owner.get(f"{BASE}/trips/{trip_id}").status_code, 404)

    print("\n" + ("FAILURES: " + ", ".join(failures) if failures else "all checks passed"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

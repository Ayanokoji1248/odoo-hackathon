"""End-to-end check of the admin API against a running server.

Not a pytest test - the suite already covers this against an isolated database.
This one drives the *live* dev server the frontend talks to, which is what catches
"works in tests, 404s in the browser" (a router that was never mounted, a seed
that never ran, a cookie flag that only bites over real HTTP).

    ./.venv/Scripts/python.exe scripts/check_admin.py
"""

import sys
import time

import httpx

BASE = "http://localhost:8000/api/v1"
ADMIN = ("admin@globetrotter.app", "admin12345")
USER = ("demo@globetrotter.app", "demo12345")

failures: list[str] = []


def check(label: str, got, want) -> None:
    ok = got == want
    print(f"  {'PASS' if ok else 'FAIL'}  {label}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        failures.append(label)


def show(label: str, value) -> None:
    print(f"        {label}: {value}")


def login(client: httpx.Client, creds: tuple[str, str]) -> dict:
    r = client.post(f"{BASE}/auth/login", json={"email": creds[0], "password": creds[1]})
    r.raise_for_status()
    return r.json()["data"]


def main() -> int:
    stamp = int(time.time())
    name = f"Probeville{stamp}"

    print("\n[the boundary]")
    with httpx.Client() as anon:
        check("signed out -> 401", anon.get(f"{BASE}/admin/stats").status_code, 401)

    with httpx.Client() as user:
        login(user, USER)
        check("plain user GET -> 403", user.get(f"{BASE}/admin/stats").status_code, 403)
        check(
            "plain user POST -> 403",
            user.post(
                f"{BASE}/admin/cities", json={"name": "X", "country": "Y", "cost_index": 5}
            ).status_code,
            403,
        )

    with httpx.Client() as c:
        me = login(c, ADMIN)
        print("\n[admin session]")
        check("role", me["role"], "ADMIN")

        print("\n[stats]")
        s = c.get(f"{BASE}/admin/stats").json()["data"]
        show("users", f"{s['users_total']} ({s['users_active']} active, {s['admins_total']} admin)")
        show("trips", f"{s['trips_total']} · {s['avg_stops_per_trip']} stops avg")
        show("avg budget", f"{s['avg_trip_budget']} {s['currency']}")
        show("catalog", f"{s['cities_total']} cities / {s['activities_total']} activities")
        check("six month buckets", len(s["new_users_by_month"]), 6)
        check(
            "months ascending",
            [p["month"] for p in s["new_users_by_month"]]
            == sorted(p["month"] for p in s["new_users_by_month"]),
            True,
        )

        print("\n[self-lockout guards]")
        demote = c.patch(f"{BASE}/admin/users/{me['id']}", json={"role": "USER"})
        check("cannot demote self", demote.status_code, 400)
        show("message", demote.json()["error"]["message"])
        off = c.patch(f"{BASE}/admin/users/{me['id']}", json={"is_active": False})
        check("cannot deactivate self", off.status_code, 400)
        check("still admin afterwards", c.get(f"{BASE}/admin/stats").status_code, 200)

        print("\n[users]")
        body = c.get(f"{BASE}/admin/users", params={"limit": 3, "sort": "trips"}).json()
        show("total", body["meta"]["total"])
        show("top by trips", [(u["email"], u["trip_count"]) for u in body["data"]])
        hits = c.get(f"{BASE}/admin/users", params={"search": "globetrotter.app"}).json()["data"]
        check("search finds the seeded pair", len(hits) >= 2, True)
        wildcard = c.get(f"{BASE}/admin/users", params={"search": "%"}).json()["data"]
        check("a typed % is a literal, not an operator", wildcard, [])

        print("\n[city CRUD]")
        created = c.post(
            f"{BASE}/admin/cities",
            json={
                "name": name,
                "country": "Testland",
                "region": "Europe",
                "cost_index": 85,
                "popularity_score": 62,
                "tags": ["Nature", "Northern lights"],
                "avg_daily_cost": "140.00",
                "best_season": "Jun-Aug",
            },
        )
        check("create -> 201", created.status_code, 201)
        city = created.json()["data"]
        city_id = city["id"]
        check("starts visible", city["is_active"], True)
        check("tags stored", city["tags"], ["Nature", "Northern lights"])

        public = c.get(f"{BASE}/cities", params={"search": name}).json()["data"]
        check("appears in the public catalog", [p["name"] for p in public], [name])

        dupe = c.post(
            f"{BASE}/admin/cities",
            json={"name": name, "country": "Testland", "cost_index": 85},
        )
        check("duplicate -> 409 not 500", dupe.status_code, 409)
        show("message", dupe.json()["error"]["message"])

        bad = c.post(
            f"{BASE}/admin/cities", json={"name": "Bad", "country": "Nowhere", "cost_index": 500}
        )
        check("cost_index 500 -> 400", bad.status_code, 400)

        print("\n[activity CRUD]")
        made = c.post(
            f"{BASE}/admin/activities",
            json={
                "city_id": city_id,
                "name": "Probe Walking Tour",
                "category": "SIGHTSEEING",
                "estimated_cost": "25.50",
                "duration_minutes": 90,
            },
        )
        check("create -> 201", made.status_code, 201)
        activity = made.json()["data"]
        check("city_name resolved", activity["city_name"], name)

        listed = c.get(f"{BASE}/activities", params={"city_id": city_id}).json()["data"]
        check("public list shows it", [(a["name"], a["estimated_cost"]) for a in listed],
              [("Probe Walking Tour", "25.50")])

        fixed = c.patch(
            f"{BASE}/admin/activities/{activity['id']}", json={"estimated_cost": "31.00"}
        )
        check("price fix", fixed.json()["data"]["estimated_cost"], "31.00")

        orphan = c.post(
            f"{BASE}/admin/activities",
            json={
                "city_id": "00000000-0000-0000-0000-000000000000",
                "name": "Ghost tour",
                "category": "CULTURE",
                "estimated_cost": "10.00",
            },
        )
        check("unknown city -> 404", orphan.status_code, 404)

        print("\n[soft delete]")
        c.patch(f"{BASE}/admin/activities/{activity['id']}", json={"is_active": False})
        check(
            "hidden activity leaves the public list",
            c.get(f"{BASE}/activities", params={"city_id": city_id}).json()["data"],
            [],
        )
        admin_view = c.get(
            f"{BASE}/admin/activities", params={"city_id": city_id}
        ).json()["data"]
        check(
            "admin still sees it",
            [(a["name"], a["is_active"]) for a in admin_view],
            [("Probe Walking Tour", False)],
        )

        c.patch(f"{BASE}/admin/cities/{city_id}", json={"is_active": False})
        check("hidden city -> public 404", c.get(f"{BASE}/cities/{city_id}").status_code, 404)
        row = c.get(f"{BASE}/admin/cities", params={"search": name}).json()["data"][0]
        check("admin list still has it", row["is_active"], False)
        check("with its activity count", row["activity_count"], 1)

        c.patch(f"{BASE}/admin/cities/{city_id}", json={"is_active": True})
        check("un-hidden -> public 200", c.get(f"{BASE}/cities/{city_id}").status_code, 200)

        # Leave the catalog as it was found: the probe city stays hidden so it does
        # not pollute the demo, and it cannot be deleted (ON DELETE RESTRICT).
        c.patch(f"{BASE}/admin/cities/{city_id}", json={"is_active": False})
        print(f"\n  probe city {name} left hidden (rows are never deleted)")

    print("\n" + ("FAILURES: " + ", ".join(failures) if failures else "all checks passed"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

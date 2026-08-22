import uuid

CITIES = "/api/v1/cities"
ACTIVITIES = "/api/v1/activities"


def names(response):
    return [row["name"] for row in response.json()["data"]]


# --- cities -------------------------------------------------------------------


async def test_list_cities_hides_soft_deleted_rows(client, catalog):
    r = await client.get(CITIES)
    assert r.status_code == 200, r.text
    assert set(names(r)) == {"Paris", "Prague", "Bangkok"}
    assert r.json()["meta"] == {"page": 1, "limit": 20, "total": 3}
    assert "Retired City" not in names(r)


async def test_cities_default_to_popularity_order(client, catalog):
    assert names(await client.get(CITIES)) == ["Paris", "Bangkok", "Prague"]


async def test_city_sort_options(client, catalog):
    assert names(await client.get(CITIES, params={"sort": "name"})) == [
        "Bangkok",
        "Paris",
        "Prague",
    ]
    assert names(await client.get(CITIES, params={"sort": "cost_index"})) == [
        "Bangkok",
        "Prague",
        "Paris",
    ]


async def test_unknown_sort_is_rejected(client, catalog):
    r = await client.get(CITIES, params={"sort": "sideways"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_city_search_is_case_insensitive_and_partial(client, catalog):
    assert names(await client.get(CITIES, params={"search": "PRA"})) == ["Prague"]
    assert names(await client.get(CITIES, params={"search": "ngko"})) == ["Bangkok"]


async def test_search_wildcards_are_taken_literally(client, catalog):
    # `%` unescaped would match every row; `_` would match any single character.
    assert names(await client.get(CITIES, params={"search": "%"})) == []
    assert names(await client.get(CITIES, params={"search": "P_ris"})) == []


async def test_city_filters(client, catalog):
    assert names(await client.get(CITIES, params={"country": "france"})) == ["Paris"]
    assert names(await client.get(CITIES, params={"region": "Asia"})) == ["Bangkok"]
    assert set(names(await client.get(CITIES, params={"max_cost_index": 50}))) == {
        "Prague",
        "Bangkok",
    }


async def test_city_pagination_reports_the_full_total(client, catalog):
    r = await client.get(CITIES, params={"limit": 1, "page": 2})
    assert names(r) == ["Bangkok"], "page 2 of the popularity order"
    assert r.json()["meta"] == {"page": 1 + 1, "limit": 1, "total": 3}


async def test_limit_above_the_cap_is_rejected(client, catalog):
    r = await client.get(CITIES, params={"limit": 101})
    assert r.status_code == 400
    assert r.json()["error"]["details"][0]["field"] == "limit"


async def test_city_detail_carries_the_extra_fields(client, catalog):
    r = await client.get(f"{CITIES}/{catalog['cities']['paris']}")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["name"] == "Paris"
    assert data["latitude"] == "48.856600", "Decimal must stay a string, never a float"
    assert data["description"]


async def test_soft_deleted_city_is_a_404(client, catalog):
    r = await client.get(f"{CITIES}/{catalog['cities']['retired']}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


async def test_unknown_city_is_404_and_a_bad_uuid_is_400(client, catalog):
    assert (await client.get(f"{CITIES}/{uuid.uuid4()}")).status_code == 404
    bad = await client.get(f"{CITIES}/not-a-uuid")
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_popular_cities_is_routed_before_the_uuid_path(client, catalog):
    r = await client.get(f"{CITIES}/popular", params={"limit": 2})
    assert r.status_code == 200, "'popular' must not be parsed as a city_id"
    assert names(r) == ["Paris", "Bangkok"]


# --- activities ---------------------------------------------------------------


async def test_list_activities_hides_soft_deleted_rows(client, catalog):
    r = await client.get(ACTIVITIES)
    assert r.json()["meta"]["total"] == 5
    assert "Retired Tour" not in names(r)


async def test_activities_default_to_cheapest_first(client, catalog):
    assert names(await client.get(ACTIVITIES))[0] == "Street Food Crawl"


async def test_activity_filters(client, catalog):
    by_city = await client.get(ACTIVITIES, params={"city_id": str(catalog["cities"]["bangkok"])})
    assert set(names(by_city)) == {"Street Food Crawl", "Temple Bike Tour"}

    assert names(await client.get(ACTIVITIES, params={"category": "FOOD"})) == [
        "Street Food Crawl"
    ]
    assert set(names(await client.get(ACTIVITIES, params={"min_cost": 20}))) == {
        "Louvre Museum Pass",
        "Temple Bike Tour",
    }
    assert names(await client.get(ACTIVITIES, params={"max_cost": 12})) == ["Street Food Crawl"]
    assert set(names(await client.get(ACTIVITIES, params={"max_duration": 120}))) == {
        "Seine River Cruise",
        "Prague Castle Tour",
    }
    assert names(await client.get(ACTIVITIES, params={"search": "cruise"})) == [
        "Seine River Cruise"
    ]


async def test_unknown_category_is_rejected(client, catalog):
    r = await client.get(ACTIVITIES, params={"category": "NAPPING"})
    assert r.status_code == 400


async def test_activity_cost_is_a_decimal_string(client, catalog):
    r = await client.get(f"{ACTIVITIES}/{catalog['activities']['seine']}")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["estimated_cost"] == "18.50", "money must never serialize as a float"
    assert data["currency"] == "USD"
    assert data["description"] is None


async def test_soft_deleted_activity_is_a_404(client, catalog):
    r = await client.get(f"{ACTIVITIES}/{catalog['activities']['retired']}")
    assert r.status_code == 404


# --- saved destinations -------------------------------------------------------


async def test_saved_destinations_require_auth(client, catalog):
    assert (await client.get("/api/v1/users/me/saved-destinations")).status_code == 401


async def test_save_list_and_remove_a_destination(client, auth, catalog):
    url = "/api/v1/users/me/saved-destinations"
    city_id = str(catalog["cities"]["prague"])

    assert (await client.get(url)).json()["data"] == []

    added = await client.post(url, json={"city_id": city_id})
    assert added.status_code == 201, added.text
    assert added.json()["data"]["name"] == "Prague"

    assert names(await client.get(url)) == ["Prague"]

    again = await client.post(url, json={"city_id": city_id})
    assert again.status_code == 409

    removed = await client.delete(f"{url}/{city_id}")
    assert removed.status_code == 200
    assert (await client.get(url)).json()["data"] == []

    assert (await client.delete(f"{url}/{city_id}")).status_code == 404


async def test_saving_an_unknown_or_retired_city_is_a_404(client, auth, catalog):
    url = "/api/v1/users/me/saved-destinations"
    unknown = await client.post(url, json={"city_id": str(uuid.uuid4())})
    assert unknown.status_code == 404

    retired = await client.post(
        url, json={"city_id": str(catalog["cities"]["retired"])}
    )
    assert retired.status_code == 404


async def test_deleting_a_user_drops_their_saved_destinations(client, auth, catalog):
    from sqlalchemy import func, select

    from app.db.session import SessionLocal
    from app.models.catalog import SavedDestination

    url = "/api/v1/users/me/saved-destinations"
    await client.post(
        url, json={"city_id": str(catalog["cities"]["paris"])}
    )
    await client.delete("/api/v1/users/me")

    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(SavedDestination)) == 0

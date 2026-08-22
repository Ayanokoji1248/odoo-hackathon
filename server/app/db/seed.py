"""Seed the catalog: cities, activities and a demo account.

Idempotent — re-run it after editing the data below and rows are updated in
place, not duplicated. Upserts key on the natural keys (`name, country` for
cities, `city_id, name` for activities).

    ./.venv/Scripts/python.exe -m app.db.seed
"""

import asyncio
import uuid
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionLocal, engine
from app.models.catalog import Activity, ActivityCategory, City
from app.models.trip import Trip, TripActivity, TripStop
from app.models.user import User

# One currency for the whole catalog. There is no FX in v1, so seeding local
# currencies would let the budget service sum VND and CHF as if they were the
# same unit. The column stays for when conversion arrives.
CATALOG_CURRENCY = "USD"

DEMO_EMAIL = "demo@globetrotter.app"
DEMO_PASSWORD = "demo12345"

# name, country, region, lat, lon, cost_index, popularity, description
CITIES: list[tuple[str, str, str, float, float, int, int, str]] = [
    ("Paris", "France", "Europe", 48.8566, 2.3522, 78, 98, "Boulevards, museums and the world's most photographed tower."),
    ("London", "United Kingdom", "Europe", 51.5072, -0.1276, 85, 97, "Free museums, green parks and endless neighbourhoods."),
    ("Rome", "Italy", "Europe", 41.9028, 12.4964, 68, 94, "Two thousand years of ruins between espresso stops."),
    ("Barcelona", "Spain", "Europe", 41.3874, 2.1686, 63, 93, "Gaudí, tapas and a city beach in walking distance."),
    ("Amsterdam", "Netherlands", "Europe", 52.3676, 4.9041, 76, 89, "Canals, cycling and world-class galleries."),
    ("Berlin", "Germany", "Europe", 52.5200, 13.4050, 62, 86, "History on every corner and nightlife until sunrise."),
    ("Prague", "Czechia", "Europe", 50.0755, 14.4378, 48, 84, "Gothic spires, cheap beer and a walkable old town."),
    ("Vienna", "Austria", "Europe", 48.2082, 16.3738, 66, 80, "Coffee houses, palaces and imperial museums."),
    ("Lisbon", "Portugal", "Europe", 38.7223, -9.1393, 52, 88, "Tiled hills, trams and Atlantic seafood."),
    ("Budapest", "Hungary", "Europe", 47.4979, 19.0402, 42, 79, "Thermal baths either side of the Danube."),
    ("Athens", "Greece", "Europe", 37.9838, 23.7275, 50, 82, "Ancient marble above a busy modern city."),
    ("Istanbul", "Türkiye", "Europe", 41.0082, 28.9784, 38, 87, "Two continents, one skyline of domes and minarets."),
    ("Copenhagen", "Denmark", "Europe", 55.6761, 12.5683, 88, 74, "Design, harbour baths and New Nordic cooking."),
    ("Stockholm", "Sweden", "Europe", 59.3293, 18.0686, 82, 71, "Fourteen islands of waterfront and museums."),
    ("Reykjavik", "Iceland", "Europe", 64.1466, -21.9426, 92, 68, "Base camp for geysers, glaciers and northern lights."),
    ("Dublin", "Ireland", "Europe", 53.3498, -6.2603, 79, 70, "Literary pubs and a coastline on the doorstep."),
    ("Edinburgh", "United Kingdom", "Europe", 55.9533, -3.1883, 72, 69, "A castle on a crag above a medieval old town."),
    ("Zurich", "Switzerland", "Europe", 47.3769, 8.5417, 97, 61, "Lakeside strolls and Alpine day trips."),
    ("Venice", "Italy", "Europe", 45.4408, 12.3155, 74, 85, "A city of canals best seen on foot at dawn."),
    ("Santorini", "Greece", "Europe", 36.3932, 25.4615, 71, 83, "Whitewashed cliffs over a flooded caldera."),
    ("New York", "United States", "North America", 40.7128, -74.0060, 95, 99, "Five boroughs, every cuisine, no closing time."),
    ("San Francisco", "United States", "North America", 37.7749, -122.4194, 93, 84, "Fog, hills and the bay in every direction."),
    ("Los Angeles", "United States", "North America", 34.0522, -118.2437, 84, 86, "Beaches, canyons and studio backlots."),
    ("Chicago", "United States", "North America", 41.8781, -87.6298, 77, 74, "Architecture cruises and a lakefront skyline."),
    ("Toronto", "Canada", "North America", 43.6532, -79.3832, 75, 73, "One of the most multicultural food scenes anywhere."),
    ("Vancouver", "Canada", "North America", 49.2827, -123.1207, 80, 72, "Mountains, ocean and rainforest inside the city limits."),
    ("Mexico City", "Mexico", "North America", 19.4326, -99.1332, 35, 81, "Pyramids, murals and the best street food in the hemisphere."),
    ("Havana", "Cuba", "North America", 23.1136, -82.3666, 33, 58, "Colonial facades, live son and vintage cars."),
    ("Rio de Janeiro", "Brazil", "South America", -22.9068, -43.1729, 40, 80, "Beaches wedged between granite peaks."),
    ("Buenos Aires", "Argentina", "South America", -34.6037, -58.3816, 34, 75, "Steak, tango and grand European boulevards."),
    ("Lima", "Peru", "South America", -12.0464, -77.0428, 31, 66, "Clifftop districts and a world-ranked restaurant scene."),
    ("Cusco", "Peru", "South America", -13.5319, -71.9675, 29, 72, "Inca walls at 3,400 m and the gateway to Machu Picchu."),
    ("Cartagena", "Colombia", "South America", 10.3910, -75.4794, 32, 62, "A walled Caribbean old town in full colour."),
    ("Tokyo", "Japan", "Asia", 35.6762, 139.6503, 81, 96, "Neon districts, quiet shrines and flawless trains."),
    ("Kyoto", "Japan", "Asia", 35.0116, 135.7681, 70, 90, "Sixteen hundred temples and bamboo backstreets."),
    ("Seoul", "South Korea", "Asia", 37.5665, 126.9780, 68, 85, "Palaces, markets and 24-hour everything."),
    ("Singapore", "Singapore", "Asia", 1.3521, 103.8198, 86, 88, "Hawker centres and gardens in a vertical city."),
    ("Bangkok", "Thailand", "Asia", 13.7563, 100.5018, 30, 92, "Canal temples, night markets and street woks."),
    ("Chiang Mai", "Thailand", "Asia", 18.7883, 98.9853, 24, 74, "Mountain temples and a slow northern pace."),
    ("Bali", "Indonesia", "Asia", -8.4095, 115.1889, 26, 91, "Rice terraces, reef breaks and temple cliffs."),
    ("Hanoi", "Vietnam", "Asia", 21.0278, 105.8342, 23, 78, "Old quarter alleys, lakes and pavement pho."),
    ("Ho Chi Minh City", "Vietnam", "Asia", 10.8231, 106.6297, 25, 71, "Fast, loud and endlessly edible."),
    ("Kathmandu", "Nepal", "Asia", 27.7172, 85.3240, 22, 63, "Temple squares and the trailhead to the Himalaya."),
    ("Jaipur", "India", "Asia", 26.9124, 75.7873, 20, 70, "Pink sandstone palaces and stepwells."),
    ("Udaipur", "India", "Asia", 24.5854, 73.7125, 21, 64, "Lake palaces below the Aravalli hills."),
    ("Dubai", "United Arab Emirates", "Middle East", 25.2048, 55.2708, 83, 89, "Desert dunes an hour from the world's tallest tower."),
    ("Marrakesh", "Morocco", "Africa", 31.6295, -7.9811, 34, 79, "Souks, riads and the Atlas mountains beyond."),
    ("Cape Town", "South Africa", "Africa", -33.9249, 18.4241, 44, 82, "A flat-topped mountain between two oceans."),
    ("Cairo", "Egypt", "Africa", 30.0444, 31.2357, 28, 80, "Pyramids on the edge of a 20-million-person city."),
    ("Nairobi", "Kenya", "Africa", -1.2921, 36.8219, 33, 60, "The only capital with a national park inside it."),
    ("Sydney", "Australia", "Oceania", -33.8688, 151.2093, 82, 87, "Harbour ferries, surf beaches and coastal walks."),
    ("Melbourne", "Australia", "Oceania", -37.8136, 144.9631, 78, 76, "Laneway coffee, street art and live music."),
    ("Queenstown", "New Zealand", "Oceania", -45.0312, 168.6626, 76, 67, "Adventure sports wrapped around a glacial lake."),
    ("Auckland", "New Zealand", "Oceania", -36.8485, 174.7633, 74, 62, "Volcanic cones, two harbours and island ferries."),
]

# Display metadata, keyed by city name. Kept separate from the CITIES table above
# so geographic facts and UI content stay independently editable.
#   name -> (tags, best_season, unsplash photo id or None)
CITY_EXTRAS: dict[str, tuple[list[str], str, str | None]] = {
    "Paris": (["Romance", "Art", "Food", "Culture"], "Apr - Jun", "1502602898657-3e91760cbb34"),
    "London": (["History", "Museums", "Nightlife", "Shopping"], "May - Sep", "1513635269975-59663e0ac1ad"),
    "Rome": (["History", "Food", "Culture", "Architecture"], "Apr - Jun", "1552832230-c0197dd311b5"),
    "Barcelona": (["Beach", "Architecture", "Food", "Nightlife"], "May - Jun", "1583422409516-2895a77efded"),
    "Amsterdam": (["Canals", "Museums", "Cycling", "Nightlife"], "Apr - May", None),
    "Berlin": (["History", "Nightlife", "Art", "Budget"], "May - Sep", None),
    "Prague": (["History", "Architecture", "Budget", "Beer"], "May - Sep", None),
    "Vienna": (["Music", "Palaces", "Coffee", "Museums"], "Apr - May", None),
    "Lisbon": (["Coastal", "Food", "Trams", "Budget"], "Mar - May", "1585208798174-6cedd86e019a"),
    "Budapest": (["Thermal Baths", "Budget", "Nightlife", "History"], "Apr - Jun", None),
    "Athens": (["Ancient", "History", "Food", "Islands"], "Apr - Jun", None),
    "Istanbul": (["Bazaars", "History", "Food", "Budget"], "Apr - May", None),
    "Copenhagen": (["Design", "Food", "Cycling", "Harbour"], "Jun - Aug", None),
    "Stockholm": (["Islands", "Design", "Museums", "Nature"], "Jun - Aug", None),
    "Reykjavik": (["Northern Lights", "Geysers", "Nature", "Adventure"], "Jun - Aug", None),
    "Dublin": (["Pubs", "Literature", "Coastal", "Music"], "May - Sep", None),
    "Edinburgh": (["Castles", "Festivals", "History", "Hiking"], "Jun - Aug", None),
    "Zurich": (["Alps", "Lakes", "Luxury", "Nature"], "Jun - Sep", None),
    "Venice": (["Canals", "Art", "Romance", "History"], "Apr - Jun", None),
    "Santorini": (["Sunsets", "Beach", "Romance", "Wine"], "May - Jun", None),
    "New York": (["Skyline", "Museums", "Food", "Shopping"], "Apr - Jun", "1496442226666-8d4d0e62e6e9"),
    "San Francisco": (["Bay", "Tech", "Food", "Hiking"], "Sep - Nov", None),
    "Los Angeles": (["Beach", "Film", "Food", "Road Trip"], "Mar - May", None),
    "Chicago": (["Architecture", "Lakefront", "Jazz", "Food"], "Jun - Sep", None),
    "Toronto": (["Multicultural", "Food", "Lakeside", "Museums"], "May - Sep", None),
    "Vancouver": (["Mountains", "Ocean", "Nature", "Skiing"], "Jun - Sep", None),
    "Mexico City": (["Street Food", "Murals", "Pyramids", "Budget"], "Mar - May", None),
    "Havana": (["Vintage Cars", "Music", "Colonial", "Beach"], "Nov - Apr", None),
    "Rio de Janeiro": (["Beach", "Carnival", "Hiking", "Nightlife"], "Dec - Mar", None),
    "Buenos Aires": (["Tango", "Steak", "Nightlife", "Budget"], "Oct - Nov", None),
    "Lima": (["Food", "Coastal", "Museums", "Budget"], "Dec - Apr", None),
    "Cusco": (["Inca", "Trekking", "Altitude", "History"], "May - Sep", None),
    "Cartagena": (["Caribbean", "Colonial", "Beach", "Nightlife"], "Dec - Apr", None),
    "Tokyo": (["Food", "Technology", "Culture", "Shopping"], "Mar - May", "1540959733332-eab4deabeeaf"),
    "Kyoto": (["Temples", "Gardens", "Tradition", "Blossom"], "Mar - May", None),
    "Seoul": (["Palaces", "Street Food", "Shopping", "Nightlife"], "Apr - Jun", None),
    "Singapore": (["Hawker Food", "Gardens", "Shopping", "Family"], "Feb - Apr", None),
    "Bangkok": (["Street Food", "Temples", "Markets", "Budget"], "Nov - Feb", "1508009603885-50cf7c579365"),
    "Chiang Mai": (["Temples", "Mountains", "Slow Travel", "Budget"], "Nov - Feb", None),
    "Bali": (["Beach", "Surf", "Rice Terraces", "Yoga"], "Apr - Oct", "1537996194471-e657df975ab4"),
    "Hanoi": (["Street Food", "Old Quarter", "Budget", "Lakes"], "Oct - Dec", None),
    "Ho Chi Minh City": (["Street Food", "Markets", "History", "Budget"], "Dec - Mar", None),
    "Kathmandu": (["Temples", "Himalaya", "Trekking", "Budget"], "Oct - Nov", None),
    "Jaipur": (["Palaces", "Forts", "Markets", "Budget"], "Oct - Mar", None),
    "Udaipur": (["Lakes", "Palaces", "Romance", "Heritage"], "Sep - Mar", None),
    "Dubai": (["Desert", "Luxury", "Shopping", "Skyline"], "Nov - Mar", "1512453979798-5ea266f8880c"),
    "Marrakesh": (["Souks", "Riads", "Desert", "Atlas"], "Mar - May", None),
    "Cape Town": (["Mountain", "Wine", "Beach", "Hiking"], "Nov - Mar", "1580060839134-75a5edca2e99"),
    "Cairo": (["Pyramids", "Nile", "History", "Budget"], "Oct - Apr", None),
    "Nairobi": (["Safari", "Wildlife", "Nature", "Coffee"], "Jun - Oct", None),
    "Sydney": (["Harbour", "Beach", "Coastal Walks", "Food"], "Sep - Nov", "1506973035872-a4ec16b8e8d9"),
    "Melbourne": (["Coffee", "Street Art", "Live Music", "Sport"], "Mar - May", None),
    "Queenstown": (["Adventure", "Lake", "Skiing", "Bungee"], "Dec - Feb", None),
    "Auckland": (["Harbour", "Volcanoes", "Islands", "Sailing"], "Nov - Apr", None),
}

# Neutral scenery for cities without a specific photo. Deliberately generic rather
# than another city's skyline - a wrong landmark reads worse than a generic one.
REGION_IMAGES: dict[str, str] = {
    "Europe": "1520986606214-8b456906c813",
    "Asia": "1523531294919-4bcd7c65e216",
    "North America": "1543349689-9a4d426bee8e",
    "South America": "1531592937781-344ad608fabf",
    "Africa": "1534430480872-3498386e7856",
    "Middle East": "1583779457094-ab6f9164a1c8",
    "Oceania": "1492666673288-3c4b4576ad9a",
}

# A rotating pool per category, so 324 activities do not all share one photo.
ACTIVITY_IMAGES: dict[ActivityCategory, list[str]] = {
    ActivityCategory.SIGHTSEEING: ["1492666673288-3c4b4576ad9a", "1520986606214-8b456906c813", "1543349689-9a4d426bee8e", "1583779457094-ab6f9164a1c8"],
    ActivityCategory.FOOD: ["1431274172761-fca41d930114", "1504674900247-0877df9cc836", "1515443961218-a51367888e4b", "1516100882582-96c3a05fe590", "1579584425555-c3ce17fd4351"],
    ActivityCategory.CULTURE: ["1499856871958-5b9627545d1a", "1518548419970-58e3b4079ab2", "1524413840807-0c3cb6fa808d", "1531572753322-ad063cecc140", "1574322454798-e64602f1a4a1"],
    ActivityCategory.ADVENTURE: ["1502680390469-be75c86b636f", "1531592937781-344ad608fabf", "1534430480872-3498386e7856"],
    ActivityCategory.NIGHTLIFE: ["1503095396549-807759245b35", "1503899036084-c55cdd92da26"],
    ActivityCategory.SHOPPING: ["1516100882582-96c3a05fe590", "1579584425555-c3ce17fd4351"],
    ActivityCategory.RELAXATION: ["1523531294919-4bcd7c65e216", "1534430480872-3498386e7856"],
    ActivityCategory.TRANSPORT: ["1502680390469-be75c86b636f", "1492666673288-3c4b4576ad9a"],
}

# Same shape as the client's img() helper, so URLs cache-match across both.
UNSPLASH = "https://images.unsplash.com/photo-{}?auto=format&fit=crop&w=800&q=80"

# A per-person daily estimate. cost_index runs 1-100, so this puts Zurich (97)
# near $175/day and Jaipur (20) near $36 - the right order of magnitude. Stored
# rather than derived on read so an admin can override a row that looks wrong.
DAILY_COST_PER_INDEX_POINT = Decimal("1.8")


def photo(photo_id: str | None, region: str | None) -> str | None:
    chosen = photo_id or REGION_IMAGES.get(region or "")
    return UNSPLASH.format(chosen) if chosen else None


def daily_cost(cost_index: int) -> Decimal:
    return (cost_index * DAILY_COST_PER_INDEX_POINT).quantize(Decimal("0.01"))


# category, name template, base cost in a mid-priced city, duration in minutes
ACTIVITY_TEMPLATES: list[tuple[ActivityCategory, str, int, int | None]] = [
    (ActivityCategory.SIGHTSEEING, "{city} Old Town Walking Tour", 25, 120),
    (ActivityCategory.SIGHTSEEING, "{city} Landmarks Half-Day Tour", 48, 240),
    (ActivityCategory.FOOD, "{city} Street Food Crawl", 42, 180),
    (ActivityCategory.FOOD, "Cooking Class in {city}", 68, 180),
    (ActivityCategory.CULTURE, "{city} History Museum", 18, 90),
    (ActivityCategory.CULTURE, "{city} Art Gallery Pass", 24, 120),
    (ActivityCategory.ADVENTURE, "{city} Bike Tour", 36, 180),
    (ActivityCategory.ADVENTURE, "Day Hike near {city}", 55, 420),
    (ActivityCategory.NIGHTLIFE, "{city} Rooftop Bar Night", 32, 150),
    (ActivityCategory.NIGHTLIFE, "Live Music Night in {city}", 28, 180),
    (ActivityCategory.SHOPPING, "{city} Local Market Visit", 12, 90),
    (ActivityCategory.SHOPPING, "{city} Design District Shopping", 15, 150),
    (ActivityCategory.RELAXATION, "{city} Spa Afternoon", 72, 120),
    (ActivityCategory.RELAXATION, "Park Picnic in {city}", 10, 90),
    (ActivityCategory.TRANSPORT, "{city} Airport Transfer", 38, 45),
    (ActivityCategory.TRANSPORT, "{city} 3-Day Transit Pass", 22, None),
]

ACTIVITIES_PER_CITY = 6
# cost_index of a notional mid-priced city, so template base costs land as written there
BASELINE_COST_INDEX = 55


def scaled_cost(base: int, cost_index: int) -> Decimal:
    """Price the same activity higher in Zurich than in Hanoi."""
    return (Decimal(base) * cost_index / BASELINE_COST_INDEX).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


async def seed_cities(db: AsyncSession) -> dict[tuple[str, str], uuid.UUID]:
    rows = []
    for name, country, region, lat, lon, cost_index, popularity, description in CITIES:
        tags, best_season, photo_id = CITY_EXTRAS[name]
        rows.append(
            {
                "name": name,
                "country": country,
                "region": region,
                "latitude": Decimal(str(lat)),
                "longitude": Decimal(str(lon)),
                "cost_index": cost_index,
                "popularity_score": popularity,
                "description": description,
                "tags": tags,
                "best_season": best_season,
                "avg_daily_cost": daily_cost(cost_index),
                "image_url": photo(photo_id, region),
                "is_active": True,
            }
        )
    stmt = insert(City).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[City.name, City.country],
        set_={
            c: stmt.excluded[c]
            for c in (
                "region",
                "latitude",
                "longitude",
                "cost_index",
                "popularity_score",
                "description",
                "tags",
                "best_season",
                "avg_daily_cost",
                "image_url",
                "is_active",
            )
        },
    ).returning(City.id, City.name, City.country)
    result = await db.execute(stmt)
    return {(name, country): city_id for city_id, name, country in result.all()}


async def seed_activities(db: AsyncSession, city_ids: dict[tuple[str, str], uuid.UUID]) -> int:
    rows = []
    for i, city in enumerate(CITIES):
        name, country, _region, _lat, _lon, cost_index, _pop, _desc = city
        city_id = city_ids[(name, country)]
        # Rotate the template window per city so the catalog isn't 54 identical lists.
        offset = (i * ACTIVITIES_PER_CITY) % len(ACTIVITY_TEMPLATES)
        for k in range(ACTIVITIES_PER_CITY):
            category, template, base, duration = ACTIVITY_TEMPLATES[
                (offset + k) % len(ACTIVITY_TEMPLATES)
            ]
            pool = ACTIVITY_IMAGES[category]
            rows.append(
                {
                    "city_id": city_id,
                    "name": template.format(city=name),
                    "category": category,
                    "estimated_cost": scaled_cost(base, cost_index),
                    "currency": CATALOG_CURRENCY,
                    "duration_minutes": duration,
                    "image_url": UNSPLASH.format(pool[(i + k) % len(pool)]),
                    "is_active": True,
                }
            )

    stmt = insert(Activity).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Activity.city_id, Activity.name],
        set_={
            c: stmt.excluded[c]
            for c in (
                "category",
                "estimated_cost",
                "currency",
                "duration_minutes",
                "image_url",
                "is_active",
            )
        },
    )
    await db.execute(stmt)
    return len(rows)


DEMO_PROFILE = {
    "first_name": "Demo",
    "last_name": "Traveller",
    "phone": "+919000000000",
    "city": "Bengaluru",
    "country": "India",
    "additional_info": "Demo account. Vegetarian, prefers window seats.",
}


async def seed_demo_user(db: AsyncSession) -> User:
    user = (
        await db.execute(select(User).where(User.email == DEMO_EMAIL))
    ).scalar_one_or_none()
    if user is None:
        user = User(
            email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD), **DEMO_PROFILE
        )
        db.add(user)
    else:
        # Backfill only what is missing, so re-running the seed after a schema
        # change fills in new columns without stamping over local edits.
        for field, value in DEMO_PROFILE.items():
            if getattr(user, field, None) in (None, ""):
                setattr(user, field, value)
    await db.flush()
    return user


# Two fully populated trips on the demo account (PRD section 8). One upcoming and
# one finished, so the dashboard has something in every status bucket.
#   name -> (days from today, nights per stop, [city names in order])
DEMO_TRIPS: list[tuple[str, int, int, list[str]]] = [
    (
        "European Highlights",
        30,
        3,
        ["Paris", "Rome", "Barcelona"],
    ),
    (
        "Southeast Asia Loop",
        -60,
        4,
        ["Bangkok", "Chiang Mai", "Bali"],
    ),
]

ACTIVITIES_PER_DEMO_STOP = 3


async def seed_demo_trips(
    db: AsyncSession, user: User, city_ids: dict[tuple[str, str], uuid.UUID]
) -> int:
    """Idempotent on (user, trip name): re-running never duplicates a trip."""
    by_name = {name: city_id for (name, _country), city_id in city_ids.items()}
    created = 0

    for trip_name, start_offset, nights, city_names in DEMO_TRIPS:
        exists = await db.scalar(
            select(Trip.id).where(Trip.user_id == user.id, Trip.name == trip_name)
        )
        if exists:
            continue

        start = date.today() + timedelta(days=start_offset)
        total_nights = nights * len(city_names)
        trip = Trip(
            user_id=user.id,
            name=trip_name,
            description=f"{len(city_names)} cities over {total_nights} days.",
            start_date=start,
            end_date=start + timedelta(days=total_nights - 1),
            travelers=2,
            currency=CATALOG_CURRENCY,
        )
        db.add(trip)
        await db.flush()

        for order_index, city_name in enumerate(city_names):
            stop_start = start + timedelta(days=order_index * nights)
            stop = TripStop(
                trip_id=trip.id,
                city_id=by_name[city_name],
                start_date=stop_start,
                end_date=stop_start + timedelta(days=nights - 1),
                order_index=order_index,
            )
            db.add(stop)
            await db.flush()

            # Snapshot a few of that city's catalog activities, cheapest first,
            # spread one per day so the itinerary reads like a real plan.
            picks = (
                await db.execute(
                    select(Activity)
                    .where(Activity.city_id == stop.city_id, Activity.is_active.is_(True))
                    .order_by(Activity.estimated_cost)
                    .limit(ACTIVITIES_PER_DEMO_STOP)
                )
            ).scalars().all()

            for day, activity in enumerate(picks):
                db.add(
                    TripActivity(
                        trip_stop_id=stop.id,
                        activity_id=activity.id,
                        name=activity.name,
                        category=activity.category,
                        scheduled_date=stop_start + timedelta(days=min(day, nights - 1)),
                        duration_minutes=activity.duration_minutes,
                        cost=activity.estimated_cost,
                        order_index=0,
                    )
                )
        created += 1

    return created


async def main() -> None:
    async with SessionLocal() as db:
        city_ids = await seed_cities(db)
        activity_count = await seed_activities(db, city_ids)
        user = await seed_demo_user(db)
        trip_count = await seed_demo_trips(db, user, city_ids)
        await db.commit()

    print(f"cities:     {len(city_ids)}")
    print(f"activities: {activity_count}")
    print(f"demo trips: {trip_count} new")
    print(f"demo user:  {user.email} / {DEMO_PASSWORD}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

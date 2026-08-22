"""Showcase data: the dataset the app is demonstrated with.

`seed.py` gets the catalog into a usable state. This gets it into a *presentable*
one - because several screens are honest but empty on a fresh database, and an
empty screen demonstrates nothing:

  /saved              nothing saved
  /shared             no public trips, so no share link to show
  /trips/<id>/budget  activities only, so the category donut has one slice
  /admin              every user and trip created today, so both trend charts are
                      a flat line with one spike at the right edge
  public trip page    copy_count 0

So: eight travellers spread over six months, fourteen trips across every status,
manual costs on the good ones, one trip shared on a fixed slug with real copies
of it, and saved destinations.

Idempotent on natural keys (user email, trip name per user), so running it twice
changes nothing and running it after a schema change fills in what is missing.

    ./.venv/Scripts/python.exe -m app.db.demo
"""

import asyncio
import random
import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionLocal, engine
from app.models.budget import BudgetCategory, BudgetItem
from app.models.catalog import Activity, City, SavedDestination
from app.models.trip import Trip, TripActivity, TripStop
from app.models.user import User, UserRole
from app.schemas.trip import TripDuplicate
from app.services import trip_service

CURRENCY = "USD"

# Deterministic, so re-running produces the same demo rather than a new one each
# time. Nothing here is security-sensitive.
RNG_SEED = 20260822

TODAY = date.today()
NOW = datetime.now(UTC)

# --- people -------------------------------------------------------------------

DEMO_EMAIL = "demo@globetrotter.app"
DEMO_PASSWORD = "demo12345"

# (email, first, last, city, country, months_ago, role, is_active)
# `months_ago` backdates created_at so the admin sign-up chart has a curve
# instead of one bar. One deactivated account so the admin user table has a
# non-default row to look at, and a second admin so promote/demote can be
# demonstrated without touching the account you are signed in as.
PEOPLE: list[tuple[str, str, str, str, str, int, UserRole, bool]] = [
    ("maya.reyes@example.com", "Maya", "Reyes", "Lisbon", "Portugal", 5, UserRole.USER, True),
    ("tom.okafor@example.com", "Tom", "Okafor", "Berlin", "Germany", 5, UserRole.USER, True),
    ("ines.duval@example.com", "Inès", "Duval", "Lyon", "France", 4, UserRole.ADMIN, True),
    ("arjun.iyer@example.com", "Arjun", "Iyer", "Bengaluru", "India", 3, UserRole.USER, True),
    ("sofia.bianchi@example.com", "Sofia", "Bianchi", "Milan", "Italy", 2, UserRole.USER, True),
    ("noah.lindqvist@example.com", "Noah", "Lindqvist", "Malmö", "Sweden", 2, UserRole.USER, True),
    ("hana.sato@example.com", "Hana", "Satō", "Osaka", "Japan", 1, UserRole.USER, True),
    ("spammer@example.com", "Blocked", "Account", None, None, 1, UserRole.USER, False),
]

DEMO_PEOPLE_PASSWORD = "traveller12345"

# --- trips --------------------------------------------------------------------

# A manual cost. `day` is an offset from the trip start, or None for undated
# (which is the honest shape for flights booked months earlier). `stop` is the
# index of the stop it belongs to, or None for trip-wide.
Cost = tuple[BudgetCategory, str, str, int | None, int | None]


class TripSpec:
    def __init__(
        self,
        name: str,
        description: str,
        start_offset: int,
        nights: list[int],
        cities: list[str],
        travelers: int = 2,
        costs: list[Cost] | None = None,
        share_slug: str | None = None,
        created_months_ago: int = 0,
        cover: str | None = None,
    ) -> None:
        self.name = name
        self.description = description
        self.start_offset = start_offset
        # Per-stop night counts, so stops are not all the same length.
        self.nights = nights
        self.cities = cities
        self.travelers = travelers
        self.costs = costs or []
        self.share_slug = share_slug
        self.created_months_ago = created_months_ago
        self.cover = cover


UNSPLASH = "https://images.unsplash.com/photo-{}?auto=format&fit=crop&w=1200&q=80"

# The account a mentor signs in as. Five trips: one in every status bucket the
# dashboard counts, the shared one, and a solo trip so `travelers` is not always 2.
DEMO_TRIPS = [
    TripSpec(
        name="Euro Rail Sprint",
        description=(
            "Four capitals in twelve days, all by train. Booked the rail pass early "
            "and kept two evenings deliberately empty."
        ),
        start_offset=24,
        nights=[3, 3, 3, 3],
        cities=["Paris", "Amsterdam", "Berlin", "Prague"],
        travelers=2,
        # The richest budget in the set: every category, a dated hotel per stop,
        # and undated flights so the "not on the daily chart" footnote has a value.
        costs=[
            (BudgetCategory.TRANSPORT, "Return flights (London)", "412.00", None, None),
            (BudgetCategory.TRANSPORT, "Interrail global pass x2", "678.00", 0, None),
            (BudgetCategory.ACCOMMODATION, "Hôtel du Marais", "486.00", 0, 0),
            (BudgetCategory.ACCOMMODATION, "Canal House, Amsterdam", "534.00", 3, 1),
            (BudgetCategory.ACCOMMODATION, "Kreuzberg apartment", "398.00", 6, 2),
            (BudgetCategory.ACCOMMODATION, "Old Town guesthouse", "312.00", 9, 3),
            (BudgetCategory.MEALS, "Food budget", "560.00", None, None),
            (BudgetCategory.MISC, "Museum pass x2", "148.00", 1, 0),
        ],
        share_slug="euro-rail-2026",
        created_months_ago=1,
        cover=UNSPLASH.format("1502602898657-3e91760cbb34"),
    ),
    TripSpec(
        name="Iceland Ring Road",
        description="Nine days clockwise from Reykjavik. Chasing waterfalls and daylight.",
        start_offset=-3,  # in progress right now
        nights=[9],
        cities=["Reykjavik"],
        travelers=2,
        costs=[
            (BudgetCategory.TRANSPORT, "4x4 camper hire", "1240.00", 0, 0),
            (BudgetCategory.TRANSPORT, "Flights", "706.00", None, None),
            (BudgetCategory.MEALS, "Groceries and fuel", "430.00", None, None),
            (BudgetCategory.MISC, "Blue Lagoon entry x2", "196.00", 8, 0),
        ],
        created_months_ago=2,
        cover=UNSPLASH.format("1504829857797-ddff29c27927"),
    ),
    TripSpec(
        name="Kyoto in Cherry Blossom",
        description="Timed to the forecast and it actually worked. Would do it again.",
        start_offset=-128,
        nights=[4, 3, 3],
        cities=["Tokyo", "Kyoto", "Seoul"],
        travelers=2,
        costs=[
            (BudgetCategory.TRANSPORT, "Flights", "1584.00", None, None),
            (BudgetCategory.TRANSPORT, "Shinkansen, Tokyo to Kyoto", "196.00", 4, 1),
            (BudgetCategory.ACCOMMODATION, "Shinjuku hotel", "620.00", 0, 0),
            (BudgetCategory.ACCOMMODATION, "Gion ryokan", "740.00", 4, 1),
            (BudgetCategory.ACCOMMODATION, "Hongdae studio", "410.00", 7, 2),
            (BudgetCategory.MEALS, "Food and coffee", "680.00", None, None),
        ],
        created_months_ago=5,
        cover=UNSPLASH.format("1493976040374-85c8e12f0c0e"),
    ),
    TripSpec(
        name="Amalfi Long Weekend",
        description="Four days, one suitcase, far too much lemon everything.",
        start_offset=-46,
        nights=[2, 2],
        cities=["Rome", "Venice"],
        travelers=2,
        costs=[
            (BudgetCategory.TRANSPORT, "Flights", "268.00", None, None),
            (BudgetCategory.ACCOMMODATION, "Trastevere room", "246.00", 0, 0),
            (BudgetCategory.ACCOMMODATION, "Cannaregio B&B", "288.00", 2, 1),
        ],
        created_months_ago=3,
        cover=UNSPLASH.format("1523906834658-6e24ef2386f9"),
    ),
    TripSpec(
        name="Tokyo Solo Week",
        description="Going alone this time. No fixed plan past the first two days.",
        start_offset=96,
        nights=[7],
        cities=["Tokyo"],
        travelers=1,
        costs=[
            (BudgetCategory.TRANSPORT, "Flights", "742.00", None, None),
            (BudgetCategory.ACCOMMODATION, "Capsule hotel, 7 nights", "329.00", 0, 0),
        ],
        created_months_ago=0,
        cover=UNSPLASH.format("1540959733332-eab4deabeeaf"),
    ),
]

# Other people's trips. These exist so the admin dashboard is about a platform
# rather than about one account: the trend charts get six months of history and
# "most planned cities" has something to rank.
OTHERS_TRIPS: dict[str, list[TripSpec]] = {
    "maya.reyes@example.com": [
        TripSpec(
            "Portugal Coast Run", "Lisbon down to the Algarve by train.",
            -150, [4, 3], ["Lisbon", "Barcelona"], 2, created_months_ago=5,
        ),
        TripSpec(
            "Marrakesh Medina", "Five days of markets and rooftops.",
            -84, [5], ["Marrakesh"], 2, created_months_ago=3,
        ),
    ],
    "tom.okafor@example.com": [
        TripSpec(
            "Cape Town Summer", "Table Mountain at sunrise, wine country after.",
            -118, [6], ["Cape Town"], 2, created_months_ago=5,
        ),
        TripSpec(
            "Berlin to Budapest", "Slow train across central Europe.",
            42, [3, 3, 3], ["Berlin", "Vienna", "Budapest"], 2, created_months_ago=1,
        ),
    ],
    "ines.duval@example.com": [
        TripSpec(
            "Paris Weekends", "A standing plan for when friends visit.",
            -62, [2], ["Paris"], 4, created_months_ago=4,
        ),
    ],
    "arjun.iyer@example.com": [
        TripSpec(
            "Rajasthan Loop", "Jaipur, Udaipur, and a lot of trains.",
            -70, [3, 4], ["Jaipur", "Udaipur"], 3, created_months_ago=3,
        ),
        TripSpec(
            "Singapore Stopover", "Three days between flights.",
            60, [3], ["Singapore"], 1, created_months_ago=0,
        ),
    ],
    "sofia.bianchi@example.com": [
        TripSpec(
            "Greek Islands", "Athens first, then as many ferries as possible.",
            -34, [3, 4], ["Athens", "Santorini"], 2, created_months_ago=2,
        ),
    ],
    "noah.lindqvist@example.com": [
        TripSpec(
            "Nordic Cities", "Copenhagen, Stockholm, and the sleeper between them.",
            -28, [3, 3], ["Copenhagen", "Stockholm"], 2, created_months_ago=2,
        ),
    ],
    "hana.sato@example.com": [
        TripSpec(
            "New York First Time", "Every cliché, on purpose.",
            18, [5], ["New York"], 2, created_months_ago=1,
        ),
        TripSpec(
            "Vietnam North to South", "Hanoi down to Ho Chi Minh City over two weeks.",
            110, [5, 4, 5], ["Hanoi", "Ho Chi Minh City", "Bangkok"], 2, created_months_ago=0,
        ),
    ],
}

# Cities the demo account has bookmarked, so /saved is not an empty state.
SAVED_CITIES = ["Kyoto", "Reykjavik", "Queenstown", "Cusco", "Lisbon", "Cape Town", "Santorini"]

# Who copies the shared trip. Drives the public page's copy count, and gives
# `copied_from_trip_id` real rows to be counted.
COPIERS = ["sofia.bianchi@example.com", "noah.lindqvist@example.com", "hana.sato@example.com"]

# Activities are spread across a stop's days and given plausible start times, so
# the itinerary and calendar read like a plan rather than a dump.
START_TIMES = [time(9, 30), time(12, 0), time(14, 30), time(17, 0), time(19, 30)]
MAX_PER_DAY = 2


def months_back(months: int) -> datetime:
    """Roughly `months` before now - exact day-of-month does not matter here, and
    30-day steps keep every value inside its intended calendar month."""
    return NOW - timedelta(days=months * 30 + 3)


async def upsert_people(db: AsyncSession) -> dict[str, User]:
    people: dict[str, User] = {}
    for email, first, last, city, country, ago, role, active in PEOPLE:
        user = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if user is None:
            user = User(
                email=email,
                password_hash=hash_password(DEMO_PEOPLE_PASSWORD),
                first_name=first,
                last_name=last,
                city=city,
                country=country,
                role=role,
                is_active=active,
                created_at=months_back(ago),
            )
            db.add(user)
        else:
            # Re-assert the demo shape without stamping over anything else.
            user.role = role
            user.is_active = active
            user.created_at = months_back(ago)
        people[email] = user
    await db.flush()
    return people


async def build_trip(
    db: AsyncSession,
    user: User,
    spec: TripSpec,
    cities: dict[str, uuid.UUID],
    rng: random.Random,
) -> Trip | None:
    """Returns the new trip, or None if this user already has one by that name."""
    existing = await db.scalar(
        select(Trip.id).where(Trip.user_id == user.id, Trip.name == spec.name)
    )
    if existing:
        return None

    missing = [name for name in spec.cities if name not in cities]
    if missing:
        print(f"  ! skipping {spec.name}: no catalog city named {', '.join(missing)}")
        return None

    start = TODAY + timedelta(days=spec.start_offset)
    total = sum(spec.nights)
    trip = Trip(
        user_id=user.id,
        name=spec.name,
        description=spec.description,
        start_date=start,
        end_date=start + timedelta(days=total - 1),
        travelers=spec.travelers,
        currency=CURRENCY,
        cover_photo_url=spec.cover,
        is_public=spec.share_slug is not None,
        share_slug=spec.share_slug,
        created_at=months_back(spec.created_months_ago),
    )
    db.add(trip)
    await db.flush()

    stops: list[TripStop] = []
    cursor = start
    for order_index, city_name in enumerate(spec.cities):
        nights = spec.nights[order_index]
        stop = TripStop(
            trip_id=trip.id,
            city_id=cities[city_name],
            start_date=cursor,
            end_date=cursor + timedelta(days=nights - 1),
            order_index=order_index,
        )
        db.add(stop)
        await db.flush()
        stops.append(stop)

        # A varied handful per city rather than the three cheapest, so the
        # category donut is not all one colour.
        picks = (
            await db.execute(
                select(Activity)
                .where(Activity.city_id == stop.city_id, Activity.is_active.is_(True))
                .order_by(Activity.category, Activity.estimated_cost)
                .limit(nights * MAX_PER_DAY)
            )
        ).scalars().all()
        picks = list(picks)
        rng.shuffle(picks)

        for index, activity in enumerate(picks):
            day = index // MAX_PER_DAY
            if day >= nights:
                break
            slot = index % MAX_PER_DAY
            db.add(
                TripActivity(
                    trip_stop_id=stop.id,
                    activity_id=activity.id,
                    name=activity.name,
                    category=activity.category,
                    scheduled_date=stop.start_date + timedelta(days=day),
                    start_time=START_TIMES[slot % len(START_TIMES)],
                    duration_minutes=activity.duration_minutes,
                    cost=activity.estimated_cost,
                    order_index=slot,
                )
            )
        cursor = stop.end_date + timedelta(days=1)

    for category, label, amount, day, stop_index in spec.costs:
        db.add(
            BudgetItem(
                trip_id=trip.id,
                trip_stop_id=stops[stop_index].id if stop_index is not None else None,
                category=category,
                label=label,
                amount=Decimal(amount),
                incurred_on=start + timedelta(days=day) if day is not None else None,
            )
        )

    return trip


async def seed_saved(db: AsyncSession, user: User, cities: dict[str, uuid.UUID]) -> int:
    added = 0
    for name in SAVED_CITIES:
        city_id = cities.get(name)
        if city_id is None:
            continue
        exists = await db.scalar(
            select(SavedDestination.city_id).where(
                SavedDestination.user_id == user.id, SavedDestination.city_id == city_id
            )
        )
        if exists:
            continue
        db.add(SavedDestination(user_id=user.id, city_id=city_id))
        added += 1
    return added


async def backfill_costs(db: AsyncSession, user: User) -> int:
    """Give every one of this user's trips at least flights and a bed.

    `seed.py` creates two trips of its own with no manual costs at all, so beside
    the trips built here they read as broken rather than as cheap - one showed a
    $188 total for three weeks in Asia. Proportional to the trip length so the
    numbers stay plausible whatever the dates are.
    """
    trips = (
        await db.execute(select(Trip).where(Trip.user_id == user.id))
    ).scalars().all()

    filled = 0
    for trip in trips:
        has_costs = await db.scalar(
            select(BudgetItem.id).where(BudgetItem.trip_id == trip.id).limit(1)
        )
        if has_costs:
            continue

        nights = max(1, (trip.end_date - trip.start_date).days)
        first_stop = (
            await db.execute(
                select(TripStop)
                .where(TripStop.trip_id == trip.id)
                .order_by(TripStop.order_index)
                .limit(1)
            )
        ).scalar_one_or_none()

        db.add(
            BudgetItem(
                trip_id=trip.id,
                category=BudgetCategory.TRANSPORT,
                label="Flights",
                amount=Decimal(320 + 45 * nights) * trip.travelers,
            )
        )
        db.add(
            BudgetItem(
                trip_id=trip.id,
                trip_stop_id=first_stop.id if first_stop else None,
                category=BudgetCategory.ACCOMMODATION,
                label=f"Accommodation, {nights} nights",
                amount=Decimal(78 * nights),
                incurred_on=trip.start_date,
            )
        )
        db.add(
            BudgetItem(
                trip_id=trip.id,
                category=BudgetCategory.MEALS,
                label="Food budget",
                amount=Decimal(38 * nights) * trip.travelers,
            )
        )
        filled += 1

    return filled


async def seed_copies(db: AsyncSession, source: Trip, people: dict[str, User]) -> int:
    """Real copies through the real service, so `copied_from_trip_id` is set and
    the public page's copy count is derived rather than invented."""
    copies = 0
    for email in COPIERS:
        user = people.get(email)
        if user is None:
            continue
        name = f"{source.name} (copy)"
        exists = await db.scalar(
            select(Trip.id).where(Trip.user_id == user.id, Trip.name == name)
        )
        if exists:
            continue
        await trip_service.duplicate_trip(
            db, user, source, TripDuplicate(start_date=TODAY + timedelta(days=70))
        )
        copies += 1
    return copies


async def main() -> None:
    rng = random.Random(RNG_SEED)

    async with SessionLocal() as db:
        cities = {
            name: city_id
            for name, city_id in (
                await db.execute(select(City.name, City.id))
            ).all()
        }
        if not cities:
            print("No cities found. Run `python -m app.db.seed` first.")
            return

        demo = (
            await db.execute(select(User).where(User.email == DEMO_EMAIL))
        ).scalar_one_or_none()
        if demo is None:
            print(f"No {DEMO_EMAIL}. Run `python -m app.db.seed` first.")
            return

        people = await upsert_people(db)

        shared: Trip | None = None
        made = 0
        for spec in DEMO_TRIPS:
            trip = await build_trip(db, demo, spec, cities, rng)
            if trip is not None:
                made += 1
            if spec.share_slug:
                # Whether it was just built or already there, we need it to copy from.
                shared = trip or (
                    await db.execute(
                        select(Trip).where(
                            Trip.user_id == demo.id, Trip.name == spec.name
                        )
                    )
                ).scalar_one_or_none()

        for email, specs in OTHERS_TRIPS.items():
            user = people.get(email)
            if user is None:
                continue
            for spec in specs:
                if await build_trip(db, user, spec, cities, rng) is not None:
                    made += 1

        saved = await seed_saved(db, demo, cities)
        # After the specs above, so trips seeded by seed.py get costs too.
        filled = await backfill_costs(db, demo)
        await db.commit()

        copies = await seed_copies(db, shared, people) if shared else 0

        users_total = await db.scalar(select(func.count()).select_from(User))
        trips_total = await db.scalar(select(func.count()).select_from(Trip))
        items_total = await db.scalar(select(func.count()).select_from(BudgetItem))
        activities_total = await db.scalar(select(func.count()).select_from(TripActivity))

    print(f"\ntravellers:      {len(PEOPLE)} demo accounts ({users_total} users total)")
    print(f"trips built:     {made} new ({trips_total} total)")
    print(f"copies made:     {copies}")
    print(f"saved cities:    {saved} new")
    print(f"costs added:     {filled} trips backfilled")
    print(f"planned items:   {activities_total} activities, {items_total} manual costs")
    if shared and shared.share_slug:
        print(f"\npublic trip:     /shared/{shared.share_slug}")
    print(f"sign in as:      {DEMO_EMAIL} / {DEMO_PASSWORD}")
    print(f"other people:    any address in PEOPLE / {DEMO_PEOPLE_PASSWORD}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

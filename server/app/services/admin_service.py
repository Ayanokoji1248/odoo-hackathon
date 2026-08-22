"""Platform-wide reads and catalog writes. Everything here is admin-only; the
router applies `require_admin` once so no function has to re-check."""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import ApiError
from app.core.pagination import PaginationParams
from app.models.budget import BudgetItem
from app.models.catalog import Activity, City
from app.models.trip import Trip, TripActivity, TripStop
from app.models.user import User, UserRole
from app.schemas.admin import (
    ActivityPatch,
    ActivityWrite,
    AdminStats,
    CityPatch,
    CityWrite,
    ManagedUserUpdate,
    MonthPoint,
    TopActivity,
    TopCity,
    UserSort,
)

# The catalog is single-currency (no FX in v1), so every money figure here is in
# this unit. Stated in the response rather than assumed by the client.
CATALOG_CURRENCY = "USD"
TREND_MONTHS = 6


def _money(value) -> Decimal:
    return Decimal(value or 0).quantize(Decimal("0.01"))


async def _count(db: AsyncSession, stmt: Select) -> int:
    return await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def _month_floor(value: date) -> date:
    return value.replace(day=1)


async def _by_month(db: AsyncSession, column, table) -> list[MonthPoint]:
    """New rows per calendar month, oldest first, with empty months filled in.

    `generate_series` would give gap-free months in SQL, but it needs a date
    range per call and this is two tiny queries on a dashboard - grouping in SQL
    and filling the gaps in Python is the smaller thing to read.
    """
    today = datetime.now(UTC).date()
    # Walk back TREND_MONTHS - 1 whole months from the current one. Stepping a
    # day before the 1st always lands in the previous month, whatever its length.
    start = _month_floor(today)
    for _ in range(TREND_MONTHS - 1):
        start = _month_floor(start - timedelta(days=1))

    bucket = func.date_trunc("month", column)
    rows = (
        await db.execute(
            select(bucket.label("month"), func.count())
            .select_from(table)
            .where(column >= start)
            .group_by(bucket)
        )
    ).all()
    counts = {row[0].date(): row[1] for row in rows}

    months: list[MonthPoint] = []
    cursor = start
    while cursor <= _month_floor(today):
        months.append(MonthPoint(month=cursor, count=counts.get(cursor, 0)))
        # First of next month.
        cursor = _month_floor(cursor + timedelta(days=32))
    return months


async def get_stats(db: AsyncSession) -> AdminStats:
    users_total = await _count(db, select(User.id))
    users_active = await _count(db, select(User.id).where(User.is_active))
    admins_total = await _count(db, select(User.id).where(User.role == UserRole.ADMIN))
    trips_total = await _count(db, select(Trip.id))
    cities_total = await _count(db, select(City.id))
    cities_hidden = await _count(db, select(City.id).where(City.is_active.is_(False)))
    activities_total = await _count(db, select(Activity.id))
    activities_hidden = await _count(db, select(Activity.id).where(Activity.is_active.is_(False)))

    stops_total = await _count(db, select(TripStop.id))

    # Same arithmetic as budget_service: activity costs are per person and scale
    # with travelers, manual items are taken as entered. Summed per trip first,
    # then averaged, so a trip with no rows still counts as 0 in the mean.
    activity_spend = (
        select(
            TripStop.trip_id.label("trip_id"),
            func.coalesce(func.sum(TripActivity.cost), 0).label("total"),
        )
        .join(TripActivity, TripActivity.trip_stop_id == TripStop.id)
        .group_by(TripStop.trip_id)
        .subquery()
    )
    manual_spend = (
        select(
            BudgetItem.trip_id.label("trip_id"),
            func.coalesce(func.sum(BudgetItem.amount), 0).label("total"),
        )
        .group_by(BudgetItem.trip_id)
        .subquery()
    )
    per_trip = (
        select(
            (
                func.coalesce(activity_spend.c.total, 0) * Trip.travelers
                + func.coalesce(manual_spend.c.total, 0)
            ).label("total")
        )
        .select_from(Trip)
        .outerjoin(activity_spend, activity_spend.c.trip_id == Trip.id)
        .outerjoin(manual_spend, manual_spend.c.trip_id == Trip.id)
        .subquery()
    )
    avg_budget = await db.scalar(select(func.avg(per_trip.c.total)))

    return AdminStats(
        users_total=users_total,
        users_active=users_active,
        admins_total=admins_total,
        trips_total=trips_total,
        cities_total=cities_total,
        cities_hidden=cities_hidden,
        activities_total=activities_total,
        activities_hidden=activities_hidden,
        avg_stops_per_trip=(
            _money(Decimal(stops_total) / trips_total) if trips_total else Decimal("0.00")
        ),
        avg_trip_budget=_money(avg_budget),
        currency=CATALOG_CURRENCY,
        new_users_by_month=await _by_month(db, User.created_at, User),
        new_trips_by_month=await _by_month(db, Trip.created_at, Trip),
    )


async def top_cities(db: AsyncSession, limit: int) -> list[TopCity]:
    """Ranked by how often a city was actually added to a trip. `popularity_score`
    is an editorial number an admin types in; this one is behaviour."""
    rows = (
        await db.execute(
            select(City.id, City.name, City.country, func.count(TripStop.id).label("n"))
            .join(TripStop, TripStop.city_id == City.id)
            .group_by(City.id, City.name, City.country)
            .order_by(func.count(TripStop.id).desc(), City.name)
            .limit(limit)
        )
    ).all()
    return [
        TopCity(city_id=row[0], name=row[1], country=row[2], trip_count=row[3]) for row in rows
    ]


async def top_activities(db: AsyncSession, limit: int) -> list[TopActivity]:
    """Counts `trip_activities` rows that still point at a catalog row. Custom
    activities (no `activity_id`) and retired catalog rows are not in this list -
    it exists to answer "what should we stock more of"."""
    rows = (
        await db.execute(
            select(
                Activity.id,
                Activity.name,
                City.name,
                func.count(TripActivity.id).label("n"),
            )
            .join(TripActivity, TripActivity.activity_id == Activity.id)
            .join(City, City.id == Activity.city_id)
            .group_by(Activity.id, Activity.name, City.name)
            .order_by(func.count(TripActivity.id).desc(), Activity.name)
            .limit(limit)
        )
    ).all()
    return [
        TopActivity(activity_id=row[0], name=row[1], city_name=row[2], add_count=row[3])
        for row in rows
    ]


# --- users --------------------------------------------------------------------


USER_SORTS = {
    "created_at": User.created_at.desc(),
    "name": User.first_name.asc(),
}


async def list_users(
    db: AsyncSession,
    pagination: PaginationParams,
    *,
    search: str | None = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
    sort: UserSort = "created_at",
) -> tuple[list[dict], int]:
    trip_counts = (
        select(Trip.user_id.label("user_id"), func.count(Trip.id).label("n"))
        .group_by(Trip.user_id)
        .subquery()
    )
    stmt = select(User, func.coalesce(trip_counts.c.n, 0).label("trip_count")).outerjoin(
        trip_counts, trip_counts.c.user_id == User.id
    )

    if search:
        # Same escaping as catalog_service: a user typing % must not become an
        # operator.
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{escaped}%"
        stmt = stmt.where(
            func.concat(User.first_name, " ", User.last_name).ilike(like, escape="\\")
            | User.email.ilike(like, escape="\\")
        )
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))

    total = await _count(db, stmt.with_only_columns(User.id))

    order = (
        func.coalesce(trip_counts.c.n, 0).desc()
        if sort == "trips"
        else USER_SORTS[sort]
    )
    page = stmt.order_by(order, User.created_at.desc()).offset(pagination.offset).limit(
        pagination.limit
    )
    rows = (await db.execute(page)).all()
    return [{"user": row[0], "trip_count": row[1]} for row in rows], total


async def update_user(
    db: AsyncSession, actor: User, user_id: uuid.UUID, data: ManagedUserUpdate
) -> tuple[User, int]:
    target = await db.get(User, user_id)
    if target is None:
        raise ApiError("NOT_FOUND", "User not found")

    changes = data.model_dump(exclude_unset=True)

    # An admin locking themselves out is the one mistake here that cannot be
    # undone from the UI - it would take a psql session to fix.
    if target.id == actor.id:
        if changes.get("role") not in (None, UserRole.ADMIN):
            raise ApiError("VALIDATION_ERROR", "You cannot remove your own admin role")
        if changes.get("is_active") is False:
            raise ApiError("VALIDATION_ERROR", "You cannot deactivate your own account")

    for field, value in changes.items():
        setattr(target, field, value)
    await db.commit()
    await db.refresh(target)

    count = await db.scalar(
        select(func.count()).select_from(Trip).where(Trip.user_id == target.id)
    )
    return target, count or 0


# --- catalog ------------------------------------------------------------------


async def _unique_or_409(db: AsyncSession, what: str) -> None:
    await db.rollback()
    raise ApiError("CONFLICT", what)


async def list_all_cities(
    db: AsyncSession, pagination: PaginationParams, *, search: str | None = None
) -> tuple[list[dict], int]:
    """Includes hidden rows. The public `GET /cities` filters them out, so this is
    the only way to find something in order to un-hide it."""
    counts = (
        select(Activity.city_id.label("city_id"), func.count(Activity.id).label("n"))
        .group_by(Activity.city_id)
        .subquery()
    )
    stmt = select(City, func.coalesce(counts.c.n, 0)).outerjoin(
        counts, counts.c.city_id == City.id
    )
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{escaped}%"
        stmt = stmt.where(
            City.name.ilike(like, escape="\\") | City.country.ilike(like, escape="\\")
        )

    total = await _count(db, stmt.with_only_columns(City.id))
    page = (
        stmt.order_by(City.is_active.desc(), City.popularity_score.desc(), City.name)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    rows = (await db.execute(page)).all()
    return [{"city": row[0], "activity_count": row[1]} for row in rows], total


async def create_city(db: AsyncSession, data: CityWrite) -> City:
    city = City(**data.model_dump())
    db.add(city)
    try:
        await db.commit()
    except IntegrityError:
        # UNIQUE (name, country).
        await _unique_or_409(db, f"{data.name}, {data.country} is already in the catalog")
    await db.refresh(city)
    return city


async def update_city(db: AsyncSession, city_id: uuid.UUID, data: CityPatch) -> City:
    city = await db.get(City, city_id)
    if city is None:
        raise ApiError("NOT_FOUND", "City not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(city, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await _unique_or_409(db, "Another city already has that name and country")
    await db.refresh(city)
    return city


async def list_all_activities(
    db: AsyncSession,
    pagination: PaginationParams,
    *,
    search: str | None = None,
    city_id: uuid.UUID | None = None,
) -> tuple[Sequence[Activity], int]:
    stmt = select(Activity).options(joinedload(Activity.city))
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Activity.name.ilike(f"%{escaped}%", escape="\\"))
    if city_id is not None:
        stmt = stmt.where(Activity.city_id == city_id)

    total = await _count(db, stmt.with_only_columns(Activity.id))
    page = (
        stmt.order_by(Activity.is_active.desc(), Activity.name)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return (await db.execute(page)).unique().scalars().all(), total


async def _reload_activity(db: AsyncSession, activity_id: uuid.UUID) -> Activity:
    # Activity.city is lazy="raise", so a serialized row must arrive eager-loaded.
    stmt = select(Activity).where(Activity.id == activity_id).options(joinedload(Activity.city))
    return (await db.execute(stmt)).unique().scalar_one()


async def _assert_city(db: AsyncSession, city_id: uuid.UUID) -> None:
    if await db.get(City, city_id) is None:
        raise ApiError("NOT_FOUND", "City not found")


async def create_activity(db: AsyncSession, data: ActivityWrite) -> Activity:
    await _assert_city(db, data.city_id)
    activity = Activity(**data.model_dump())
    db.add(activity)
    try:
        await db.commit()
    except IntegrityError:
        # UNIQUE (city_id, name).
        await _unique_or_409(db, f"{data.name} already exists in that city")
    return await _reload_activity(db, activity.id)


async def update_activity(
    db: AsyncSession, activity_id: uuid.UUID, data: ActivityPatch
) -> Activity:
    activity = await db.get(Activity, activity_id)
    if activity is None:
        raise ApiError("NOT_FOUND", "Activity not found")

    changes = data.model_dump(exclude_unset=True)
    if "city_id" in changes:
        await _assert_city(db, changes["city_id"])
    for field, value in changes.items():
        setattr(activity, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await _unique_or_409(db, "Another activity in that city already has that name")
    return await _reload_activity(db, activity_id)

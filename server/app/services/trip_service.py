import uuid
from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.exceptions import ApiError
from app.core.pagination import PaginationParams
from app.models.budget import BudgetItem
from app.models.catalog import Activity
from app.models.trip import Trip, TripActivity, TripStop
from app.models.user import User
from app.schemas.trip import (
    TripActivityCreate,
    TripActivityUpdate,
    TripCreate,
    TripDuplicate,
    TripSort,
    TripStatus,
    TripStopCreate,
    TripStopUpdate,
    TripUpdate,
)


async def _count(db: AsyncSession, stmt: Select) -> int:
    return await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


TRIP_SORTS = {
    "start_date": (Trip.start_date.desc(),),
    "created_at": (Trip.created_at.desc(),),
    "name": (Trip.name.asc(),),
}


# --- trips --------------------------------------------------------------------


async def list_trips(
    db: AsyncSession,
    user: User,
    pagination: PaginationParams,
    *,
    status: TripStatus | None = None,
    search: str | None = None,
    sort: TripSort = "start_date",
) -> tuple[Sequence[Trip], int]:
    stmt = select(Trip).where(Trip.user_id == user.id)

    if status is not None:
        today = date.today()
        if status == "upcoming":
            stmt = stmt.where(Trip.start_date > today)
        elif status == "past":
            stmt = stmt.where(Trip.end_date < today)
        else:
            stmt = stmt.where(Trip.start_date <= today, Trip.end_date >= today)
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Trip.name.ilike(f"%{escaped}%", escape="\\"))

    total = await _count(db, stmt)
    page = stmt.order_by(*TRIP_SORTS[sort]).offset(pagination.offset).limit(pagination.limit)
    return (await db.execute(page)).scalars().all(), total


async def attach_totals(db: AsyncSession, trips: Sequence[Trip]) -> list[dict]:
    """Activity count and estimated spend for a batch of trips.

    Two grouped queries for the whole page, not one per row. Activity costs are
    multiplied by `travelers` (they are per person) exactly as budget_service
    does; manual budget items are taken as entered.
    """
    if not trips:
        return []
    ids = [trip.id for trip in trips]

    activity_rows = (
        await db.execute(
            select(
                TripStop.trip_id,
                func.count(TripActivity.id),
                func.coalesce(func.sum(TripActivity.cost), 0),
            )
            .join(TripActivity, TripActivity.trip_stop_id == TripStop.id)
            .where(TripStop.trip_id.in_(ids))
            .group_by(TripStop.trip_id)
        )
    ).all()
    activities = {row[0]: (row[1], row[2]) for row in activity_rows}

    manual_rows = (
        await db.execute(
            select(BudgetItem.trip_id, func.coalesce(func.sum(BudgetItem.amount), 0))
            .where(BudgetItem.trip_id.in_(ids))
            .group_by(BudgetItem.trip_id)
        )
    ).all()
    manual = {row[0]: row[1] for row in manual_rows}

    from app.models.catalog import City

    stop_rows = (
        await db.execute(
            select(TripStop.trip_id, City.name)
            .join(City, City.id == TripStop.city_id)
            .where(TripStop.trip_id.in_(ids))
            .order_by(TripStop.trip_id, TripStop.order_index)
        )
    ).all()
    city_names: dict[uuid.UUID, list[str]] = {}
    for trip_id, city_name in stop_rows:
        city_names.setdefault(trip_id, []).append(city_name)

    annotated = []
    for trip in trips:
        count, activity_sum = activities.get(trip.id, (0, Decimal("0")))
        total = Decimal(activity_sum) * trip.travelers + Decimal(manual.get(trip.id, 0))
        annotated.append(
            {
                "trip": trip,
                "activity_count": count,
                "estimated_total": total.quantize(Decimal("0.01")),
                "stop_count": len(city_names.get(trip.id, [])),
                "city_names": city_names.get(trip.id, []),
            }
        )
    return annotated


async def get_trip_tree(db: AsyncSession, trip_id: uuid.UUID) -> Trip:
    """The whole itinerary in a fixed number of queries, never N+1.

    selectinload issues one extra SELECT per collection level regardless of how
    many rows come back: 1 (trip) + 1 (stops, with city joined) + 1 (activities).
    """
    stmt = (
        select(Trip)
        .where(Trip.id == trip_id)
        .options(
            selectinload(Trip.stops).joinedload(TripStop.city),
            selectinload(Trip.stops).selectinload(TripStop.activities),
        )
    )
    trip = (await db.execute(stmt)).unique().scalar_one_or_none()
    if trip is None:
        raise ApiError("NOT_FOUND", "Trip not found")
    return trip


async def create_trip(db: AsyncSession, user: User, data: TripCreate) -> Trip:
    trip = Trip(user_id=user.id, **data.model_dump())
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip


async def update_trip(db: AsyncSession, trip: Trip, data: TripUpdate) -> Trip:
    changes = data.model_dump(exclude_unset=True)
    new_start = changes.get("start_date", trip.start_date)
    new_end = changes.get("end_date", trip.end_date)
    if new_end < new_start:
        raise ApiError("VALIDATION_ERROR", "end_date must not be before start_date")

    if new_start != trip.start_date or new_end != trip.end_date:
        await _reject_orphaned_stops(db, trip, new_start, new_end)

    for field, value in changes.items():
        setattr(trip, field, value)
    await db.commit()
    await db.refresh(trip)
    return trip


async def _reject_orphaned_stops(
    db: AsyncSession, trip: Trip, new_start: date, new_end: date
) -> None:
    """Shrinking a trip's range must never silently orphan the stops inside it."""
    stmt = (
        select(TripStop)
        .options(joinedload(TripStop.city))
        .where(
            TripStop.trip_id == trip.id,
            (TripStop.start_date < new_start) | (TripStop.end_date > new_end),
        )
        .order_by(TripStop.order_index)
    )
    offenders = (await db.execute(stmt)).unique().scalars().all()
    if not offenders:
        return
    raise ApiError(
        "CONFLICT",
        "Some stops fall outside the new trip dates - move or remove them first",
        details=[
            {
                "field": f"stops[{stop.order_index}]",
                "message": f"{stop.city.name}: {stop.start_date} to {stop.end_date}",
            }
            for stop in offenders
        ],
    )


async def delete_trip(db: AsyncSession, trip: Trip) -> None:
    # FK cascades take the stops, their activities and (from Phase 5) budget items.
    await db.delete(trip)
    await db.commit()


async def duplicate_trip(
    db: AsyncSession, user: User, source: Trip, data: TripDuplicate
) -> Trip:
    """Deep copy in one transaction, with every date shifted by the same offset."""
    tree = await get_trip_tree(db, source.id)
    new_start = data.start_date or date.today()
    offset = new_start - tree.start_date

    copy = Trip(
        user_id=user.id,
        name=data.name or f"{tree.name} (copy)",
        description=tree.description,
        start_date=tree.start_date + offset,
        end_date=tree.end_date + offset,
        cover_photo_url=tree.cover_photo_url,
        travelers=tree.travelers,
        currency=tree.currency,
        # A copy is private and unshared until its new owner says otherwise.
        is_public=False,
        share_slug=None,
        copied_from_trip_id=tree.id,
    )
    db.add(copy)
    await db.flush()

    for stop in tree.stops:
        new_stop = TripStop(
            trip_id=copy.id,
            city_id=stop.city_id,
            start_date=stop.start_date + offset,
            end_date=stop.end_date + offset,
            order_index=stop.order_index,
            notes=stop.notes,
        )
        db.add(new_stop)
        await db.flush()
        for item in stop.activities:
            db.add(
                TripActivity(
                    trip_stop_id=new_stop.id,
                    activity_id=item.activity_id,
                    name=item.name,
                    category=item.category,
                    scheduled_date=item.scheduled_date + offset,
                    start_time=item.start_time,
                    duration_minutes=item.duration_minutes,
                    cost=item.cost,
                    order_index=item.order_index,
                    notes=item.notes,
                )
            )

    await db.commit()
    return await get_trip_tree(db, copy.id)


# --- stops --------------------------------------------------------------------


def _assert_within_trip(trip: Trip, start: date, end: date) -> None:
    if start < trip.start_date or end > trip.end_date:
        raise ApiError(
            "VALIDATION_ERROR",
            f"Stop dates must fall inside the trip ({trip.start_date} to {trip.end_date})",
        )


def _overlap_warnings(existing: Sequence[TripStop], start: date, end: date) -> list[str]:
    """Overlaps are allowed - travel days genuinely overlap - but worth saying."""
    return [
        f"Overlaps stop {other.order_index + 1} ({other.start_date} to {other.end_date})"
        for other in existing
        if other.start_date <= end and start <= other.end_date
    ]


async def list_stops(db: AsyncSession, trip: Trip) -> Sequence[TripStop]:
    stmt = (
        select(TripStop)
        .where(TripStop.trip_id == trip.id)
        .options(joinedload(TripStop.city), selectinload(TripStop.activities))
        .order_by(TripStop.order_index)
    )
    return (await db.execute(stmt)).unique().scalars().all()


async def _reload_stop(db: AsyncSession, stop_id: uuid.UUID) -> TripStop:
    # TripStop.city is lazy="raise", so a serialized stop must arrive eager-loaded.
    stmt = (
        select(TripStop)
        .where(TripStop.id == stop_id)
        .options(joinedload(TripStop.city), selectinload(TripStop.activities))
    )
    return (await db.execute(stmt)).unique().scalar_one()


async def get_stop(db: AsyncSession, trip: Trip, stop_id: uuid.UUID) -> TripStop:
    stmt = select(TripStop).where(TripStop.id == stop_id, TripStop.trip_id == trip.id)
    stop = (await db.execute(stmt)).scalar_one_or_none()
    if stop is None:
        # Scoped to the trip, so a valid id from someone else's trip is a 404 here.
        raise ApiError("NOT_FOUND", "Stop not found on this trip")
    return stop


async def add_stop(
    db: AsyncSession, trip: Trip, data: TripStopCreate
) -> tuple[TripStop, list[str]]:
    _assert_within_trip(trip, data.start_date, data.end_date)
    existing = (
        await db.execute(
            select(TripStop).where(TripStop.trip_id == trip.id).order_by(TripStop.order_index)
        )
    ).scalars().all()

    stop = TripStop(trip_id=trip.id, order_index=len(existing), **data.model_dump())
    db.add(stop)
    await db.commit()
    return await _reload_stop(db, stop.id), _overlap_warnings(
        existing, data.start_date, data.end_date
    )


async def update_stop(
    db: AsyncSession, trip: Trip, stop_id: uuid.UUID, data: TripStopUpdate
) -> tuple[TripStop, list[str]]:
    stop = await get_stop(db, trip, stop_id)
    changes = data.model_dump(exclude_unset=True)
    new_start = changes.get("start_date", stop.start_date)
    new_end = changes.get("end_date", stop.end_date)
    if new_end < new_start:
        raise ApiError("VALIDATION_ERROR", "end_date must not be before start_date")
    _assert_within_trip(trip, new_start, new_end)

    if "city_id" in changes:
        await _assert_city_exists(db, changes["city_id"])

    for field, value in changes.items():
        setattr(stop, field, value)

    # Activities already scheduled outside the stop's new range would be orphaned.
    await _reject_orphaned_activities(db, stop, new_start, new_end)
    await db.commit()

    others = (
        await db.execute(
            select(TripStop).where(TripStop.trip_id == trip.id, TripStop.id != stop.id)
        )
    ).scalars().all()
    return await _reload_stop(db, stop.id), _overlap_warnings(others, new_start, new_end)


async def _assert_city_exists(db: AsyncSession, city_id: uuid.UUID) -> None:
    from app.models.catalog import City

    city = await db.get(City, city_id)
    if city is None or not city.is_active:
        raise ApiError("NOT_FOUND", "City not found")


async def _reject_orphaned_activities(
    db: AsyncSession, stop: TripStop, new_start: date, new_end: date
) -> None:
    stmt = select(TripActivity).where(
        TripActivity.trip_stop_id == stop.id,
        (TripActivity.scheduled_date < new_start) | (TripActivity.scheduled_date > new_end),
    )
    offenders = (await db.execute(stmt)).scalars().all()
    if not offenders:
        return
    raise ApiError(
        "CONFLICT",
        "Some activities fall outside the stop's new dates - move them first",
        details=[
            {"field": "activities", "message": f"{item.name} on {item.scheduled_date}"}
            for item in offenders
        ],
    )


async def delete_stop(db: AsyncSession, trip: Trip, stop_id: uuid.UUID) -> None:
    stop = await get_stop(db, trip, stop_id)
    await db.delete(stop)
    await db.flush()
    # Close the gap so order_index stays a dense 0..n-1 sequence.
    remaining = (
        await db.execute(
            select(TripStop).where(TripStop.trip_id == trip.id).order_by(TripStop.order_index)
        )
    ).scalars().all()
    for index, row in enumerate(remaining):
        row.order_index = index
    await db.commit()


async def reorder_stops(
    db: AsyncSession, trip: Trip, order: list[uuid.UUID]
) -> Sequence[TripStop]:
    stops = (
        await db.execute(select(TripStop).where(TripStop.trip_id == trip.id))
    ).scalars().all()
    _assert_same_set({s.id for s in stops}, order, "stops")

    position = {stop_id: index for index, stop_id in enumerate(order)}
    for stop in stops:
        stop.order_index = position[stop.id]
    # Safe in one pass: the unique constraint is DEFERRABLE INITIALLY DEFERRED,
    # so it is only checked at COMMIT.
    await db.commit()
    return await list_stops(db, trip)


def _assert_same_set(known: set[uuid.UUID], order: list[uuid.UUID], label: str) -> None:
    submitted = set(order)
    if len(submitted) != len(order):
        raise ApiError("VALIDATION_ERROR", f"Duplicate ids in the {label} order")
    if submitted != known:
        raise ApiError(
            "VALIDATION_ERROR",
            f"The {label} order must list every id exactly once "
            f"({len(known)} expected, {len(submitted)} given)",
        )


# --- trip activities ----------------------------------------------------------


async def get_trip_activity(
    db: AsyncSession, stop: TripStop, item_id: uuid.UUID
) -> TripActivity:
    stmt = select(TripActivity).where(
        TripActivity.id == item_id, TripActivity.trip_stop_id == stop.id
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise ApiError("NOT_FOUND", "Activity not found on this stop")
    return item


async def add_activity(
    db: AsyncSession, trip: Trip, stop_id: uuid.UUID, data: TripActivityCreate
) -> TripActivity:
    stop = await get_stop(db, trip, stop_id)
    if not (stop.start_date <= data.scheduled_date <= stop.end_date):
        raise ApiError(
            "VALIDATION_ERROR",
            f"scheduled_date must fall inside the stop ({stop.start_date} to {stop.end_date})",
        )

    name, category, cost = data.name, data.category, data.cost
    if data.activity_id is not None:
        catalog = await db.get(Activity, data.activity_id)
        if catalog is None or not catalog.is_active:
            raise ApiError("NOT_FOUND", "Activity not found")
        # Snapshot: the saved trip must not change when the catalog does.
        name = name or catalog.name
        category = category or catalog.category
        cost = catalog.estimated_cost if cost is None else cost

    next_index = await db.scalar(
        select(func.coalesce(func.max(TripActivity.order_index) + 1, 0)).where(
            TripActivity.trip_stop_id == stop.id,
            TripActivity.scheduled_date == data.scheduled_date,
        )
    )

    item = TripActivity(
        trip_stop_id=stop.id,
        activity_id=data.activity_id,
        name=name or "Untitled activity",
        category=category,
        scheduled_date=data.scheduled_date,
        start_time=data.start_time,
        duration_minutes=data.duration_minutes,
        cost=cost if cost is not None else Decimal("0"),
        order_index=next_index or 0,
        notes=data.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_activity(
    db: AsyncSession,
    trip: Trip,
    stop_id: uuid.UUID,
    item_id: uuid.UUID,
    data: TripActivityUpdate,
) -> TripActivity:
    stop = await get_stop(db, trip, stop_id)
    item = await get_trip_activity(db, stop, item_id)
    changes = data.model_dump(exclude_unset=True)

    if "scheduled_date" in changes:
        moved = changes["scheduled_date"]
        if not (stop.start_date <= moved <= stop.end_date):
            raise ApiError(
                "VALIDATION_ERROR",
                f"scheduled_date must fall inside the stop "
                f"({stop.start_date} to {stop.end_date})",
            )

    for field, value in changes.items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_activity(
    db: AsyncSession, trip: Trip, stop_id: uuid.UUID, item_id: uuid.UUID
) -> None:
    stop = await get_stop(db, trip, stop_id)
    item = await get_trip_activity(db, stop, item_id)
    scheduled_date = item.scheduled_date
    await db.delete(item)
    await db.flush()

    remaining = (
        await db.execute(
            select(TripActivity)
            .where(
                TripActivity.trip_stop_id == stop.id,
                TripActivity.scheduled_date == scheduled_date,
            )
            .order_by(TripActivity.order_index)
        )
    ).scalars().all()
    for index, row in enumerate(remaining):
        row.order_index = index
    await db.commit()


async def reorder_activities(
    db: AsyncSession, trip: Trip, stop_id: uuid.UUID, order: list[uuid.UUID]
) -> Sequence[TripActivity]:
    """Reorders within a single day: every id must share one scheduled_date."""
    stop = await get_stop(db, trip, stop_id)
    items = (
        await db.execute(
            select(TripActivity).where(
                TripActivity.trip_stop_id == stop.id, TripActivity.id.in_(order)
            )
        )
    ).scalars().all()

    if len(items) != len(set(order)):
        raise ApiError("NOT_FOUND", "Some activities are not on this stop")
    days = {item.scheduled_date for item in items}
    if len(days) > 1:
        raise ApiError("VALIDATION_ERROR", "Reorder one day at a time")

    same_day = (
        await db.execute(
            select(TripActivity).where(
                TripActivity.trip_stop_id == stop.id,
                TripActivity.scheduled_date == days.pop(),
            )
        )
    ).scalars().all()
    _assert_same_set({item.id for item in same_day}, order, "activities")

    position = {item_id: index for index, item_id in enumerate(order)}
    for item in same_day:
        item.order_index = position[item.id]
    await db.commit()

    return (
        await db.execute(
            select(TripActivity)
            .where(TripActivity.trip_stop_id == stop.id)
            .order_by(TripActivity.scheduled_date, TripActivity.order_index)
        )
    ).scalars().all()

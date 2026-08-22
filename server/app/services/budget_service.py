"""Budget aggregation.

Everything here is computed on read, in SQL. There is no denormalised totals
column: a stored total is a cache, and a cache that nothing invalidates is a bug
waiting for someone to edit an activity price.
"""

import uuid
from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Numeric, bindparam, cast, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.models.budget import BudgetCategory, BudgetItem
from app.models.catalog import City
from app.models.trip import Trip, TripActivity, TripStop
from app.schemas.budget import (
    BudgetItemCreate,
    BudgetItemUpdate,
    BudgetSummary,
    CategoryTotal,
    CityTotal,
    DayTotal,
)

DEFAULT_OVER_BUDGET_THRESHOLD = Decimal("1.5")
ZERO = Decimal("0.00")

MONEY = Numeric(10, 2)


def _money(value: Decimal | int | None) -> Decimal:
    return (Decimal(value) if value is not None else ZERO).quantize(Decimal("0.01"))


# --- budget items (CRUD) ------------------------------------------------------


async def list_items(db: AsyncSession, trip: Trip) -> Sequence[BudgetItem]:
    stmt = (
        select(BudgetItem)
        .where(BudgetItem.trip_id == trip.id)
        .order_by(BudgetItem.incurred_on.asc().nulls_last(), BudgetItem.created_at)
    )
    return (await db.execute(stmt)).scalars().all()


async def _validate_placement(
    db: AsyncSession, trip: Trip, incurred_on: date | None, stop_id: uuid.UUID | None
) -> None:
    if incurred_on is not None and not (trip.start_date <= incurred_on <= trip.end_date):
        raise ApiError(
            "VALIDATION_ERROR",
            f"incurred_on must fall inside the trip ({trip.start_date} to {trip.end_date})",
        )
    if stop_id is not None:
        stop = await db.get(TripStop, stop_id)
        if stop is None or stop.trip_id != trip.id:
            raise ApiError("NOT_FOUND", "Stop not found on this trip")


async def add_item(db: AsyncSession, trip: Trip, data: BudgetItemCreate) -> BudgetItem:
    await _validate_placement(db, trip, data.incurred_on, data.trip_stop_id)
    item = BudgetItem(trip_id=trip.id, **data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_item(db: AsyncSession, trip: Trip, item_id: uuid.UUID) -> BudgetItem:
    stmt = select(BudgetItem).where(BudgetItem.id == item_id, BudgetItem.trip_id == trip.id)
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise ApiError("NOT_FOUND", "Budget item not found on this trip")
    return item


async def update_item(
    db: AsyncSession, trip: Trip, item_id: uuid.UUID, data: BudgetItemUpdate
) -> BudgetItem:
    item = await get_item(db, trip, item_id)
    changes = data.model_dump(exclude_unset=True)
    await _validate_placement(
        db,
        trip,
        changes.get("incurred_on", item.incurred_on),
        changes.get("trip_stop_id", item.trip_stop_id),
    )
    for field, value in changes.items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_item(db: AsyncSession, trip: Trip, item_id: uuid.UUID) -> None:
    await db.delete(await get_item(db, trip, item_id))
    await db.commit()


# --- the aggregation ---------------------------------------------------------


async def get_budget(
    db: AsyncSession, trip: Trip, threshold: Decimal = DEFAULT_OVER_BUDGET_THRESHOLD
) -> BudgetSummary:
    travelers = trip.travelers

    # Activity costs are per person; manual items are entered as a total.
    activities_total = _money(
        await db.scalar(
            select(func.coalesce(func.sum(TripActivity.cost), 0))
            .select_from(TripActivity)
            .join(TripStop, TripStop.id == TripActivity.trip_stop_id)
            .where(TripStop.trip_id == trip.id)
        )
    ) * travelers
    manual_total = _money(
        await db.scalar(
            select(func.coalesce(func.sum(BudgetItem.amount), 0)).where(
                BudgetItem.trip_id == trip.id
            )
        )
    )
    grand_total = _money(activities_total + manual_total)

    days = trip.duration_days
    avg_per_day = _money(grand_total / days) if days else ZERO
    over_budget_line = _money(avg_per_day * threshold)

    return BudgetSummary(
        currency=trip.currency,
        travelers=travelers,
        days=days,
        activities_total=activities_total,
        manual_total=manual_total,
        grand_total=grand_total,
        avg_per_day=avg_per_day,
        over_budget_threshold=threshold,
        by_category=await _by_category(db, trip, activities_total),
        by_activity_category=await _by_activity_category(db, trip, travelers),
        by_day=await _by_day(db, trip, travelers, over_budget_line),
        by_city=await _by_city(db, trip, travelers),
        undated_total=_money(
            await db.scalar(
                select(func.coalesce(func.sum(BudgetItem.amount), 0)).where(
                    BudgetItem.trip_id == trip.id, BudgetItem.incurred_on.is_(None)
                )
            )
        ),
        unassigned_total=_money(
            await db.scalar(
                select(func.coalesce(func.sum(BudgetItem.amount), 0)).where(
                    BudgetItem.trip_id == trip.id, BudgetItem.trip_stop_id.is_(None)
                )
            )
        ),
    )


async def _by_category(
    db: AsyncSession, trip: Trip, activities_total: Decimal
) -> list[CategoryTotal]:
    """Budget-category buckets. Every trip activity lands in ACTIVITIES, which is
    also where a manually-added ACTIVITIES item goes - they add up, not compete."""
    rows = (
        await db.execute(
            select(BudgetItem.category, func.sum(BudgetItem.amount))
            .where(BudgetItem.trip_id == trip.id)
            .group_by(BudgetItem.category)
        )
    ).all()
    totals = {category.value: ZERO for category in BudgetCategory}
    totals[BudgetCategory.ACTIVITIES.value] = activities_total
    for category, amount in rows:
        totals[category.value] = _money(totals[category.value] + _money(amount))
    return [
        CategoryTotal(category=name, amount=amount)
        for name, amount in totals.items()
        if amount > 0
    ]


async def _by_activity_category(
    db: AsyncSession, trip: Trip, travelers: int
) -> list[CategoryTotal]:
    """The finer split the itinerary screens actually chart: CULTURE vs FOOD vs …"""
    rows = (
        await db.execute(
            select(TripActivity.category, func.sum(TripActivity.cost))
            .join(TripStop, TripStop.id == TripActivity.trip_stop_id)
            .where(TripStop.trip_id == trip.id)
            .group_by(TripActivity.category)
            .order_by(func.sum(TripActivity.cost).desc())
        )
    ).all()
    return [
        CategoryTotal(
            category=category.value if category else "UNCATEGORISED",
            amount=_money(amount) * travelers,
        )
        for category, amount in rows
    ]


async def _by_day(
    db: AsyncSession, trip: Trip, travelers: int, over_budget_line: Decimal
) -> list[DayTotal]:
    """A continuous series with a row for every day, including the free ones.

    generate_series produces the calendar; the cost tables are LEFT JOINed onto
    it. Filling the gaps client-side is exactly where off-by-one bugs breed.
    """
    calendar = (
        select(
            func.generate_series(
                bindparam("range_start", trip.start_date, type_=Date),
                bindparam("range_end", trip.end_date, type_=Date),
                literal_column("'1 day'"),
            ).label("day")
        )
        .subquery("calendar")
    )

    activities = (
        select(
            TripActivity.scheduled_date.label("day"),
            func.sum(TripActivity.cost).label("amount"),
        )
        .join(TripStop, TripStop.id == TripActivity.trip_stop_id)
        .where(TripStop.trip_id == trip.id)
        .group_by(TripActivity.scheduled_date)
        .subquery("activities_by_day")
    )
    manual = (
        select(BudgetItem.incurred_on.label("day"), func.sum(BudgetItem.amount).label("amount"))
        .where(BudgetItem.trip_id == trip.id, BudgetItem.incurred_on.is_not(None))
        .group_by(BudgetItem.incurred_on)
        .subquery("manual_by_day")
    )

    day = cast(calendar.c.day, Date)
    total = func.coalesce(activities.c.amount, 0) * travelers + func.coalesce(
        manual.c.amount, 0
    )

    stmt = (
        select(day.label("day"), cast(total, MONEY).label("amount"))
        .select_from(calendar)
        .outerjoin(activities, activities.c.day == day)
        .outerjoin(manual, manual.c.day == day)
        .order_by(day)
    )

    return [
        DayTotal(
            day=row.day,
            amount=_money(row.amount),
            # Strictly greater: with a perfectly flat spend every day would sit
            # exactly on the line, and flagging all of them tells you nothing.
            over_budget=_money(row.amount) > over_budget_line,
        )
        for row in (await db.execute(stmt)).all()
    ]


async def _by_city(db: AsyncSession, trip: Trip, travelers: int) -> list[CityTotal]:
    """Rolls costs up through the stops. Manual items with no stop are excluded -
    they are reported as `unassigned_total` instead of being spread arbitrarily."""
    activities = (
        select(
            TripStop.city_id.label("city_id"),
            (func.sum(TripActivity.cost) * travelers).label("amount"),
        )
        .join(TripActivity, TripActivity.trip_stop_id == TripStop.id)
        .where(TripStop.trip_id == trip.id)
        .group_by(TripStop.city_id)
    )
    manual = (
        select(TripStop.city_id.label("city_id"), func.sum(BudgetItem.amount).label("amount"))
        .join(BudgetItem, BudgetItem.trip_stop_id == TripStop.id)
        .where(BudgetItem.trip_id == trip.id)
        .group_by(TripStop.city_id)
    )
    combined = activities.union_all(manual).subquery("per_city")

    stmt = (
        select(
            combined.c.city_id,
            City.name,
            cast(func.sum(combined.c.amount), MONEY).label("amount"),
        )
        .join(City, City.id == combined.c.city_id)
        .group_by(combined.c.city_id, City.name)
        .order_by(func.sum(combined.c.amount).desc())
    )

    return [
        CityTotal(city_id=row.city_id, city_name=row.name, amount=_money(row.amount))
        for row in (await db.execute(stmt)).all()
    ]

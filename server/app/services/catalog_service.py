import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import ApiError
from app.core.pagination import PaginationParams
from app.models.catalog import Activity, ActivityCategory, City
from app.schemas.catalog import ActivitySort, CitySort

POPULAR_CITY_LIMIT = 8


def _like(term: str) -> str:
    """Escape LIKE wildcards so a user typing `%` or `_` searches for that character."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def _count(db: AsyncSession, stmt: Select) -> int:
    return await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


CITY_SORTS = {
    "popularity": (City.popularity_score.desc(), City.name.asc()),
    "name": (City.name.asc(),),
    "cost_index": (City.cost_index.asc(), City.name.asc()),
}


async def list_cities(
    db: AsyncSession,
    pagination: PaginationParams,
    *,
    search: str | None = None,
    country: str | None = None,
    region: str | None = None,
    max_cost_index: int | None = None,
    sort: CitySort = "popularity",
) -> tuple[Sequence[City], int]:
    stmt = select(City).where(City.is_active.is_(True))
    if search:
        stmt = stmt.where(City.name.ilike(_like(search), escape="\\"))
    if country:
        stmt = stmt.where(City.country.ilike(country))
    if region:
        stmt = stmt.where(City.region.ilike(region))
    if max_cost_index is not None:
        stmt = stmt.where(City.cost_index <= max_cost_index)

    total = await _count(db, stmt)
    page = stmt.order_by(*CITY_SORTS[sort]).offset(pagination.offset).limit(pagination.limit)
    return (await db.execute(page)).scalars().all(), total


async def get_city(db: AsyncSession, city_id: uuid.UUID) -> City:
    city = await db.get(City, city_id)
    if city is None or not city.is_active:
        raise ApiError("NOT_FOUND", "City not found")
    return city


async def popular_cities(db: AsyncSession, limit: int = POPULAR_CITY_LIMIT) -> Sequence[City]:
    stmt = (
        select(City)
        .where(City.is_active.is_(True))
        .order_by(City.popularity_score.desc(), City.name.asc())
        .limit(limit)
    )
    return (await db.execute(stmt)).scalars().all()


ACTIVITY_SORTS = {
    "cost": (Activity.estimated_cost.asc(), Activity.name.asc()),
    "duration": (Activity.duration_minutes.asc().nulls_last(), Activity.name.asc()),
    "name": (Activity.name.asc(),),
}


async def list_activities(
    db: AsyncSession,
    pagination: PaginationParams,
    *,
    city_id: uuid.UUID | None = None,
    category: ActivityCategory | None = None,
    min_cost: Decimal | None = None,
    max_cost: Decimal | None = None,
    max_duration: int | None = None,
    search: str | None = None,
    sort: ActivitySort = "cost",
) -> tuple[Sequence[Activity], int]:
    # joinedload, not selectinload: one row per activity either way, and
    # Activity.city_name needs the City row present at serialization time.
    stmt = select(Activity).options(joinedload(Activity.city)).where(Activity.is_active.is_(True))
    if city_id is not None:
        stmt = stmt.where(Activity.city_id == city_id)
    if category is not None:
        stmt = stmt.where(Activity.category == category)
    if min_cost is not None:
        stmt = stmt.where(Activity.estimated_cost >= min_cost)
    if max_cost is not None:
        stmt = stmt.where(Activity.estimated_cost <= max_cost)
    if max_duration is not None:
        stmt = stmt.where(Activity.duration_minutes <= max_duration)
    if search:
        stmt = stmt.where(Activity.name.ilike(_like(search), escape="\\"))

    total = await _count(db, stmt)
    page = stmt.order_by(*ACTIVITY_SORTS[sort]).offset(pagination.offset).limit(pagination.limit)
    return (await db.execute(page)).scalars().all(), total


async def get_activity(db: AsyncSession, activity_id: uuid.UUID) -> Activity:
    stmt = (
        select(Activity).options(joinedload(Activity.city)).where(Activity.id == activity_id)
    )
    activity = (await db.execute(stmt)).scalar_one_or_none()
    if activity is None or not activity.is_active:
        raise ApiError("NOT_FOUND", "Activity not found")
    return activity

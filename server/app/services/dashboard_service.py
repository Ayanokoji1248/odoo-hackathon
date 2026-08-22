from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.user import User
from app.schemas.budget import Dashboard, TripBudgetHighlight, TripCounts
from app.schemas.catalog import CityListItem
from app.schemas.trip import TripListItem
from app.services import budget_service, catalog_service, trip_service

UPCOMING_LIMIT = 3
POPULAR_CITY_LIMIT = 6


async def get_dashboard(db: AsyncSession, user: User) -> Dashboard:
    """One payload for the home screen. Four queries plus the budget rollup,
    rather than six round trips from the client."""
    today = date.today()

    counts_row = (
        await db.execute(
            select(
                func.count().label("total"),
                func.count(case((Trip.start_date > today, 1))).label("upcoming"),
                func.count(
                    case(((Trip.start_date <= today) & (Trip.end_date >= today), 1))
                ).label("ongoing"),
                func.count(case((Trip.end_date < today, 1))).label("past"),
            ).where(Trip.user_id == user.id)
        )
    ).one()

    upcoming = (
        await db.execute(
            select(Trip)
            .where(Trip.user_id == user.id, Trip.end_date >= today)
            .order_by(Trip.start_date.asc())
            .limit(UPCOMING_LIMIT)
        )
    ).scalars().all()

    popular = await catalog_service.popular_cities(db, POPULAR_CITY_LIMIT)

    # The nearest trip that has not finished; falls back to the most recent one so
    # a user whose trips are all in the past still sees something.
    highlight_trip = upcoming[0] if upcoming else None
    if highlight_trip is None:
        highlight_trip = (
            await db.execute(
                select(Trip)
                .where(Trip.user_id == user.id)
                .order_by(Trip.start_date.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    highlight = None
    if highlight_trip is not None:
        summary = await budget_service.get_budget(db, highlight_trip)
        highlight = TripBudgetHighlight(
            trip=TripListItem.model_validate(highlight_trip),
            grand_total=summary.grand_total,
            avg_per_day=summary.avg_per_day,
            currency=summary.currency,
        )

    return Dashboard(
        counts=TripCounts(
            total=counts_row.total,
            upcoming=counts_row.upcoming,
            ongoing=counts_row.ongoing,
            past=counts_row.past,
        ),
        upcoming_trips=[
            TripListItem.model_validate(row["trip"]).model_copy(
                update={
                    "activity_count": row["activity_count"],
                    "estimated_total": row["estimated_total"],
                    "stop_count": row["stop_count"],
                    "city_names": row["city_names"],
                }
            )
            for row in await trip_service.attach_totals(db, upcoming)
        ],
        popular_cities=[CityListItem.model_validate(c) for c in popular],
        budget_highlight=highlight,
    )

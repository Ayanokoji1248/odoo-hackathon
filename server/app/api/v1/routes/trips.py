from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.pagination import Pagination
from app.core.schemas import ApiResponse, PageMeta
from app.deps import CurrentUser, DbSession, OwnedTrip
from app.schemas.trip import (
    TripCreate,
    TripDuplicate,
    TripListItem,
    TripRead,
    TripSort,
    TripStatus,
    TripUpdate,
)
from app.services import trip_service

router = APIRouter(prefix="/trips", tags=["trips"])


async def _read(db: DbSession, trip) -> TripRead:
    """One trip with its tree AND its aggregates, so a detail response carries the
    same activity_count / estimated_total the list cards show."""
    tree = await trip_service.get_trip_tree(db, trip.id)
    totals = (await trip_service.attach_totals(db, [tree]))[0]
    return TripRead.model_validate(tree).model_copy(
        update={
            "activity_count": totals["activity_count"],
            "estimated_total": totals["estimated_total"],
            "stop_count": totals["stop_count"],
            "city_names": totals["city_names"],
        }
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_trip(
    data: TripCreate, db: DbSession, user: CurrentUser
) -> ApiResponse[TripListItem]:
    trip = await trip_service.create_trip(db, user, data)
    return ApiResponse(data=TripListItem.model_validate(trip))


@router.get("")
async def list_trips(
    db: DbSession,
    user: CurrentUser,
    pagination: Pagination,
    trip_status: Annotated[TripStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=160)] = None,
    sort: TripSort = "start_date",
) -> ApiResponse[list[TripListItem]]:
    trips, total = await trip_service.list_trips(
        db, user, pagination, status=trip_status, search=search, sort=sort
    )
    annotated = await trip_service.attach_totals(db, trips)
    return ApiResponse(
        data=[
            TripListItem.model_validate(row["trip"]).model_copy(
                update={
                    "activity_count": row["activity_count"],
                    "estimated_total": row["estimated_total"],
                    "stop_count": row["stop_count"],
                    "city_names": row["city_names"],
                }
            )
            for row in annotated
        ],
        meta=PageMeta(page=pagination.page, limit=pagination.limit, total=total),
    )


@router.get("/{trip_id}")
async def get_trip(db: DbSession, trip: OwnedTrip) -> ApiResponse[TripRead]:
    """The full nested itinerary. Ownership is checked by the dependency; the
    tree itself is re-read with selectinload so there is no N+1."""
    return ApiResponse(data=await _read(db, trip))


@router.patch("/{trip_id}")
async def update_trip(
    data: TripUpdate, db: DbSession, trip: OwnedTrip
) -> ApiResponse[TripListItem]:
    updated = await trip_service.update_trip(db, trip, data)
    return ApiResponse(data=TripListItem.model_validate(updated))


@router.delete("/{trip_id}")
async def delete_trip(db: DbSession, trip: OwnedTrip) -> ApiResponse[dict]:
    await trip_service.delete_trip(db, trip)
    return ApiResponse(data={"deleted": True})


@router.post("/{trip_id}/duplicate", status_code=status.HTTP_201_CREATED)
async def duplicate_trip(
    data: TripDuplicate, db: DbSession, user: CurrentUser, trip: OwnedTrip
) -> ApiResponse[TripRead]:
    copy = await trip_service.duplicate_trip(db, user, trip, data)
    return ApiResponse(data=await _read(db, copy))

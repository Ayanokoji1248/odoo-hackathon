import uuid

from fastapi import APIRouter, status

from app.core.schemas import ApiResponse
from app.deps import DbSession, OwnedTrip
from app.schemas.trip import (
    ReorderRequest,
    TripStopCreate,
    TripStopRead,
    TripStopUpdate,
    TripStopWritten,
)
from app.services import trip_service

# Nested under the trip so `get_owned_trip` authorizes every route here.
router = APIRouter(prefix="/trips/{trip_id}/stops", tags=["itinerary"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_stop(
    data: TripStopCreate, db: DbSession, trip: OwnedTrip
) -> ApiResponse[TripStopWritten]:
    stop, warnings = await trip_service.add_stop(db, trip, data)
    return ApiResponse(
        data=TripStopWritten(stop=TripStopRead.model_validate(stop), warnings=warnings)
    )


@router.get("")
async def list_stops(db: DbSession, trip: OwnedTrip) -> ApiResponse[list[TripStopRead]]:
    stops = await trip_service.list_stops(db, trip)
    return ApiResponse(data=[TripStopRead.model_validate(s) for s in stops])


# Declared before /{stop_id}, or "reorder" is parsed as a uuid and 400s.
@router.patch("/reorder")
async def reorder_stops(
    data: ReorderRequest, db: DbSession, trip: OwnedTrip
) -> ApiResponse[list[TripStopRead]]:
    stops = await trip_service.reorder_stops(db, trip, data.order)
    return ApiResponse(data=[TripStopRead.model_validate(s) for s in stops])


@router.patch("/{stop_id}")
async def update_stop(
    stop_id: uuid.UUID, data: TripStopUpdate, db: DbSession, trip: OwnedTrip
) -> ApiResponse[TripStopWritten]:
    stop, warnings = await trip_service.update_stop(db, trip, stop_id, data)
    return ApiResponse(
        data=TripStopWritten(stop=TripStopRead.model_validate(stop), warnings=warnings)
    )


@router.delete("/{stop_id}")
async def delete_stop(
    stop_id: uuid.UUID, db: DbSession, trip: OwnedTrip
) -> ApiResponse[dict]:
    await trip_service.delete_stop(db, trip, stop_id)
    return ApiResponse(data={"deleted": True})

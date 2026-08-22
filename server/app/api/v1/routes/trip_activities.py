import uuid

from fastapi import APIRouter, status

from app.core.schemas import ApiResponse
from app.deps import DbSession, OwnedTrip
from app.schemas.trip import (
    ReorderRequest,
    TripActivityCreate,
    TripActivityRead,
    TripActivityUpdate,
)
from app.services import trip_service

router = APIRouter(
    prefix="/trips/{trip_id}/stops/{stop_id}/activities", tags=["itinerary"]
)


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_activity(
    stop_id: uuid.UUID, data: TripActivityCreate, db: DbSession, trip: OwnedTrip
) -> ApiResponse[TripActivityRead]:
    """Add from the catalog (`activity_id`) or as a custom entry (`name`).

    Catalog name, category and cost are **snapshotted** here, so later edits to
    the catalog cannot change a saved itinerary or its budget.
    """
    item = await trip_service.add_activity(db, trip, stop_id, data)
    return ApiResponse(data=TripActivityRead.model_validate(item))


@router.patch("/reorder")
async def reorder_activities(
    stop_id: uuid.UUID, data: ReorderRequest, db: DbSession, trip: OwnedTrip
) -> ApiResponse[list[TripActivityRead]]:
    items = await trip_service.reorder_activities(db, trip, stop_id, data.order)
    return ApiResponse(data=[TripActivityRead.model_validate(i) for i in items])


@router.patch("/{item_id}")
async def update_activity(
    stop_id: uuid.UUID,
    item_id: uuid.UUID,
    data: TripActivityUpdate,
    db: DbSession,
    trip: OwnedTrip,
) -> ApiResponse[TripActivityRead]:
    item = await trip_service.update_activity(db, trip, stop_id, item_id, data)
    return ApiResponse(data=TripActivityRead.model_validate(item))


@router.delete("/{item_id}")
async def delete_activity(
    stop_id: uuid.UUID, item_id: uuid.UUID, db: DbSession, trip: OwnedTrip
) -> ApiResponse[dict]:
    await trip_service.delete_activity(db, trip, stop_id, item_id)
    return ApiResponse(data={"deleted": True})

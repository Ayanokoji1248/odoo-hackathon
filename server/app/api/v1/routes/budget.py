import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.schemas import ApiResponse
from app.deps import DbSession, OwnedTrip
from app.schemas.budget import (
    BudgetItemCreate,
    BudgetItemRead,
    BudgetItemUpdate,
    BudgetSummary,
)
from app.services import budget_service

router = APIRouter(prefix="/trips/{trip_id}", tags=["budget"])


@router.get("/budget")
async def get_budget(
    db: DbSession,
    trip: OwnedTrip,
    threshold: Annotated[Decimal, Query(ge=1, le=5)] = budget_service.DEFAULT_OVER_BUDGET_THRESHOLD,
) -> ApiResponse[BudgetSummary]:
    """Totals, category splits, a gap-free per-day series and a per-city rollup.

    `threshold` scales the over-budget line (default 1.5 x the daily average).
    """
    return ApiResponse(data=await budget_service.get_budget(db, trip, threshold))


@router.get("/budget-items")
async def list_budget_items(
    db: DbSession, trip: OwnedTrip
) -> ApiResponse[list[BudgetItemRead]]:
    items = await budget_service.list_items(db, trip)
    return ApiResponse(data=[BudgetItemRead.model_validate(i) for i in items])


@router.post("/budget-items", status_code=status.HTTP_201_CREATED)
async def add_budget_item(
    data: BudgetItemCreate, db: DbSession, trip: OwnedTrip
) -> ApiResponse[BudgetItemRead]:
    item = await budget_service.add_item(db, trip, data)
    return ApiResponse(data=BudgetItemRead.model_validate(item))


@router.patch("/budget-items/{item_id}")
async def update_budget_item(
    item_id: uuid.UUID, data: BudgetItemUpdate, db: DbSession, trip: OwnedTrip
) -> ApiResponse[BudgetItemRead]:
    item = await budget_service.update_item(db, trip, item_id, data)
    return ApiResponse(data=BudgetItemRead.model_validate(item))


@router.delete("/budget-items/{item_id}")
async def delete_budget_item(
    item_id: uuid.UUID, db: DbSession, trip: OwnedTrip
) -> ApiResponse[dict]:
    await budget_service.delete_item(db, trip, item_id)
    return ApiResponse(data={"deleted": True})

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.pagination import Pagination
from app.core.schemas import ApiResponse, PageMeta
from app.deps import DbSession
from app.models.catalog import ActivityCategory
from app.schemas.catalog import ActivityListItem, ActivityRead, ActivitySort
from app.services import catalog_service

router = APIRouter(prefix="/activities", tags=["catalog"])


@router.get("")
async def list_activities(
    db: DbSession,
    pagination: Pagination,
    city_id: uuid.UUID | None = None,
    category: ActivityCategory | None = None,
    min_cost: Annotated[Decimal | None, Query(ge=0)] = None,
    max_cost: Annotated[Decimal | None, Query(ge=0)] = None,
    max_duration: Annotated[int | None, Query(gt=0)] = None,
    search: Annotated[str | None, Query(max_length=160)] = None,
    sort: ActivitySort = "cost",
) -> ApiResponse[list[ActivityListItem]]:
    activities, total = await catalog_service.list_activities(
        db,
        pagination,
        city_id=city_id,
        category=category,
        min_cost=min_cost,
        max_cost=max_cost,
        max_duration=max_duration,
        search=search,
        sort=sort,
    )
    return ApiResponse(
        data=[ActivityListItem.model_validate(a) for a in activities],
        meta=PageMeta(page=pagination.page, limit=pagination.limit, total=total),
    )


@router.get("/{activity_id}")
async def get_activity(db: DbSession, activity_id: uuid.UUID) -> ApiResponse[ActivityRead]:
    activity = await catalog_service.get_activity(db, activity_id)
    return ApiResponse(data=ActivityRead.model_validate(activity))

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.pagination import Pagination
from app.core.schemas import ApiResponse, PageMeta
from app.deps import DbSession
from app.schemas.catalog import CityListItem, CityRead, CitySort
from app.services import catalog_service

router = APIRouter(prefix="/cities", tags=["catalog"])


@router.get("")
async def list_cities(
    db: DbSession,
    pagination: Pagination,
    search: Annotated[str | None, Query(max_length=120)] = None,
    country: Annotated[str | None, Query(max_length=80)] = None,
    region: Annotated[str | None, Query(max_length=80)] = None,
    max_cost_index: Annotated[int | None, Query(ge=1, le=100)] = None,
    sort: CitySort = "popularity",
) -> ApiResponse[list[CityListItem]]:
    cities, total = await catalog_service.list_cities(
        db,
        pagination,
        search=search,
        country=country,
        region=region,
        max_cost_index=max_cost_index,
        sort=sort,
    )
    return ApiResponse(
        data=[CityListItem.model_validate(c) for c in cities],
        meta=PageMeta(page=pagination.page, limit=pagination.limit, total=total),
    )


# Declared before /{city_id}: otherwise "popular" is parsed as a uuid and 400s.
@router.get("/popular")
async def popular_cities(
    db: DbSession, limit: Annotated[int, Query(ge=1, le=50)] = 8
) -> ApiResponse[list[CityListItem]]:
    cities = await catalog_service.popular_cities(db, limit)
    return ApiResponse(data=[CityListItem.model_validate(c) for c in cities])


@router.get("/{city_id}")
async def get_city(db: DbSession, city_id: uuid.UUID) -> ApiResponse[CityRead]:
    return ApiResponse(data=CityRead.model_validate(await catalog_service.get_city(db, city_id)))

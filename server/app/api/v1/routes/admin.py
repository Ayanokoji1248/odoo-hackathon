import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.pagination import Pagination
from app.core.schemas import ApiResponse, PageMeta
from app.deps import CurrentUser, DbSession, require_admin
from app.models.user import UserRole
from app.schemas.admin import (
    ActivityPatch,
    ActivityWrite,
    AdminActivity,
    AdminCity,
    AdminStats,
    CityPatch,
    CityWrite,
    ManagedUser,
    ManagedUserUpdate,
    TopActivity,
    TopCity,
    UserSort,
)
from app.services import admin_service

# `require_admin` sits on the router, not on each route: a leaf that forgets its
# own check is the failure mode this avoids entirely. Every path below is 403 for
# a signed-in non-admin and 401 for anyone else.
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# --- analytics ----------------------------------------------------------------


@router.get("/stats")
async def stats(db: DbSession) -> ApiResponse[AdminStats]:
    return ApiResponse(data=await admin_service.get_stats(db))


@router.get("/cities/top")
async def top_cities(
    db: DbSession, limit: Annotated[int, Query(ge=1, le=50)] = 5
) -> ApiResponse[list[TopCity]]:
    return ApiResponse(data=await admin_service.top_cities(db, limit))


@router.get("/activities/top")
async def top_activities(
    db: DbSession, limit: Annotated[int, Query(ge=1, le=50)] = 5
) -> ApiResponse[list[TopActivity]]:
    return ApiResponse(data=await admin_service.top_activities(db, limit))


# --- users --------------------------------------------------------------------


def _managed(user, trip_count: int) -> ManagedUser:
    return ManagedUser.model_validate(user).model_copy(update={"trip_count": trip_count})


@router.get("/users")
async def list_users(
    db: DbSession,
    pagination: Pagination,
    search: Annotated[str | None, Query(max_length=160)] = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
    sort: UserSort = "created_at",
) -> ApiResponse[list[ManagedUser]]:
    rows, total = await admin_service.list_users(
        db, pagination, search=search, role=role, is_active=is_active, sort=sort
    )
    return ApiResponse(
        data=[_managed(row["user"], row["trip_count"]) for row in rows],
        meta=PageMeta(page=pagination.page, limit=pagination.limit, total=total),
    )


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID, data: ManagedUserUpdate, db: DbSession, actor: CurrentUser
) -> ApiResponse[ManagedUser]:
    """Role and status only - there is no hard delete. `actor` is passed through so
    the service can refuse to let an admin lock themselves out."""
    user, trip_count = await admin_service.update_user(db, actor, user_id, data)
    return ApiResponse(data=_managed(user, trip_count))


# --- catalog: cities ----------------------------------------------------------


def _city(city, activity_count: int) -> AdminCity:
    return AdminCity.model_validate(city).model_copy(update={"activity_count": activity_count})


@router.get("/cities")
async def list_cities(
    db: DbSession,
    pagination: Pagination,
    search: Annotated[str | None, Query(max_length=160)] = None,
) -> ApiResponse[list[AdminCity]]:
    """Hidden rows included - the public list filters them out, so this is the only
    place a retired city can be found in order to bring it back."""
    rows, total = await admin_service.list_all_cities(db, pagination, search=search)
    return ApiResponse(
        data=[_city(row["city"], row["activity_count"]) for row in rows],
        meta=PageMeta(page=pagination.page, limit=pagination.limit, total=total),
    )


@router.post("/cities", status_code=status.HTTP_201_CREATED)
async def create_city(data: CityWrite, db: DbSession) -> ApiResponse[AdminCity]:
    return ApiResponse(data=_city(await admin_service.create_city(db, data), 0))


@router.patch("/cities/{city_id}")
async def update_city(
    city_id: uuid.UUID, data: CityPatch, db: DbSession
) -> ApiResponse[AdminCity]:
    """`is_active: false` is the delete. Trips snapshot catalog rows, and
    `activities.city_id` is ON DELETE RESTRICT, so a real DELETE would either
    error or orphan someone's saved plan."""
    return ApiResponse(data=_city(await admin_service.update_city(db, city_id, data), 0))


# --- catalog: activities ------------------------------------------------------


@router.get("/activities")
async def list_activities(
    db: DbSession,
    pagination: Pagination,
    search: Annotated[str | None, Query(max_length=160)] = None,
    city_id: uuid.UUID | None = None,
) -> ApiResponse[list[AdminActivity]]:
    rows, total = await admin_service.list_all_activities(
        db, pagination, search=search, city_id=city_id
    )
    return ApiResponse(
        data=[AdminActivity.model_validate(row) for row in rows],
        meta=PageMeta(page=pagination.page, limit=pagination.limit, total=total),
    )


@router.post("/activities", status_code=status.HTTP_201_CREATED)
async def create_activity(data: ActivityWrite, db: DbSession) -> ApiResponse[AdminActivity]:
    activity = await admin_service.create_activity(db, data)
    return ApiResponse(data=AdminActivity.model_validate(activity))


@router.patch("/activities/{activity_id}")
async def update_activity(
    activity_id: uuid.UUID, data: ActivityPatch, db: DbSession
) -> ApiResponse[AdminActivity]:
    activity = await admin_service.update_activity(db, activity_id, data)
    return ApiResponse(data=AdminActivity.model_validate(activity))

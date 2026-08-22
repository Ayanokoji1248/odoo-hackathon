import uuid

from fastapi import APIRouter, status

from app.core.schemas import ApiResponse
from app.deps import CurrentUser, DbSession
from app.schemas.auth import ChangePasswordRequest
from app.schemas.catalog import CityListItem, SaveDestinationRequest
from app.schemas.user import UserRead, UserUpdate
from app.services import auth_service, user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me")
async def update_me(data: UserUpdate, db: DbSession, user: CurrentUser) -> ApiResponse[UserRead]:
    updated = await user_service.update_profile(db, user, data)
    return ApiResponse(data=UserRead.model_validate(updated))


@router.patch("/me/password")
async def change_password(
    data: ChangePasswordRequest, db: DbSession, user: CurrentUser
) -> ApiResponse[dict]:
    await auth_service.change_password(db, user, data.current_password, data.new_password)
    return ApiResponse(data={"message": "Password updated, all sessions signed out"})


@router.delete("/me")
async def delete_me(db: DbSession, user: CurrentUser) -> ApiResponse[dict]:
    await user_service.delete_account(db, user)
    return ApiResponse(data={"deleted": True})


@router.get("/me/saved-destinations", tags=["catalog"])
async def list_saved_destinations(
    db: DbSession, user: CurrentUser
) -> ApiResponse[list[CityListItem]]:
    cities = await user_service.list_saved_destinations(db, user)
    return ApiResponse(data=[CityListItem.model_validate(c) for c in cities])


@router.post("/me/saved-destinations", status_code=status.HTTP_201_CREATED, tags=["catalog"])
async def save_destination(
    data: SaveDestinationRequest, db: DbSession, user: CurrentUser
) -> ApiResponse[CityListItem]:
    city = await user_service.save_destination(db, user, data.city_id)
    return ApiResponse(data=CityListItem.model_validate(city))


@router.delete("/me/saved-destinations/{city_id}", tags=["catalog"])
async def remove_destination(
    city_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ApiResponse[dict]:
    await user_service.remove_destination(db, user, city_id)
    return ApiResponse(data={"removed": True})

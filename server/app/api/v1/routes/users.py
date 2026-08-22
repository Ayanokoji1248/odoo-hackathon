from fastapi import APIRouter

from app.core.schemas import ApiResponse
from app.deps import CurrentUser, DbSession
from app.schemas.auth import ChangePasswordRequest
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

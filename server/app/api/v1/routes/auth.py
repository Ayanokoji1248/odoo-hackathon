import logging

from fastapi import APIRouter, Header, status

from app.core.config import settings
from app.core.schemas import ApiResponse
from app.deps import CurrentUser, DbSession
from app.schemas.auth import (
    AuthResult,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
)
from app.schemas.user import UserRead
from app.services import auth_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

UserAgent = Header(default=None, alias="user-agent")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest, db: DbSession, user_agent: str | None = UserAgent
) -> ApiResponse[AuthResult]:
    user, tokens = await auth_service.register(db, data, user_agent)
    return ApiResponse(data=AuthResult(user=UserRead.model_validate(user), tokens=tokens))


@router.post("/login")
async def login(
    data: LoginRequest, db: DbSession, user_agent: str | None = UserAgent
) -> ApiResponse[AuthResult]:
    user, tokens = await auth_service.login(db, data, user_agent)
    return ApiResponse(data=AuthResult(user=UserRead.model_validate(user), tokens=tokens))


@router.post("/refresh")
async def refresh(
    data: RefreshRequest, db: DbSession, user_agent: str | None = UserAgent
) -> ApiResponse[TokenPair]:
    return ApiResponse(data=await auth_service.refresh(db, data.refresh_token, user_agent))


@router.post("/logout")
async def logout(data: RefreshRequest, db: DbSession, _: CurrentUser) -> ApiResponse[dict]:
    await auth_service.logout(db, data.refresh_token)
    return ApiResponse(data={"revoked": True})


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: DbSession) -> ApiResponse[dict]:
    token = await auth_service.forgot_password(db, data.email)
    # Always the same answer, whether or not the account exists - no enumeration.
    payload: dict = {"message": "If that account exists, a reset link has been sent"}
    if token:
        # ponytail: no mailer wired up. In debug the token comes back in the
        # response; in production it is logged. Swap both for a real send when
        # there is an SMTP/provider credential to send with.
        log.info("password reset token issued for %s", data.email)
        if settings.debug:
            payload["reset_token"] = token
    return ApiResponse(data=payload)


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: DbSession) -> ApiResponse[dict]:
    await auth_service.reset_password(db, data.token, data.new_password)
    return ApiResponse(data={"message": "Password updated"})


@router.get("/me")
async def me(user: CurrentUser) -> ApiResponse[UserRead]:
    return ApiResponse(data=UserRead.model_validate(user))

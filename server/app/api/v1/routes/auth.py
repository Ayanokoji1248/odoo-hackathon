import logging
import uuid

from fastapi import APIRouter, Request, Response, status

from app.core.config import settings
from app.core.cookies import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_access_cookie,
    set_auth_cookies,
)
from app.core.exceptions import ApiError
from app.core.schemas import ApiResponse
from app.deps import CurrentUser, DbSession
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SessionRead,
)
from app.schemas.user import UserRead
from app.services import auth_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return user_agent, ip_address


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest, db: DbSession, request: Request, response: Response
) -> ApiResponse[UserRead]:
    user_agent, ip_address = _client_meta(request)
    tokens = await auth_service.register(db, data, user_agent, ip_address)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return ApiResponse(data=UserRead.model_validate(tokens.user))


@router.post("/login")
async def login(
    data: LoginRequest, db: DbSession, request: Request, response: Response
) -> ApiResponse[UserRead]:
    user_agent, ip_address = _client_meta(request)
    tokens = await auth_service.login(db, data, user_agent, ip_address)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return ApiResponse(data=UserRead.model_validate(tokens.user))


@router.post("/refresh")
async def refresh(request: Request, db: DbSession, response: Response) -> ApiResponse[dict]:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        clear_auth_cookies(response)
        raise ApiError("UNAUTHORIZED", "Not signed in")
    tokens = await auth_service.refresh(db, token)
    if tokens.refresh_token:
        set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    else:
        set_access_cookie(response, tokens.access_token)
    return ApiResponse(data={"refreshed": True})


@router.post("/logout")
async def logout(request: Request, db: DbSession, response: Response) -> ApiResponse[dict]:
    # Deliberately does not require a valid session: the whole point of logging
    # out is that the session may already be gone.
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        await auth_service.logout(db, token)
    clear_auth_cookies(response)
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
async def reset_password(
    data: ResetPasswordRequest, db: DbSession, response: Response
) -> ApiResponse[dict]:
    await auth_service.reset_password(db, data.token, data.new_password)
    # The reset deleted every session, so this browser's cookie is dead too.
    clear_auth_cookies(response)
    return ApiResponse(data={"message": "Password updated"})


@router.get("/me")
async def me(user: CurrentUser) -> ApiResponse[UserRead]:
    return ApiResponse(data=UserRead.model_validate(user))


@router.get("/sessions")
async def sessions(db: DbSession, user: CurrentUser) -> ApiResponse[list[SessionRead]]:
    rows = await auth_service.list_sessions(db, user)
    return ApiResponse(data=[SessionRead.model_validate(row) for row in rows])


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ApiResponse[dict]:
    await auth_service.revoke_session(db, user, session_id)
    return ApiResponse(data={"revoked": True})


@router.delete("/sessions")
async def revoke_all_sessions(
    db: DbSession, user: CurrentUser, response: Response
) -> ApiResponse[dict]:
    await auth_service.revoke_all_sessions(db, user)
    clear_auth_cookies(response)
    return ApiResponse(data={"revoked": True})

import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole

DbSession = Annotated[AsyncSession, Depends(get_db)]

# auto_error=False so a missing header becomes our 401 envelope, not FastAPI's 403.
_bearer = HTTPBearer(auto_error=False, description="Access token from /auth/login")


async def get_current_user(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if creds is None:
        raise ApiError("UNAUTHORIZED", "Missing bearer token")
    payload = decode_access_token(creds.credentials)
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise ApiError("UNAUTHORIZED", "Malformed access token") from None
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise ApiError("UNAUTHORIZED", "Account not found or disabled")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        raise ApiError("FORBIDDEN", "Admin access required")
    return user


AdminUser = Annotated[User, Depends(require_admin)]

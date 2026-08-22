import uuid
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import ACCESS_COOKIE
from app.core.exceptions import ApiError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(request: Request, db: DbSession) -> User:
    raw = request.cookies.get(ACCESS_COOKIE)
    if not raw:
        raise ApiError("UNAUTHORIZED", "Not signed in")
    payload = decode_access_token(raw)
    try:
        user_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except (TypeError, ValueError):
        raise ApiError("UNAUTHORIZED", "Invalid access token") from None
    request.state.session_id = session_id
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise ApiError("UNAUTHORIZED", "Account not found or disabled")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    async def _require_role(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ApiError("FORBIDDEN", "Insufficient role")
        return user

    return _require_role


async def require_admin(user: CurrentUser) -> User:
    return await require_role(UserRole.ADMIN)(user)


AdminUser = Annotated[User, Depends(require_admin)]

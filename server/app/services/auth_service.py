import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ApiError, conflict_from_unique_violation
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    verify_password,
)
from app.models.user import PasswordResetToken, User, UserSession
from app.schemas.auth import LoginRequest, RegisterRequest

log = logging.getLogger(__name__)

BAD_CREDENTIALS = "Invalid email or password"
ROTATION_GRACE_SECONDS = 30


@dataclass(frozen=True)
class AuthTokens:
    user: User
    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class RefreshTokens:
    user: User
    access_token: str
    refresh_token: str | None


def _now() -> datetime:
    return datetime.now(UTC)


async def _new_session(
    db: AsyncSession,
    user: User,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[UserSession, str]:
    """Adds the session row and returns it with the raw refresh token."""
    raw = new_opaque_token()
    row = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw),
        expires_at=_now() + timedelta(days=settings.session_expire_days),
        user_agent=user_agent[:255] if user_agent else None,
        ip_address=ip_address,
    )
    db.add(row)
    await db.flush()
    return row, raw


async def _revoke_all_sessions(db: AsyncSession, user_id) -> None:
    rows = (
        await db.execute(
            select(UserSession).where(
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
            )
        )
    ).scalars()
    now = _now()
    for row in rows:
        row.revoked_at = now


def _access_for(user: User, session: UserSession) -> str:
    return create_access_token(user.id, session.id)


async def _active_user_for_session(db: AsyncSession, session: UserSession) -> User:
    user = await db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise ApiError("UNAUTHORIZED", "Account not found or disabled")
    return user


def _reject_dead_session(session: UserSession) -> None:
    if session.revoked_at is not None or session.expires_at <= _now():
        raise ApiError("UNAUTHORIZED", "Session expired or revoked")


async def register(
    db: AsyncSession,
    data: RegisterRequest,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> AuthTokens:
    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        city=data.city,
        country=data.country,
        additional_info=data.additional_info,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        # The unique indexes are the only race-free duplicate check.
        await db.rollback()
        raise conflict_from_unique_violation(exc, "That account already exists") from None
    session, refresh_token = await _new_session(db, user, user_agent, ip_address)
    access_token = _access_for(user, session)
    await db.commit()
    await db.refresh(user)
    return AuthTokens(user=user, access_token=access_token, refresh_token=refresh_token)


async def login(
    db: AsyncSession,
    data: LoginRequest,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> AuthTokens:
    user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise ApiError("UNAUTHORIZED", BAD_CREDENTIALS)
    if not user.is_active:
        raise ApiError("FORBIDDEN", "This account has been disabled")
    session, refresh_token = await _new_session(db, user, user_agent, ip_address)
    access_token = _access_for(user, session)
    await db.commit()
    return AuthTokens(user=user, access_token=access_token, refresh_token=refresh_token)


async def refresh(db: AsyncSession, raw_token: str) -> RefreshTokens:
    token_hash = hash_token(raw_token)
    session = (
        await db.execute(
            select(UserSession)
            .where(UserSession.refresh_token_hash == token_hash)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if session is not None:
        _reject_dead_session(session)
        user = await _active_user_for_session(db, session)
        new_refresh = new_opaque_token()
        session.prev_refresh_token_hash = session.refresh_token_hash
        session.refresh_token_hash = hash_token(new_refresh)
        session.rotated_at = _now()
        session.last_used_at = _now()
        access_token = _access_for(user, session)
        await db.commit()
        return RefreshTokens(user=user, access_token=access_token, refresh_token=new_refresh)

    session = (
        await db.execute(
            select(UserSession)
            .where(UserSession.prev_refresh_token_hash == token_hash)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if session is None:
        raise ApiError("UNAUTHORIZED", "Session expired or revoked")

    _reject_dead_session(session)
    if (
        session.rotated_at is not None
        and (_now() - session.rotated_at).total_seconds() <= ROTATION_GRACE_SECONDS
    ):
        user = await _active_user_for_session(db, session)
        session.last_used_at = _now()
        access_token = _access_for(user, session)
        await db.commit()
        return RefreshTokens(user=user, access_token=access_token, refresh_token=None)

    session.revoked_at = _now()
    await db.commit()
    raise ApiError("UNAUTHORIZED", "Refresh token reuse detected")


async def logout(db: AsyncSession, raw_token: str) -> None:
    # Idempotent on purpose - logging out twice is not an error worth surfacing.
    token_hash = hash_token(raw_token)
    row = (
        await db.execute(
            select(UserSession).where(
                or_(
                    UserSession.refresh_token_hash == token_hash,
                    UserSession.prev_refresh_token_hash == token_hash,
                )
            )
        )
    ).scalar_one_or_none()
    if row is not None and row.revoked_at is None:
        row.revoked_at = _now()
    await db.commit()


async def list_sessions(db: AsyncSession, user: User) -> list[UserSession]:
    return (
        await db.execute(
            select(UserSession)
            .where(
                UserSession.user_id == user.id,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > _now(),
            )
            .order_by(UserSession.created_at.desc())
        )
    ).scalars().all()


async def revoke_session(db: AsyncSession, user: User, session_id) -> None:
    row = (
        await db.execute(
            select(UserSession).where(
                UserSession.id == session_id,
                UserSession.user_id == user.id,
                UserSession.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise ApiError("NOT_FOUND", "Session not found")
    row.revoked_at = _now()
    await db.commit()


async def revoke_all_sessions(db: AsyncSession, user: User) -> None:
    await _revoke_all_sessions(db, user.id)
    await db.commit()


async def forgot_password(db: AsyncSession, email: str) -> str | None:
    """Returns the raw token, or None if no such account. The route always answers 200."""
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    raw = new_opaque_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=_now() + timedelta(minutes=settings.reset_token_expire_minutes),
        )
    )
    await db.commit()
    return raw


async def reset_password(db: AsyncSession, raw_token: str, new_password: str) -> None:
    row = (
        await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == hash_token(raw_token)
            )
        )
    ).scalar_one_or_none()
    if row is None or row.used_at is not None or row.expires_at <= _now():
        raise ApiError("VALIDATION_ERROR", "Invalid or expired reset token")

    user = await db.get(User, row.user_id)
    if user is None:
        raise ApiError("VALIDATION_ERROR", "Invalid or expired reset token")

    user.password_hash = hash_password(new_password)
    row.used_at = _now()
    await _revoke_all_sessions(db, user.id)  # a reset kicks every session
    await db.commit()


async def change_password(db: AsyncSession, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise ApiError("UNAUTHORIZED", "Current password is incorrect")
    user.password_hash = hash_password(new)
    await _revoke_all_sessions(db, user.id)
    await db.commit()

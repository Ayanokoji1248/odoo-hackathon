import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ApiError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    verify_password,
)
from app.models.user import PasswordResetToken, RefreshToken, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair

log = logging.getLogger(__name__)

BAD_CREDENTIALS = "Invalid email or password"


async def _issue_tokens(db: AsyncSession, user: User, user_agent: str | None) -> TokenPair:
    raw = new_opaque_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=raw,
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def _revoke_all_refresh_tokens(db: AsyncSession, user_id) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def register(
    db: AsyncSession, data: RegisterRequest, user_agent: str | None
) -> tuple[User, TokenPair]:
    user = User(name=data.name, email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        # The unique index is the only race-free duplicate check.
        await db.rollback()
        raise ApiError("CONFLICT", "An account with that email already exists") from None
    tokens = await _issue_tokens(db, user, user_agent)
    await db.commit()
    await db.refresh(user)
    return user, tokens


async def login(
    db: AsyncSession, data: LoginRequest, user_agent: str | None
) -> tuple[User, TokenPair]:
    user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise ApiError("UNAUTHORIZED", BAD_CREDENTIALS)
    if not user.is_active:
        raise ApiError("FORBIDDEN", "This account has been disabled")
    tokens = await _issue_tokens(db, user, user_agent)
    await db.commit()
    return user, tokens


async def refresh(db: AsyncSession, raw_token: str, user_agent: str | None) -> TokenPair:
    row = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
        )
    ).scalar_one_or_none()
    if row is None or not row.is_usable:
        raise ApiError("UNAUTHORIZED", "Invalid or expired refresh token")

    user = await db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise ApiError("UNAUTHORIZED", "Invalid or expired refresh token")

    row.revoked_at = datetime.now(UTC)  # rotation: one refresh token, one use
    tokens = await _issue_tokens(db, user, user_agent)
    await db.commit()
    return tokens


async def logout(db: AsyncSession, raw_token: str) -> None:
    # Idempotent on purpose - logging out twice is not an error worth surfacing.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw_token), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
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
            expires_at=datetime.now(UTC)
            + timedelta(minutes=settings.reset_token_expire_minutes),
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
    if row is None or row.used_at is not None or row.expires_at <= datetime.now(UTC):
        raise ApiError("VALIDATION_ERROR", "Invalid or expired reset token")

    user = await db.get(User, row.user_id)
    if user is None:
        raise ApiError("VALIDATION_ERROR", "Invalid or expired reset token")

    user.password_hash = hash_password(new_password)
    row.used_at = datetime.now(UTC)
    await _revoke_all_refresh_tokens(db, user.id)  # a reset kicks every session
    await db.commit()


async def change_password(db: AsyncSession, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise ApiError("UNAUTHORIZED", "Current password is incorrect")
    user.password_hash = hash_password(new)
    await _revoke_all_refresh_tokens(db, user.id)
    await db.commit()

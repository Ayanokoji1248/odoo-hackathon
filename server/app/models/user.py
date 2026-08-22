import enum
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import CITEXT, INET, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class UserRole(enum.StrEnum):
    USER = "USER"
    ADMIN = "ADMIN"


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"

    first_name: Mapped[str] = mapped_column(String(60), nullable=False)
    last_name: Mapped[str] = mapped_column(String(60), nullable=False)
    # citext: case-insensitive uniqueness enforced by the DB, not by lower() calls
    # sprinkled through the service layer.
    email: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True)
    # Unique, so one phone means one account. Stored normalised to digits (with an
    # optional leading +) by the schema validator - without that, "+91 98765 43210"
    # and "+919876543210" are different strings and the constraint is fiction.
    phone: Mapped[str | None] = mapped_column(String(32), unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text)

    # Where the traveller is based. Free text, not a FK to `cities`: that table is
    # a curated catalogue of 54 destinations, and a user's home town usually is
    # not one of them.
    city: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(120))
    additional_info: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="en", default="en"
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        server_default=UserRole.USER.value,
        default=UserRole.USER,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true"), default=True
    )

    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def name(self) -> str:
        """Display name. Kept so `UserRead` can still expose a single `name` and
        the frontend's `User.name` keeps working now that the column is split."""
        return f"{self.first_name} {self.last_name}".strip()


class UserSession(UUIDPkMixin, TimestampMixin, Base):
    """One logged-in device. `id` is stable for the life of the session even
    though the refresh token underneath it rotates every ~15 minutes - it is the
    thing the user sees in a session list and the thing they revoke.

    Only hashes of the refresh tokens are stored. The browser holds the raw
    values in httpOnly cookies; a leaked DB dump yields nothing usable.
    """

    __tablename__ = "sessions"

    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # sha256 hex of the refresh token currently in the browser's cookie.
    refresh_token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # The one it replaced. Kept so that requests which raced the rotation - four
    # parallel 401s from one page load all calling /auth/refresh - are recognised
    # as concurrency rather than as token theft. See ROTATION_GRACE_SECONDS.
    prev_refresh_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Absolute cap, fixed at login. Rotation does not extend it.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # A flag rather than a DELETE: a revoked row is what lets /auth/refresh tell
    # "session I deliberately killed" apart from "token I have never seen", and
    # that distinction is the whole theft signal.
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Shown in the session list so a user can tell which row is which device.
    # ponytail: raw User-Agent string, no parsing library. "Mozilla/5.0 (...)"
    # is ugly but recognisable, and a UA parser is a dependency plus a lookup
    # table that goes stale.
    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(INET)

    user: Mapped[User] = relationship(back_populates="sessions")

    @property
    def is_live(self) -> bool:
        return self.revoked_at is None and self.expires_at > datetime.now(UTC)


class PasswordResetToken(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "password_reset_tokens"

    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

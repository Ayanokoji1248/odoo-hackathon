import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
import jwt

from app.core.config import settings
from app.core.exceptions import ApiError

BCRYPT_MAX_BYTES = 72
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    # ponytail: bcrypt hard-errors past 72 bytes. Schemas cap the length, this
    # truncation is the belt to that braces.
    return bcrypt.hashpw(password.encode()[:BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:BCRYPT_MAX_BYTES], password_hash.encode())
    except ValueError:
        return False  # malformed hash in the row - treat as a failed login, not a 500


def new_opaque_token() -> str:
    """Session / reset tokens. Random and meaningless on their own, so the only
    way to validate one is to look it up - which is what makes it revocable."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    # ponytail: sha256, not bcrypt. These tokens are 256 bits of entropy already;
    # bcrypt's work factor exists to slow guessing of low-entropy passwords.
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: UUID, session_id: UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise ApiError("UNAUTHORIZED", "Access token expired") from None
    except jwt.InvalidTokenError:
        raise ApiError("UNAUTHORIZED", "Invalid access token") from None
    if not payload.get("sub") or not payload.get("sid"):
        raise ApiError("UNAUTHORIZED", "Invalid access token")
    return payload

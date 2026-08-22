import uuid
from datetime import datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    IPvAnyAddress,
    field_serializer,
    field_validator,
)

# bcrypt hard-caps at 72 bytes; cap here so the error is a 400, not a 500.
Password = Annotated[str, Field(min_length=8, max_length=72)]

PersonName = Annotated[str, Field(min_length=1, max_length=60)]
Place = Annotated[str, Field(max_length=120)]

_PHONE_JUNK = str.maketrans("", "", " -()._")


def normalize_phone(value: str | None) -> str | None:
    """`+91 98765 43210` -> `+919876543210`.

    `users.phone` is UNIQUE, so this is not cosmetic: without collapsing the
    formatting the same number inserts as several distinct rows and the
    constraint enforces nothing. Blank input becomes NULL, because '' would
    collide with every other blank on a unique index.
    """
    if value is None:
        return None
    cleaned = value.strip().translate(_PHONE_JUNK)
    if not cleaned:
        return None
    digits = cleaned[1:] if cleaned.startswith("+") else cleaned
    if not digits.isdigit() or not 7 <= len(digits) <= 20:
        raise ValueError("Enter a phone number as 7-20 digits, optionally starting with +")
    return cleaned


def _blank_to_none(value: str | None) -> str | None:
    """An omitted optional field and an empty form input mean the same thing.
    HTML forms always submit a value, so without this every skipped field is
    stored as ''."""
    if value is None:
        return None
    return value.strip() or None


class RegisterRequest(BaseModel):
    first_name: PersonName
    last_name: PersonName
    email: EmailStr
    password: Password
    phone: Annotated[str, Field(max_length=32)] | None = None
    city: Place | None = None
    country: Place | None = None
    additional_info: Annotated[str, Field(max_length=2000)] | None = None

    _normalize_phone = field_validator("phone")(normalize_phone)
    _blank_fields = field_validator("city", "country", "additional_info")(_blank_to_none)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: Password


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: Password


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_agent: str | None
    ip_address: IPvAnyAddress | None
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime

    @field_serializer("ip_address", when_used="json")
    def _serialize_ip(self, value):
        return str(value) if value is not None else None

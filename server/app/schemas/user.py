import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole
from app.schemas.auth import Place, _blank_to_none, normalize_phone


class UserRead(BaseModel):
    """password_hash is structurally absent - it cannot leak from here."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    # Derived from first + last by `User.name`, not a column. Kept in the payload
    # so the frontend's `User.name` keeps working after the column was split.
    name: str
    email: str
    phone: str | None
    avatar_url: str | None
    city: str | None
    country: str | None
    additional_info: str | None
    language: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    """Every field optional: PATCH semantics, only what is sent gets written.

    The registration fields are editable here too - a value you can set once at
    signup and never correct afterwards is a hole, not a feature.
    """

    first_name: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    last_name: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    phone: Annotated[str, Field(max_length=32)] | None = None
    city: Place | None = None
    country: Place | None = None
    additional_info: Annotated[str, Field(max_length=2000)] | None = None
    avatar_url: str | None = None
    language: Annotated[str, Field(min_length=2, max_length=10)] | None = None

    _normalize_phone = field_validator("phone")(normalize_phone)
    _blank_fields = field_validator("city", "country", "additional_info")(_blank_to_none)

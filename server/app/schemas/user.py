import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class UserRead(BaseModel):
    """password_hash is structurally absent - it cannot leak from here."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None
    language: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    avatar_url: str | None = None
    language: Annotated[str, Field(min_length=2, max_length=10)] | None = None

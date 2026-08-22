"""Every model must be imported here or Alembic autogenerate won't see it."""

from app.models.catalog import Activity, ActivityCategory, City, SavedDestination
from app.models.user import PasswordResetToken, RefreshToken, User, UserRole

__all__ = [
    "Activity",
    "ActivityCategory",
    "City",
    "PasswordResetToken",
    "RefreshToken",
    "SavedDestination",
    "User",
    "UserRole",
]

"""Every model must be imported here or Alembic autogenerate won't see it."""

from app.models.catalog import Activity, ActivityCategory, City, SavedDestination
from app.models.user import PasswordResetToken, User, UserRole, UserSession

__all__ = [
    "Activity",
    "ActivityCategory",
    "City",
    "PasswordResetToken",
    "SavedDestination",
    "User",
    "UserRole",
    "UserSession",
]

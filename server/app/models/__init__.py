"""Every model must be imported here or Alembic autogenerate won't see it."""

from app.models.budget import BudgetCategory, BudgetItem, budget_category_enum
from app.models.catalog import (
    Activity,
    ActivityCategory,
    City,
    SavedDestination,
    activity_category_enum,
)
from app.models.trip import Trip, TripActivity, TripStop
from app.models.user import PasswordResetToken, User, UserRole, UserSession

__all__ = [
    "Activity",
    "BudgetCategory",
    "BudgetItem",
    "ActivityCategory",
    "City",
    "PasswordResetToken",
    "SavedDestination",
    "Trip",
    "TripActivity",
    "TripStop",
    "User",
    "UserRole",
    "UserSession",
    "activity_category_enum",
    "budget_category_enum",
]

import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.models.trip import TripStop


class BudgetCategory(enum.StrEnum):
    """Costs that are not activities. Adding a value needs an ALTER TYPE migration."""

    TRANSPORT = "TRANSPORT"
    ACCOMMODATION = "ACCOMMODATION"
    MEALS = "MEALS"
    ACTIVITIES = "ACTIVITIES"
    MISC = "MISC"


budget_category_enum = ENUM(BudgetCategory, name="budget_category", create_type=True)


class BudgetItem(UUIDPkMixin, TimestampMixin, Base):
    """A manual cost line: flights, a hotel, a dinner - anything the itinerary
    itself does not already price."""

    __tablename__ = "budget_items"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    # Optional attribution to a city. SET NULL, not CASCADE: deleting a stop must
    # not silently delete the flight you booked to get there.
    trip_stop_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip_stops.id", ondelete="SET NULL")
    )
    category: Mapped[BudgetCategory] = mapped_column(budget_category_enum, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # NULL means "somewhere on this trip, no particular day" - it still counts
    # towards the total, but it cannot appear in the per-day series.
    incurred_on: Mapped[date | None] = mapped_column(Date)

    stop: Mapped[TripStop | None] = relationship(lazy="raise")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="amount_non_negative"),
        Index("ix_budget_items_trip_id_incurred_on", "trip_id", "incurred_on"),
    )

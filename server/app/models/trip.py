import uuid
from datetime import date, time
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.models.catalog import ActivityCategory, City, activity_category_enum

TRIP_STATUSES = ("upcoming", "ongoing", "past")


class Trip(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "trips"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    cover_photo_url: Mapped[str | None] = mapped_column(Text)
    travelers: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default=text("1"), default=1
    )
    # Trip-level currency: there is no FX in v1, so one currency per trip is the
    # only way the budget totals can be summed honestly.
    currency: Mapped[str] = mapped_column(
        CHAR(3), nullable=False, server_default="USD", default="USD"
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"), default=False
    )
    share_slug: Mapped[str | None] = mapped_column(String(16), unique=True)
    # Provenance for "copy this trip". SET NULL so deleting the original does not
    # take the copies with it.
    copied_from_trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL")
    )

    stops: Mapped[list["TripStop"]] = relationship(
        back_populates="trip",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TripStop.order_index",
    )

    @property
    def status(self) -> str:
        """Derived, never stored - a stored value would go stale overnight."""
        today = date.today()
        if self.end_date < today:
            return "past"
        if self.start_date > today:
            return "upcoming"
        return "ongoing"

    @property
    def duration_days(self) -> int:
        return (self.end_date - self.start_date).days + 1

    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="dates_ordered"),
        CheckConstraint("travelers >= 1", name="travelers_positive"),
        Index("ix_trips_user_id_start_date_desc", "user_id", text("start_date DESC")),
        # Partial: the only lookup by slug is the public one, and only public
        # trips are reachable that way.
        Index(
            "ix_trips_share_slug_public",
            "share_slug",
            postgresql_where=text("is_public"),
        ),
    )


class TripStop(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "trip_stops"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cities.id", ondelete="RESTRICT"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    trip: Mapped[Trip] = relationship(back_populates="stops")
    city: Mapped[City] = relationship(lazy="raise")
    activities: Mapped[list["TripActivity"]] = relationship(
        back_populates="stop",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="(TripActivity.scheduled_date, TripActivity.order_index)",
    )

    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="dates_ordered"),
        # DEFERRABLE so a reorder can rewrite every row inside one transaction
        # without tripping the constraint halfway through. Without it you need a
        # two-pass "shift everything negative first" hack.
        UniqueConstraint(
            "trip_id", "order_index", deferrable=True, initially="DEFERRED"
        ),
        Index("ix_trip_stops_trip_id_order_index", "trip_id", "order_index"),
    )


class TripActivity(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "trip_activities"

    trip_stop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip_stops.id", ondelete="CASCADE"), nullable=False
    )
    # NULL means a custom activity the user typed in. SET NULL on delete so
    # retiring a catalog row never blanks out somebody's saved itinerary.
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="SET NULL")
    )
    # name, category and cost are SNAPSHOTS taken when the activity was added.
    # An admin editing a seeded price must never silently change a saved budget.
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[ActivityCategory | None] = mapped_column(activity_category_enum)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, server_default=text("0"), default=Decimal("0")
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    stop: Mapped[TripStop] = relationship(back_populates="activities")

    __table_args__ = (
        CheckConstraint("cost >= 0", name="cost_non_negative"),
        CheckConstraint("duration_minutes > 0", name="duration_minutes_positive"),
        Index(
            "ix_trip_activities_stop_date_order",
            "trip_stop_id",
            "scheduled_date",
            "order_index",
        ),
    )

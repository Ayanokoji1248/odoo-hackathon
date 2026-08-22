import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class ActivityCategory(enum.StrEnum):
    """Native Postgres enum. Adding a value later needs an explicit ALTER TYPE
    migration, so the full list is decided here."""

    SIGHTSEEING = "SIGHTSEEING"
    FOOD = "FOOD"
    ADVENTURE = "ADVENTURE"
    CULTURE = "CULTURE"
    NIGHTLIFE = "NIGHTLIFE"
    SHOPPING = "SHOPPING"
    RELAXATION = "RELAXATION"
    TRANSPORT = "TRANSPORT"


# One shared type object, referenced by both `activities.category` and
# `trip_activities.category`. Two separate Enum() calls with the same name race
# on CREATE TYPE, because metadata.create_all has no ordering guarantee between
# the two tables.
activity_category_enum = ENUM(ActivityCategory, name="activity_category", create_type=True)


class City(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "cities"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    country: Mapped[str] = mapped_column(String(80), nullable=False)
    region: Mapped[str | None] = mapped_column(String(80))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    cost_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    popularity_score: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0"), default=0
    )
    image_url: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    # Display metadata the explore UI renders. tags is a real array rather than a
    # join table: it is a short, unordered label list that is only ever read whole.
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(40)), nullable=False, server_default=text("'{}'"), default=list
    )
    best_season: Mapped[str | None] = mapped_column(String(40))
    # A per-person daily estimate in the catalog currency, seeded from cost_index.
    # Stored rather than derived so an admin can override a bad guess.
    avg_daily_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    # Soft delete: admin catalog management flips this instead of deleting rows
    # that saved trips still reference.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true"), default=True
    )

    activities: Mapped[list["Activity"]] = relationship(back_populates="city")

    __table_args__ = (
        UniqueConstraint("name", "country"),
        CheckConstraint("cost_index BETWEEN 1 AND 100", name="cost_index_range"),
        Index("ix_cities_country", "country"),
        Index("ix_cities_popularity_score_desc", text("popularity_score DESC")),
        # Trigram index so `name ILIKE '%par%'` stays fast instead of table-scanning.
        Index(
            "ix_cities_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )


class Activity(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "activities"

    # RESTRICT, not CASCADE: deleting a city out from under a catalog of
    # activities (and the trips that snapshot them) should be a hard error.
    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cities.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[ActivityCategory] = mapped_column(activity_category_enum, nullable=False)
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    image_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true"), default=True
    )

    # lazy="raise" so a forgotten joinedload fails loudly here instead of
    # surfacing as MissingGreenlet during response serialization.
    city: Mapped[City] = relationship(back_populates="activities", lazy="raise")

    @property
    def city_name(self) -> str:
        """Requires the caller to have joined City - see catalog_service."""
        return self.city.name

    __table_args__ = (
        # Natural key - also what makes the seed script idempotent.
        UniqueConstraint("city_id", "name"),
        CheckConstraint("estimated_cost >= 0", name="estimated_cost_non_negative"),
        CheckConstraint("duration_minutes > 0", name="duration_minutes_positive"),
        Index("ix_activities_city_id_category", "city_id", "category"),
        Index("ix_activities_estimated_cost", "estimated_cost"),
        Index(
            "ix_activities_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )


class SavedDestination(Base):
    __tablename__ = "saved_destinations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    city: Mapped[City] = relationship(lazy="raise")

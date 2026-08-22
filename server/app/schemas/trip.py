import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.catalog import ActivityCategory
from app.schemas.catalog import CityListItem

TripStatus = Literal["upcoming", "ongoing", "past"]
TripSort = Literal["start_date", "created_at", "name"]

Name = Annotated[str, Field(min_length=1, max_length=160)]
Currency = Annotated[str, Field(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")]


class _DateRange(BaseModel):
    """Mirrors the DB CHECK, so a bad range is a 400 and not a 500 from Postgres."""

    @model_validator(mode="after")
    def _end_not_before_start(self) -> Self:
        start, end = getattr(self, "start_date", None), getattr(self, "end_date", None)
        if start and end and end < start:
            raise ValueError("end_date must not be before start_date")
        return self


# --- trips --------------------------------------------------------------------


class TripCreate(_DateRange):
    name: Name
    description: str | None = None
    start_date: date
    end_date: date
    cover_photo_url: str | None = None
    travelers: Annotated[int, Field(ge=1, le=99)] = 1
    currency: Currency = "USD"


class TripUpdate(_DateRange):
    name: Name | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    cover_photo_url: str | None = None
    travelers: Annotated[int, Field(ge=1, le=99)] | None = None
    currency: Currency | None = None


class TripDuplicate(BaseModel):
    """Dates are rebased to `start_date`, preserving every relative offset."""

    name: Name | None = None
    start_date: date | None = None


class TripListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    start_date: date
    end_date: date
    cover_photo_url: str | None
    travelers: int
    currency: str
    is_public: bool
    share_slug: str | None
    copied_from_trip_id: uuid.UUID | None
    # Both derived from the dates on read - see Trip.status.
    status: TripStatus
    duration_days: int
    created_at: datetime

    # Filled by trip_service.attach_totals for list-shaped responses. Defaulted
    # rather than required so single-trip responses stay valid without paying for
    # an aggregate nobody asked for.
    activity_count: int = 0
    estimated_total: Decimal = Decimal("0.00")
    stop_count: int = 0
    # Ordered city names, so a trip card can render "Paris -> Rome -> Barcelona"
    # without fetching every trip's full stop list.
    city_names: list[str] = []


# --- trip activities ----------------------------------------------------------


class TripActivityCreate(BaseModel):
    """Either reference a catalog activity, or supply a name for a custom one."""

    activity_id: uuid.UUID | None = None
    name: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    category: ActivityCategory | None = None
    scheduled_date: date
    start_time: time | None = None
    duration_minutes: Annotated[int, Field(gt=0)] | None = None
    # Omitted with an activity_id means "use the catalog price".
    cost: Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)] | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _needs_a_source(self) -> Self:
        if self.activity_id is None and not self.name:
            raise ValueError("supply either activity_id or name")
        return self


class TripActivityUpdate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    category: ActivityCategory | None = None
    scheduled_date: date | None = None
    start_time: time | None = None
    duration_minutes: Annotated[int, Field(gt=0)] | None = None
    cost: Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)] | None = None
    notes: str | None = None


class TripActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trip_stop_id: uuid.UUID
    # NULL once the catalog row is retired; the snapshot below still stands.
    activity_id: uuid.UUID | None
    name: str
    category: ActivityCategory | None
    scheduled_date: date
    start_time: time | None
    duration_minutes: int | None
    cost: Decimal
    order_index: int
    notes: str | None


# --- stops --------------------------------------------------------------------


class TripStopCreate(_DateRange):
    city_id: uuid.UUID
    start_date: date
    end_date: date
    notes: str | None = None


class TripStopUpdate(_DateRange):
    city_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class TripStopRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trip_id: uuid.UUID
    city_id: uuid.UUID
    city: CityListItem
    start_date: date
    end_date: date
    order_index: int
    notes: str | None
    activities: list[TripActivityRead] = []


class TripStopWritten(BaseModel):
    """A stop plus any non-blocking advice about it (overlaps, mostly)."""

    stop: TripStopRead
    warnings: list[str] = []


class TripRead(TripListItem):
    stops: list[TripStopRead] = []


# --- sharing ------------------------------------------------------------------


class ShareState(BaseModel):
    """What the owner needs to render a share control: the flag and the slug. The
    full URL is the frontend's business - it knows its own origin."""

    is_public: bool
    share_slug: str | None


class PublicTripRead(TripRead):
    """The public payload. Inherits the itinerary and deliberately adds only the
    owner's *display name* - no email, phone, city or user id anywhere in here.

    `TripRead` carries no user_id, so there is nothing to strip.
    """

    owner_name: str
    copy_count: int


# --- reordering ---------------------------------------------------------------


class ReorderRequest(BaseModel):
    """The full ordered id list. A partial list is rejected, because silently
    appending the omitted rows is worse than making the client be explicit."""

    order: Annotated[list[uuid.UUID], Field(min_length=1)]

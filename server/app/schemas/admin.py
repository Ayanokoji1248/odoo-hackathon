import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.catalog import ActivityCategory
from app.models.user import UserRole

Amount = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]
CostIndex = Annotated[int, Field(ge=1, le=100)]
Popularity = Annotated[int, Field(ge=0, le=100)]

UserSort = Literal["created_at", "name", "trips"]


# --- analytics ----------------------------------------------------------------


class MonthPoint(BaseModel):
    """`month` is the first day of the month, so the client can sort and format
    it without parsing a label."""

    month: date
    count: int


class AdminStats(BaseModel):
    users_total: int
    users_active: int
    admins_total: int
    trips_total: int
    cities_total: int
    cities_hidden: int
    activities_total: int
    activities_hidden: int

    avg_stops_per_trip: Decimal
    avg_trip_budget: Decimal
    # The currency every catalog price is in - there is no FX in v1, so a mixed
    # average would be meaningless without saying which unit it is in.
    currency: str

    # Newest first is wrong for a chart, so these come oldest-first.
    new_users_by_month: list[MonthPoint]
    new_trips_by_month: list[MonthPoint]


class TopCity(BaseModel):
    city_id: uuid.UUID
    name: str
    country: str
    # How many trip stops reference it - i.e. how often it was actually planned,
    # not the editorial `popularity_score`.
    trip_count: int


class TopActivity(BaseModel):
    activity_id: uuid.UUID
    name: str
    city_name: str
    add_count: int


# --- users --------------------------------------------------------------------


class ManagedUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    trip_count: int = 0


class ManagedUserUpdate(BaseModel):
    """Role and status only. There is no hard delete: a user row owns trips,
    stops, activities and budget items, and `is_active=false` already stops every
    request at `get_current_user`."""

    role: UserRole | None = None
    is_active: bool | None = None


# --- catalog ------------------------------------------------------------------


class CityWrite(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    country: Annotated[str, Field(min_length=1, max_length=80)]
    region: Annotated[str, Field(max_length=80)] | None = None
    cost_index: CostIndex
    popularity_score: Popularity = 0
    image_url: str | None = None
    description: str | None = None
    tags: list[Annotated[str, Field(max_length=40)]] = []
    best_season: Annotated[str, Field(max_length=40)] | None = None
    avg_daily_cost: Amount | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class CityPatch(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    country: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    region: Annotated[str, Field(max_length=80)] | None = None
    cost_index: CostIndex | None = None
    popularity_score: Popularity | None = None
    image_url: str | None = None
    description: str | None = None
    tags: list[Annotated[str, Field(max_length=40)]] | None = None
    best_season: Annotated[str, Field(max_length=40)] | None = None
    avg_daily_cost: Amount | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    # The soft delete. Never a DELETE: saved trips snapshot these rows.
    is_active: bool | None = None


class ActivityWrite(BaseModel):
    city_id: uuid.UUID
    name: Annotated[str, Field(min_length=1, max_length=160)]
    category: ActivityCategory
    estimated_cost: Amount
    currency: Annotated[str, Field(min_length=3, max_length=3)] = "USD"
    duration_minutes: Annotated[int, Field(gt=0)] | None = None
    image_url: str | None = None
    description: str | None = None


class ActivityPatch(BaseModel):
    city_id: uuid.UUID | None = None
    name: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    category: ActivityCategory | None = None
    estimated_cost: Amount | None = None
    currency: Annotated[str, Field(min_length=3, max_length=3)] | None = None
    duration_minutes: Annotated[int, Field(gt=0)] | None = None
    image_url: str | None = None
    description: str | None = None
    is_active: bool | None = None


class AdminCity(BaseModel):
    """Like `CityRead`, but carries `is_active` - the admin list is the only place
    hidden rows are visible at all."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    country: str
    region: str | None
    cost_index: int
    popularity_score: int
    image_url: str | None
    description: str | None
    tags: list[str]
    best_season: str | None
    avg_daily_cost: Decimal | None
    latitude: Decimal | None
    longitude: Decimal | None
    is_active: bool
    activity_count: int = 0


class AdminActivity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    city_id: uuid.UUID
    city_name: str
    name: str
    category: ActivityCategory
    estimated_cost: Decimal
    currency: str
    duration_minutes: int | None
    image_url: str | None
    description: str | None
    is_active: bool

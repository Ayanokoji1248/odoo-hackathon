import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.budget import BudgetCategory
from app.schemas.catalog import CityListItem
from app.schemas.trip import TripListItem

Amount = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]


class BudgetItemCreate(BaseModel):
    category: BudgetCategory
    label: Annotated[str, Field(min_length=1, max_length=160)]
    amount: Amount
    # Optional: without a date it still counts in the total but cannot be placed
    # on the per-day chart. Without a stop it cannot be attributed to a city.
    incurred_on: date | None = None
    trip_stop_id: uuid.UUID | None = None


class BudgetItemUpdate(BaseModel):
    category: BudgetCategory | None = None
    label: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    amount: Amount | None = None
    incurred_on: date | None = None
    trip_stop_id: uuid.UUID | None = None


class BudgetItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trip_id: uuid.UUID
    trip_stop_id: uuid.UUID | None
    category: BudgetCategory
    label: str
    amount: Decimal
    incurred_on: date | None


class CategoryTotal(BaseModel):
    category: str
    amount: Decimal


class DayTotal(BaseModel):
    day: date
    amount: Decimal
    over_budget: bool


class CityTotal(BaseModel):
    city_id: uuid.UUID
    city_name: str
    amount: Decimal


class BudgetSummary(BaseModel):
    currency: str
    travelers: int
    days: int

    # Activity costs are per person and already multiplied by `travelers`.
    # Manual items are taken as entered - a hotel room is not per person.
    activities_total: Decimal
    manual_total: Decimal
    grand_total: Decimal

    avg_per_day: Decimal
    over_budget_threshold: Decimal

    by_category: list[CategoryTotal]
    by_activity_category: list[CategoryTotal]
    by_day: list[DayTotal]
    by_city: list[CityTotal]

    # Money that could not be placed. `by_day` and `by_city` each fall short of
    # grand_total by exactly these amounts, which is why they are reported.
    undated_total: Decimal
    unassigned_total: Decimal


class TripBudgetHighlight(BaseModel):
    trip: TripListItem
    grand_total: Decimal
    avg_per_day: Decimal
    currency: str


class TripCounts(BaseModel):
    total: int
    upcoming: int
    ongoing: int
    past: int


class Dashboard(BaseModel):
    """One payload for the whole home screen, so it does not fan out into six calls."""

    counts: TripCounts
    upcoming_trips: list[TripListItem]
    popular_cities: list[CityListItem]
    budget_highlight: TripBudgetHighlight | None

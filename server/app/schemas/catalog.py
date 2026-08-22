import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.catalog import ActivityCategory

CitySort = Literal["popularity", "name", "cost_index"]
ActivitySort = Literal["cost", "duration", "name"]


class CityListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    country: str
    region: str | None
    cost_index: int
    popularity_score: int
    image_url: str | None


class CityRead(CityListItem):
    latitude: Decimal | None
    longitude: Decimal | None
    description: str | None


class ActivityListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    city_id: uuid.UUID
    name: str
    category: ActivityCategory
    # Decimal serializes to a JSON string, which is exactly what we want -
    # money must not round-trip through a float.
    estimated_cost: Decimal
    currency: str
    duration_minutes: int | None
    image_url: str | None


class ActivityRead(ActivityListItem):
    description: str | None


class SaveDestinationRequest(BaseModel):
    city_id: uuid.UUID

from typing import Annotated

from fastapi import APIRouter, Path, status

from app.core.schemas import ApiResponse
from app.deps import CurrentUser, DbSession, OwnedTrip
from app.schemas.budget import BudgetSummary
from app.schemas.trip import (
    PublicTripRead,
    ShareState,
    TripDuplicate,
    TripRead,
)
from app.services import budget_service, trip_service

# Two routers: one nested under the owner's trip (authorized by `get_owned_trip`),
# one genuinely public. Keeping them apart means the public paths cannot pick up an
# auth dependency by accident.
router = APIRouter(prefix="/trips/{trip_id}/share", tags=["sharing"])
public_router = APIRouter(prefix="/public/trips", tags=["sharing"])

Slug = Annotated[str, Path(min_length=8, max_length=16)]


@router.post("")
async def share_trip(db: DbSession, trip: OwnedTrip) -> ApiResponse[ShareState]:
    """Idempotent - calling it again returns the same slug, so a link already sent
    to somebody keeps working."""
    updated = await trip_service.share_trip(db, trip)
    return ApiResponse(
        data=ShareState(is_public=updated.is_public, share_slug=updated.share_slug)
    )


@router.delete("")
async def unshare_trip(db: DbSession, trip: OwnedTrip) -> ApiResponse[ShareState]:
    """Kills the link for good. Re-sharing mints a new slug rather than reviving
    the old one - see the service."""
    updated = await trip_service.unshare_trip(db, trip)
    return ApiResponse(
        data=ShareState(is_public=updated.is_public, share_slug=updated.share_slug)
    )


def _with_totals(trip, totals: dict) -> TripRead:
    return TripRead.model_validate(trip).model_copy(
        update={
            "activity_count": totals["activity_count"],
            "estimated_total": totals["estimated_total"],
            "stop_count": totals["stop_count"],
            "city_names": totals["city_names"],
        }
    )


async def _public_payload(db: DbSession, slug: str) -> PublicTripRead:
    trip = await trip_service.get_public_trip(db, slug)
    totals = (await trip_service.attach_totals(db, [trip]))[0]
    # Built through the constructor rather than model_copy: `owner_name` and
    # `copy_count` are required, and defaulting them would let a future caller
    # ship an empty owner name without noticing.
    return PublicTripRead(
        **_with_totals(trip, totals).model_dump(),
        owner_name=await trip_service.owner_display_name(db, trip),
        copy_count=await trip_service.count_copies(db, trip.id),
    )


@public_router.get("/{slug}")
async def read_public_trip(slug: Slug, db: DbSession) -> ApiResponse[PublicTripRead]:
    """No auth. A missing slug and a trip that stopped being public are both 404 -
    never 403, which would confirm the trip exists."""
    return ApiResponse(data=await _public_payload(db, slug))


@public_router.get("/{slug}/budget")
async def read_public_budget(slug: Slug, db: DbSession) -> ApiResponse[BudgetSummary]:
    """The same computed summary the owner sees. It is derived entirely from the
    itinerary that is already public, so it leaks nothing extra."""
    trip = await trip_service.get_public_trip(db, slug)
    return ApiResponse(data=await budget_service.get_budget(db, trip))


@public_router.post("/{slug}/copy", status_code=status.HTTP_201_CREATED)
async def copy_public_trip(
    slug: Slug, data: TripDuplicate, db: DbSession, user: CurrentUser
) -> ApiResponse[TripRead]:
    """Signed in, because the copy needs an owner. The copy is private, has no
    slug, and records `copied_from_trip_id` - which is what makes the source's
    copy count real rather than invented."""
    source = await trip_service.get_public_trip(db, slug)
    copy = await trip_service.duplicate_trip(db, user, source, data)
    totals = (await trip_service.attach_totals(db, [copy]))[0]
    return ApiResponse(data=_with_totals(copy, totals))

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError, conflict_from_unique_violation
from app.models.catalog import City, SavedDestination
from app.models.user import User
from app.schemas.user import UserUpdate
from app.services import catalog_service


async def update_profile(db: AsyncSession, user: User, data: UserUpdate) -> User:
    # exclude_unset: an omitted field is "leave alone", an explicit null is "clear it".
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        # `phone` is unique, so a profile edit can collide just like registration.
        await db.rollback()
        raise conflict_from_unique_violation(exc, "Those details are already in use") from None
    await db.refresh(user)
    return user


async def delete_account(db: AsyncSession, user: User) -> None:
    # FK cascades take the trips, stops, activities and tokens with it.
    await db.delete(user)
    await db.commit()


async def list_saved_destinations(db: AsyncSession, user: User) -> Sequence[City]:
    stmt = (
        select(City)
        .join(SavedDestination, SavedDestination.city_id == City.id)
        .where(SavedDestination.user_id == user.id)
        .order_by(SavedDestination.created_at.desc())
    )
    return (await db.execute(stmt)).scalars().all()


async def save_destination(db: AsyncSession, user: User, city_id: uuid.UUID) -> City:
    city = await catalog_service.get_city(db, city_id)  # 404s on unknown or inactive
    db.add(SavedDestination(user_id=user.id, city_id=city.id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ApiError("CONFLICT", "That city is already saved") from None
    return city


async def remove_destination(db: AsyncSession, user: User, city_id: uuid.UUID) -> None:
    result = await db.execute(
        delete(SavedDestination).where(
            SavedDestination.user_id == user.id, SavedDestination.city_id == city_id
        )
    )
    if result.rowcount == 0:
        raise ApiError("NOT_FOUND", "That city is not in your saved list")
    await db.commit()

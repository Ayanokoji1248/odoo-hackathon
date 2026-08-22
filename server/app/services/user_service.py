from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserUpdate


async def update_profile(db: AsyncSession, user: User, data: UserUpdate) -> User:
    # exclude_unset: an omitted field is "leave alone", an explicit null is "clear it".
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_account(db: AsyncSession, user: User) -> None:
    # FK cascades take the trips, stops, activities and tokens with it.
    await db.delete(user)
    await db.commit()

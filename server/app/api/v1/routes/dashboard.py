from fastapi import APIRouter

from app.core.schemas import ApiResponse
from app.deps import CurrentUser, DbSession
from app.schemas.budget import Dashboard
from app.services import dashboard_service

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard(db: DbSession, user: CurrentUser) -> ApiResponse[Dashboard]:
    """Everything the home screen needs, in one request."""
    return ApiResponse(data=await dashboard_service.get_dashboard(db, user))

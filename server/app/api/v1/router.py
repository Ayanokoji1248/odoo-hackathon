from fastapi import APIRouter

from app.api.v1.routes import (
    activities,
    admin,
    auth,
    budget,
    cities,
    dashboard,
    share,
    stops,
    trip_activities,
    trips,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(cities.router)
api_router.include_router(activities.router)
api_router.include_router(trips.router)
api_router.include_router(stops.router)
api_router.include_router(trip_activities.router)
api_router.include_router(budget.router)
api_router.include_router(dashboard.router)
api_router.include_router(share.router)
api_router.include_router(share.public_router)
api_router.include_router(admin.router)

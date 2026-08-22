from fastapi import APIRouter

from app.api.v1.routes import activities, auth, cities, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(cities.router)
api_router.include_router(activities.router)

# Mounted as each phase lands: trips, stops, budget, share, admin

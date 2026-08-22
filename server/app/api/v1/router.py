from fastapi import APIRouter

from app.api.v1.routes import auth, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)

# Mounted as each phase lands: trips, stops, activities, cities, budget, share, admin

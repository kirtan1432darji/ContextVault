from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.categories import router as categories_router
from app.api.v1.classification import router as classification_router
from app.api.v1.screenshots import router as screenshots_router
from app.api.v1.context import router as context_router
from app.api.v1.chat import router as chat_router
from app.api.v1.vision import router as vision_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(categories_router)
api_router.include_router(classification_router)
api_router.include_router(screenshots_router)
api_router.include_router(context_router)
api_router.include_router(chat_router)
api_router.include_router(vision_router, tags=["Vision AI"])

__all__ = ["api_router"]

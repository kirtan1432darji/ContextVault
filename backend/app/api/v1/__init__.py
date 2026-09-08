from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.categories import router as categories_router
from app.api.v1.classification import router as classification_router
from app.api.v1.screenshots import router as screenshots_router
from app.api.v1.context import router as context_router

__all__ = [
    "auth_router",
    "health_router",
    "categories_router",
    "classification_router",
    "screenshots_router",
    "context_router",
]

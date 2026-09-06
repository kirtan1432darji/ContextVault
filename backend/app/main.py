from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from app.core.config import settings
from app.core.logging import logger
from app.api.api import api_router
from app.middleware.error_handler import register_exception_handlers
from app.middleware.logging_middleware import LoggingAndRequestIdMiddleware
from app.middleware.jwt_auth import JWTValidationMiddleware


def create_application() -> FastAPI:
    """ContextVault FastAPI Application Factory."""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="ContextVault Privacy-First AI Screenshot Organization Backend API (FastAPI + SQL Server)",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # 1. CORS Configuration (React Native & Web Clients)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )

    # 2. Logging & Request ID Middleware
    application.add_middleware(LoggingAndRequestIdMiddleware)

    # 3. JWT Header Extractor Middleware
    application.add_middleware(JWTValidationMiddleware)

    # 4. Global Exception Handlers
    register_exception_handlers(application)

    # 5. Include API Routers under /api
    application.include_router(api_router, prefix=settings.API_V1_STR)

    # 6. Custom OpenAPI schema to enable JWT Bearer Authorize button
    def custom_openapi():
        if application.openapi_schema:
            return application.openapi_schema

        openapi_schema = get_openapi(
            title=settings.PROJECT_NAME,
            version=settings.VERSION,
            description=(
                "### ContextVault Master API Documentation\n\n"
                "Privacy-first intelligent organizational layer for mobile screenshots.\n"
                "- **FastAPI** + **Microsoft SQL Server 2022+**\n"
                "- **Clean Architecture**\n"
                "- **JWT Authentication** (Bearer tokens)"
            ),
            routes=application.routes,
        )

        openapi_schema["components"] = openapi_schema.get("components", {})
        openapi_schema["components"]["securitySchemes"] = {
            "HTTPBearer": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "Enter your JWT Bearer token to authorize requests.",
            }
        }

        # Apply security globally or per tagged secure router
        openapi_schema["security"] = [{"HTTPBearer": []}]
        application.openapi_schema = openapi_schema
        return application.openapi_schema

    application.openapi = custom_openapi

    @application.get("/", tags=["Root"])
    async def root():
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "operational",
            "docs": "/docs",
        }

    return application


app = create_application()

from fastapi import APIRouter
from app.database.database import check_database_connection
from app.core.config import settings
from app.schemas.health import HealthResponse, VersionResponse

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health", response_model=HealthResponse, summary="Perform system health check")
def health_check() -> HealthResponse:
    """Validate API runtime health and SQL Server database connectivity."""
    db_connected = check_database_connection()
    return HealthResponse(
        status="healthy" if db_connected else "degraded",
        database="connected" if db_connected else "disconnected",
        version=settings.VERSION,
    )


@router.get("/version", response_model=VersionResponse, summary="Retrieve API version metadata")
def get_version() -> VersionResponse:
    """Retrieve service metadata, version and runtime environment info."""
    return VersionResponse(
        version=settings.VERSION,
        name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
    )

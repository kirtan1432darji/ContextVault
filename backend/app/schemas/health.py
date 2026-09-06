from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health status representation."""
    status: str = Field(default="healthy", json_schema_extra={"example": "healthy"})
    database: str = Field(default="connected", json_schema_extra={"example": "connected"})
    version: str = Field(default="1.0.0", json_schema_extra={"example": "1.0.0"})


class VersionResponse(BaseModel):
    """API version and environment metadata."""
    version: str = "1.0.0"
    name: str = "ContextVault API"
    environment: str = "development"

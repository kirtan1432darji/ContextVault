import uuid
from datetime import datetime, timezone
from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard uniform API response envelope conforming to ContextVault specifications."""
    success: bool = Field(default=True, description="Indicates if operation succeeded")
    message: str = Field(default="", description="Descriptive status message")
    data: Optional[T] = Field(default=None, description="Payload data")
    errors: List[str] = Field(default_factory=list, description="List of error details if any")
    requestId: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Trace request identifier")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp",
    )

    @classmethod
    def ok(
        cls,
        data: Optional[T] = None,
        message: str = "Operation completed successfully.",
        request_id: Optional[str] = None,
    ) -> "ApiResponse[T]":
        return cls(
            success=True,
            message=message,
            data=data,
            errors=[],
            requestId=request_id or str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def fail(
        cls,
        message: str,
        errors: Optional[List[str]] = None,
        data: Optional[T] = None,
        request_id: Optional[str] = None,
    ) -> "ApiResponse[T]":
        err_list = errors if errors is not None else [message]
        return cls(
            success=False,
            message=message,
            data=data,
            errors=err_list,
            requestId=request_id or str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

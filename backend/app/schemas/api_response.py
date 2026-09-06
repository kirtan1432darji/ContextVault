from typing import Generic, TypeVar, Optional, List, Any, Dict
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard uniform API response envelope conforming to ContextVault specifications."""
    success: bool = Field(default=True, description="Indicates if operation succeeded")
    message: str = Field(default="", description="Descriptive status message")
    data: Optional[T] = Field(default=None, description="Payload data")
    errors: List[str] = Field(default_factory=list, description="List of error details if any")

    @classmethod
    def ok(
        cls,
        data: Optional[T] = None,
        message: str = "Operation completed successfully.",
    ) -> "ApiResponse[T]":
        return cls(success=True, message=message, data=data, errors=[])

    @classmethod
    def fail(
        cls,
        message: str,
        errors: Optional[List[str]] = None,
        data: Optional[T] = None,
    ) -> "ApiResponse[T]":
        err_list = errors if errors is not None else [message]
        return cls(success=False, message=message, data=data, errors=err_list)

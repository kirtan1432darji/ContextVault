import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserRegisterRequest(BaseModel):
    """Payload for user registration."""
    username: str = Field(..., min_length=3, max_length=100, description="Unique username")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="User password")


class UserLoginRequest(BaseModel):
    """Payload for authentication."""
    emailOrUsername: str = Field(..., min_length=3, description="Username or email address")
    password: str = Field(..., min_length=1, description="Account password")


class TokenRefreshRequest(BaseModel):
    """Payload for renewing JWT session."""
    refreshToken: str = Field(..., min_length=1, description="Valid cryptographically signed refresh token")


class TokenRevokeRequest(BaseModel):
    """Payload for logout / token revocation."""
    refreshToken: str = Field(..., min_length=1, description="Refresh token to revoke")


class UserDto(BaseModel):
    """Public user profile data transfer object."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    isActive: bool = True
    createdOn: datetime


class TokenResponse(BaseModel):
    """Token credentials returned upon successful login / registration."""
    accessToken: str
    refreshToken: str
    tokenType: str = "Bearer"
    userId: uuid.UUID
    username: str
    email: str
    user: Optional[UserDto] = None

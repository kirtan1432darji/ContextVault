from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.services.auth_service import AuthService
from app.models.user import User
from app.schemas.api_response import ApiResponse
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenRefreshRequest,
    TokenRevokeRequest,
    TokenResponse,
    UserDto,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=ApiResponse[TokenResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    request: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> ApiResponse[TokenResponse]:
    """Register a new user, hashes password with bcrypt, and issues initial JWT tokens."""
    service = AuthService(db)
    token_resp = service.register(request)
    return ApiResponse.ok(
        data=token_resp,
        message="User account registered successfully.",
    )


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    summary="Authenticate user and obtain JWT tokens",
)
def login(
    request: UserLoginRequest,
    db: Session = Depends(get_db),
) -> ApiResponse[TokenResponse]:
    """Authenticate credentials against stored bcrypt hash and return access/refresh tokens."""
    service = AuthService(db)
    token_resp = service.authenticate(request)
    return ApiResponse.ok(
        data=token_resp,
        message="Authentication successful.",
    )


@router.get(
    "/profile",
    response_model=ApiResponse[UserDto],
    summary="Retrieve profile of the currently authenticated user",
)
def get_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ApiResponse[UserDto]:
    """Retrieve current user profile using Bearer JWT access token."""
    service = AuthService(db)
    user_dto = service.get_profile(current_user)
    return ApiResponse.ok(
        data=user_dto,
        message="Profile retrieved successfully.",
    )


@router.post(
    "/refresh",
    response_model=ApiResponse[TokenResponse],
    summary="Refresh an expired JWT access token",
)
def refresh_token(
    request: TokenRefreshRequest,
    db: Session = Depends(get_db),
) -> ApiResponse[TokenResponse]:
    """Rotate JWT refresh token and issue a new access token."""
    service = AuthService(db)
    token_resp = service.refresh(request.refreshToken)
    return ApiResponse.ok(
        data=token_resp,
        message="Token refreshed successfully.",
    )


@router.post(
    "/logout",
    response_model=ApiResponse[bool],
    summary="Revoke refresh token and end session",
)
def logout(
    request: TokenRevokeRequest,
    db: Session = Depends(get_db),
) -> ApiResponse[bool]:
    """Revoke refresh token to invalidate active mobile session."""
    service = AuthService(db)
    revoked = service.revoke_token(request.refreshToken)
    return ApiResponse.ok(
        data=revoked,
        message="Logged out successfully.",
    )

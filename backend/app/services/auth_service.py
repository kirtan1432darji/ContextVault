import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.repositories.user_repository import UserRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserDto,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.config import settings
from app.core.logging import logger


class AuthService:
    """Service handling registration, authentication, token rotation, and credential management."""

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.token_repo = RefreshTokenRepository(db)

    def register(self, request: UserRegisterRequest) -> TokenResponse:
        # Check existing email (including soft-deleted to avoid SQL Server unique constraint collisions)
        if self.user_repo.get_by_email(request.email, include_deleted=True):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

        # Check existing username (including soft-deleted)
        if self.user_repo.get_by_username(request.username, include_deleted=True):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this username already exists.",
            )

        # Create user entity
        user = User(
            Username=request.username.strip(),
            Email=request.email.strip().lower(),
            PasswordHash=hash_password(request.password),
            IsActive=True,
        )
        created_user = self.user_repo.create(user)
        logger.info(f"Registered new user '{created_user.Username}' ({created_user.Id})")

        return self._generate_token_response(created_user)

    def authenticate(self, request: UserLoginRequest) -> TokenResponse:
        user = self.user_repo.get_by_identifier(request.emailOrUsername)
        if not user or not verify_password(request.password, user.PasswordHash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email/username or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.IsActive:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated.",
            )

        logger.info(f"User authenticated successfully: {user.Username} ({user.Id})")
        return self._generate_token_response(user)

    def refresh(self, refresh_token_str: str) -> TokenResponse:
        # Validate JWT structure and expiration
        try:
            payload = decode_token(refresh_token_str)
            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type for refresh operation.",
                )
            user_id_str = payload.get("sub")
            if not user_id_str:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Malformed refresh token subject.",
                )
            user_id = uuid.UUID(user_id_str)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Expired or invalid refresh token.",
            )

        # Verify against stored DB record
        token_record = self.token_repo.get_by_token(refresh_token_str)
        if not token_record or token_record.IsRevoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked or is invalid.",
            )

        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        if token_record.ExpiresAt < now_utc:
            self.token_repo.revoke_token(refresh_token_str)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired.",
            )

        user = self.user_repo.get_by_id(user_id)
        if not user or not user.IsActive or user.IsDeleted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not active.",
            )

        # Revoke old refresh token (token rotation policy)
        self.token_repo.revoke_token(refresh_token_str)

        # Generate fresh token pair
        return self._generate_token_response(user)

    def revoke_token(self, refresh_token_str: str) -> bool:
        return self.token_repo.revoke_token(refresh_token_str)

    def get_profile(self, user: User) -> UserDto:
        return UserDto(
            id=user.Id,
            username=user.Username,
            email=user.Email,
            isActive=user.IsActive,
            createdOn=user.CreatedOn,
        )

    def _generate_token_response(self, user: User) -> TokenResponse:
        user_dto = self.get_profile(user)
        access_token = create_access_token(
            subject=str(user.Id),
            extra_claims={"username": user.Username, "email": user.Email},
        )
        refresh_token = create_refresh_token(subject=str(user.Id))

        # Store refresh token record in database
        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        ).replace(tzinfo=None)

        token_record = RefreshToken(
            UserId=user.Id,
            Token=refresh_token,
            ExpiresAt=expires_at,
            IsRevoked=False,
        )
        self.token_repo.create(token_record)

        return TokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            tokenType="Bearer",
            userId=user.Id,
            username=user.Username,
            email=user.Email,
            user=user_dto,
        )

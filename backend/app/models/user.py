import uuid
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken
    from app.models.app_setting import AppSetting


class User(Base):
    """ContextVault User Entity matching SQL Server Schema."""
    __tablename__ = "Users"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    Username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    Email: Mapped[str] = mapped_column(String(256), unique=True, index=True, nullable=False)
    PasswordHash: Mapped[str] = mapped_column(String(256), nullable=False)
    IsActive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    IsDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        onupdate=lambda: datetime.now(timezone.utc),
    )
    CreatedBy: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    UpdatedBy: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    DeletedOn: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    app_settings: Mapped[List["AppSetting"]] = relationship(
        "AppSetting",
        back_populates="user",
        cascade="all, delete-orphan",
    )

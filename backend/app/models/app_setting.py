import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AppSetting(Base):
    """ContextVault Configuration preferences (user-specific or global)."""
    __tablename__ = "AppSettings"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    UserId: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("Users.Id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    SettingKey: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    SettingValue: Mapped[str] = mapped_column(Text, nullable=False)
    DataType: Mapped[str] = mapped_column(String(50), default="String", nullable=False)
    Description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    IsDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    CreatedBy: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    UpdatedBy: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    DeletedOn: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    user: Mapped["User | None"] = relationship("User", back_populates="app_settings")

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class RefreshToken(Base):
    """ContextVault RefreshToken Entity for rotating JWT sessions."""
    __tablename__ = "RefreshTokens"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    UserId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Users.Id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    Token: Mapped[str] = mapped_column(String(500), unique=True, index=True, nullable=False)
    ExpiresAt: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    IsRevoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

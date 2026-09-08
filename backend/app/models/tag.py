import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.screenshot import Screenshot


class Tag(Base):
    """Tag entity for categorizing and labeling screenshots."""
    __tablename__ = "Tags"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    Name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    Color: Mapped[str] = mapped_column(String(50), default="#6366F1", nullable=False)
    UserId: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=True,
        index=True,
    )
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    screenshots: Mapped[List["Screenshot"]] = relationship(
        "Screenshot",
        secondary="ScreenshotTags",
        back_populates="tags",
    )


class ScreenshotTag(Base):
    """Many-to-many relationship mapping between Screenshots and Tags."""
    __tablename__ = "ScreenshotTags"

    ScreenshotId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Screenshots.Id", ondelete="CASCADE"),
        primary_key=True,
    )
    TagId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Tags.Id", ondelete="CASCADE"),
        primary_key=True,
    )
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

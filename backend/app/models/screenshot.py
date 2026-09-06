import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.tag import Tag
    from app.models.classification_history import ClassificationHistory
    from app.models.search_index import SearchIndex
    from app.models.user import User


class Screenshot(Base):
    """ContextVault Screenshot Metadata Entity (Non-Destructive Intelligence Layer)."""
    __tablename__ = "Screenshots"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    UserId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    CategoryId: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("Categories.Id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    SubCategory: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    FileName: Mapped[str] = mapped_column(String(260), nullable=False)
    OCRText: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    NormalizedText: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    SHA256Hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    DeviceFolder: Mapped[Optional[str]] = mapped_column(String(260), nullable=True)
    DetectedApp: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    Width: Mapped[int] = mapped_column(Integer, default=1080, nullable=False)
    Height: Mapped[int] = mapped_column(Integer, default=2400, nullable=False)
    MimeType: Mapped[str] = mapped_column(String(50), default="image/png", nullable=False)
    Confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    IsFavorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    IsReviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    IsDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    DeletedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    category: Mapped[Optional["Category"]] = relationship(
        "Category",
        back_populates="screenshots",
    )
    tags: Mapped[List["Tag"]] = relationship(
        "Tag",
        secondary="ScreenshotTags",
        back_populates="screenshots",
    )
    classification_events: Mapped[List["ClassificationHistory"]] = relationship(
        "ClassificationHistory",
        back_populates="screenshot",
        cascade="all, delete-orphan",
    )
    search_index: Mapped[Optional["SearchIndex"]] = relationship(
        "SearchIndex",
        back_populates="screenshot",
        uselist=False,
        cascade="all, delete-orphan",
    )

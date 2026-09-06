import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.user import User
    from app.models.screenshot import Screenshot


class FolderContext(Base):
    """
    ContextVault Folder Knowledge Context Entity.
    Stores synthesized executive summaries, recurring topics, aggregated entities,
    extracted tasks, and chronological timeline events.
    """
    __tablename__ = "FolderContexts"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    FolderId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Categories.Id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    UserId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    Summary: Mapped[str] = mapped_column(Text, nullable=False)
    TopicsJson: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    EntitiesJson: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    TasksJson: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    TimelineJson: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    Confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    Version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    ScreenshotsAnalyzed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    GeneratedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    IsDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    DeletedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    folder: Mapped["Category"] = relationship("Category", foreign_keys=[FolderId])
    user: Mapped["User"] = relationship("User", foreign_keys=[UserId])
    insights: Mapped[List["ContextInsight"]] = relationship(
        "ContextInsight",
        back_populates="folder_context",
        cascade="all, delete-orphan",
    )


class ContextInsight(Base):
    """
    Key atomic insights, metrics, and highlights extracted from a FolderContext.
    """
    __tablename__ = "ContextInsights"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    FolderContextId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("FolderContexts.Id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    InsightType: Mapped[str] = mapped_column(String(50), nullable=False)
    Value: Mapped[str] = mapped_column(Text, nullable=False)
    Confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    folder_context: Mapped["FolderContext"] = relationship("FolderContext", back_populates="insights")


class EntityOccurrence(Base):
    """
    Tracks structured entity frequency and cross-screenshot associations in a folder.
    """
    __tablename__ = "EntityOccurrences"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    Entity: Mapped[str] = mapped_column(String(260), nullable=False, index=True)
    EntityType: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ScreenshotId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Screenshots.Id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    FolderId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Categories.Id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    Count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    screenshot: Mapped["Screenshot"] = relationship("Screenshot", foreign_keys=[ScreenshotId])
    folder: Mapped["Category"] = relationship("Category", foreign_keys=[FolderId])

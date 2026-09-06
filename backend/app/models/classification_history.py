import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.screenshot import Screenshot


class ClassificationHistory(Base):
    """Audit ledger capturing every AI/Rule classification decision for a screenshot."""
    __tablename__ = "ClassificationHistory"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ScreenshotId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Screenshots.Id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    UserId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    Category: Mapped[str] = mapped_column(String(100), nullable=False)
    SubCategory: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    TagsJson: Mapped[Optional[str]] = mapped_column(Text, default="[]", nullable=True)
    EntitiesJson: Mapped[Optional[str]] = mapped_column(Text, default="{}", nullable=True)
    Confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ModelName: Mapped[str] = mapped_column(String(100), default="RuleEngine-v1.0", nullable=False)
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    screenshot: Mapped["Screenshot"] = relationship(
        "Screenshot",
        back_populates="classification_events",
    )

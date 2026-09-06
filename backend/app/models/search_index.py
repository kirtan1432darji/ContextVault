import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.screenshot import Screenshot


class SearchIndex(Base):
    """Normalized full-text and semantic search index for screenshots."""
    __tablename__ = "SearchIndex"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ScreenshotId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Screenshots.Id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    UserId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    SearchableContent: Mapped[str] = mapped_column(Text, nullable=False)
    Keywords: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    IndexedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    screenshot: Mapped["Screenshot"] = relationship(
        "Screenshot",
        back_populates="search_index",
    )

import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.user import User
    from app.models.screenshot import Screenshot


class ChatHistory(Base):
    """
    ContextVault Multi-Turn Context AI Conversation History Entity.
    Persists user queries and AI assistant responses with screenshot citation metadata,
    token counts, and hierarchical category/folder context.
    """
    __tablename__ = "ChatHistories"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    SessionId: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
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
    ScreenshotId: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("Screenshots.Id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    Role: Mapped[str] = mapped_column(String(20), nullable=False)
    Message: Mapped[str] = mapped_column(Text, nullable=False)
    ReferencedScreenshotIdsJson: Mapped[Optional[str]] = mapped_column(
        Text, default="[]", nullable=True
    )
    PromptTokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    CompletionTokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    AIModelId: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)
    IsDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    DeletedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[UserId])
    category: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[CategoryId])
    screenshot: Mapped[Optional["Screenshot"]] = relationship("Screenshot", foreign_keys=[ScreenshotId])

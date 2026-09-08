import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.user import User
    from app.models.screenshot import Screenshot


class ChatSession(Base):
    """
    ContextVault Multi-Turn Chat Session Entity.
    Groups conversation turns and messages within a Smart Folder or global context.
    """
    __tablename__ = "ChatSessions"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    UserId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    FolderId: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("Categories.Id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    Title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
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
    folder: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[FolderId])
    messages: Mapped[List["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.CreatedOn.asc()",
    )


class ChatMessage(Base):
    """
    ContextVault Multi-Turn Context AI Conversation Message Entity.
    Persists user queries and AI assistant responses with screenshot citation metadata,
    token counts, and hierarchical category/folder context.
    """
    __tablename__ = "ChatMessages"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    SessionId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ChatSessions.Id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    UserId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    FolderId: Mapped[Optional[uuid.UUID]] = mapped_column(
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
    CitationsJson: Mapped[Optional[str]] = mapped_column(
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
    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")
    user: Mapped["User"] = relationship("User", foreign_keys=[UserId])
    folder: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[FolderId])
    screenshot: Mapped[Optional["Screenshot"]] = relationship("Screenshot", foreign_keys=[ScreenshotId])

    # Compatibility properties for CategoryId and ReferencedScreenshotIdsJson
    @property
    def CategoryId(self) -> Optional[uuid.UUID]:
        return self.FolderId

    @CategoryId.setter
    def CategoryId(self, value: Optional[uuid.UUID]) -> None:
        self.FolderId = value

    @property
    def ReferencedScreenshotIdsJson(self) -> Optional[str]:
        return self.CitationsJson

    @ReferencedScreenshotIdsJson.setter
    def ReferencedScreenshotIdsJson(self, value: Optional[str]) -> None:
        self.CitationsJson = value


# Backward compatibility alias
ChatHistory = ChatMessage

import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.screenshot import Screenshot
    from app.models.user import User


class Category(Base):
    """Hierarchical category taxonomy for smart folders."""
    __tablename__ = "Categories"

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    UserId: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("Users.Id", ondelete="NO ACTION"),
        nullable=True,
        index=True,
    )
    ParentCategoryId: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("Categories.Id", ondelete="NO ACTION"),
        nullable=True,
        index=True,
    )
    Name: Mapped[str] = mapped_column(String(100), nullable=False)
    Path: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    Icon: Mapped[str] = mapped_column(String(100), default="folder-outline", nullable=False)
    Color: Mapped[str] = mapped_column(String(50), default="#6366F1", nullable=False)
    IsSystem: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ScreenshotCount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    DisplayOrder: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    Description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    IsDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    DeletedOn: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Self-referencing recursive tree relationship
    parent: Mapped[Optional["Category"]] = relationship(
        "Category",
        remote_side=[Id],
        back_populates="sub_categories",
    )
    sub_categories: Mapped[List["Category"]] = relationship(
        "Category",
        back_populates="parent",
        cascade="all, delete-orphan",
    )

    # Associated screenshots
    screenshots: Mapped[List["Screenshot"]] = relationship(
        "Screenshot",
        back_populates="category",
    )

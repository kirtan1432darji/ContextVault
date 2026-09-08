import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base


class AuditModel(Base):
    """Abstract base model with standard enterprise audit timestamps and soft deletion."""
    __abstract__ = True

    Id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    IsDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    CreatedOn: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    UpdatedOn: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        onupdate=lambda: datetime.now(timezone.utc),
    )
    CreatedBy: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    UpdatedBy: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    DeletedOn: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

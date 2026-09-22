import uuid
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository handling User entity database interactions."""

    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str, include_deleted: bool = False) -> Optional[User]:
        stmt = select(User).where(User.Email == email.strip().lower())
        if not include_deleted:
            stmt = stmt.where(User.IsDeleted == False)
        return self.db.scalars(stmt).first()

    def get_by_username(self, username: str, include_deleted: bool = False) -> Optional[User]:
        stmt = select(User).where(User.Username == username.strip())
        if not include_deleted:
            stmt = stmt.where(User.IsDeleted == False)
        return self.db.scalars(stmt).first()

    def get_by_identifier(self, identifier: str) -> Optional[User]:
        """Find user by email or username."""
        clean = identifier.strip()
        stmt = select(User).where(
            or_(User.Email == clean.lower(), User.Username == clean),
            User.IsDeleted == False,
        )
        return self.db.scalars(stmt).first()

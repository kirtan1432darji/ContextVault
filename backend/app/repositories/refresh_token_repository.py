import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from app.models.refresh_token import RefreshToken
from app.repositories.base_repository import BaseRepository


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    """Repository handling JWT RefreshToken persistence and revocation."""

    def __init__(self, db: Session):
        super().__init__(RefreshToken, db)

    def get_by_token(self, token_str: str) -> Optional[RefreshToken]:
        stmt = select(RefreshToken).where(
            RefreshToken.Token == token_str,
            RefreshToken.IsRevoked == False,
        )
        return self.db.scalars(stmt).first()

    def revoke_token(self, token_str: str) -> bool:
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.Token == token_str)
            .values(IsRevoked=True, UpdatedOn=datetime.now(timezone.utc))
        )
        res = self.db.execute(stmt)
        self.db.commit()
        return res.rowcount > 0

    def revoke_all_for_user(self, user_id: uuid.UUID) -> int:
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.UserId == user_id, RefreshToken.IsRevoked == False)
            .values(IsRevoked=True, UpdatedOn=datetime.now(timezone.utc))
        )
        res = self.db.execute(stmt)
        self.db.commit()
        return res.rowcount

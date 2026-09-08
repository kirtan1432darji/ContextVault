import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session
from app.models.search_index import SearchIndex
from app.repositories.base_repository import BaseRepository


class SearchRepository(BaseRepository[SearchIndex]):
    """Repository managing SearchIndex full-text and semantic metadata indices."""

    def __init__(self, db: Session):
        super().__init__(SearchIndex, db)

    def get_by_screenshot_id(self, screenshot_id: uuid.UUID) -> Optional[SearchIndex]:
        stmt = select(SearchIndex).where(SearchIndex.ScreenshotId == screenshot_id)
        return self.db.scalars(stmt).first()

    def upsert_index(
        self,
        screenshot_id: uuid.UUID,
        user_id: uuid.UUID,
        searchable_content: str,
        keywords: Optional[str] = None,
    ) -> SearchIndex:
        existing = self.get_by_screenshot_id(screenshot_id)
        if existing:
            existing.SearchableContent = searchable_content
            existing.Keywords = keywords
            existing.UpdatedOn = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(existing)
            return existing

        new_index = SearchIndex(
            Id=uuid.uuid4(),
            ScreenshotId=screenshot_id,
            UserId=user_id,
            SearchableContent=searchable_content,
            Keywords=keywords,
            IndexedOn=datetime.now(timezone.utc),
        )
        self.db.add(new_index)
        self.db.commit()
        self.db.refresh(new_index)
        return new_index

    def search(self, user_id: uuid.UUID, term: str, limit: int = 50) -> List[SearchIndex]:
        pattern = f"%{term.strip()}%"
        stmt = (
            select(SearchIndex)
            .where(
                and_(
                    SearchIndex.UserId == user_id,
                    or_(
                        SearchIndex.SearchableContent.like(pattern),
                        SearchIndex.Keywords.like(pattern),
                    ),
                )
            )
            .order_by(SearchIndex.IndexedOn.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

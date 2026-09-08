import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.search_repository import SearchRepository
from app.models.search_index import SearchIndex


class SearchIndexService:
    """Service managing full-text search indexing and token search."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = SearchRepository(db)

    def index_screenshot(
        self,
        screenshot_id: uuid.UUID,
        user_id: uuid.UUID,
        file_name: str,
        ocr_text: Optional[str],
        category_name: str,
        sub_category: Optional[str],
        tags: List[str],
        detected_app: Optional[str] = None,
    ) -> SearchIndex:
        keywords = set(tags)
        if category_name:
            keywords.add(category_name)
        if sub_category:
            keywords.add(sub_category)
        if detected_app:
            keywords.add(detected_app)

        searchable_content = f"{file_name} {category_name} {sub_category or ''} {detected_app or ''} {ocr_text or ''}".strip()
        keywords_str = ", ".join(sorted(list(keywords)))

        return self.repo.upsert_index(
            screenshot_id=screenshot_id,
            user_id=user_id,
            searchable_content=searchable_content,
            keywords=keywords_str,
        )

    def search(self, user_id: uuid.UUID, query: str, limit: int = 50) -> List[SearchIndex]:
        return self.repo.search(user_id, query, limit)

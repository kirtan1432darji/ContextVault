import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.classification_history import ClassificationHistory
from app.repositories.base_repository import BaseRepository


class ClassificationRepository(BaseRepository[ClassificationHistory]):
    """Repository handling ClassificationHistory audit ledger operations."""

    def __init__(self, db: Session):
        super().__init__(ClassificationHistory, db)

    def record_event(
        self,
        screenshot_id: uuid.UUID,
        user_id: uuid.UUID,
        category: str,
        sub_category: Optional[str],
        tags: List[str],
        entities: Dict[str, Any],
        confidence: float,
        model_name: str = "RuleEngine-v1.0",
    ) -> ClassificationHistory:
        event = ClassificationHistory(
            Id=uuid.uuid4(),
            ScreenshotId=screenshot_id,
            UserId=user_id,
            Category=category,
            SubCategory=sub_category,
            TagsJson=json.dumps(tags, ensure_ascii=False),
            EntitiesJson=json.dumps(entities, ensure_ascii=False),
            Confidence=confidence,
            ModelName=model_name,
            CreatedOn=datetime.now(timezone.utc),
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def get_by_screenshot(self, screenshot_id: uuid.UUID, limit: int = 50) -> List[ClassificationHistory]:
        stmt = (
            select(ClassificationHistory)
            .where(ClassificationHistory.ScreenshotId == screenshot_id)
            .order_by(ClassificationHistory.CreatedOn.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

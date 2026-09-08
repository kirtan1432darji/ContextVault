import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select, and_, or_, delete, func
from sqlalchemy.orm import Session
from app.models.folder_context import FolderContext, ContextInsight, EntityOccurrence
from app.models.category import Category
from app.repositories.base_repository import BaseRepository


class FolderContextRepository(BaseRepository[FolderContext]):
    """Repository managing FolderContexts, ContextInsights, and EntityOccurrences."""

    def __init__(self, db: Session):
        super().__init__(FolderContext, db)

    def get_by_folder_id(
        self, folder_id: uuid.UUID, user_id: Optional[uuid.UUID] = None
    ) -> Optional[FolderContext]:
        """Fetches active folder context for a category, optionally scoped to a user."""
        conditions = [
            FolderContext.FolderId == folder_id,
            FolderContext.IsDeleted == False,
        ]
        if user_id:
            conditions.append(FolderContext.UserId == user_id)

        stmt = (
            select(FolderContext)
            .where(and_(*conditions))
            .order_by(FolderContext.Version.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def get_by_id_and_user(
        self, context_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[FolderContext]:
        stmt = select(FolderContext).where(
            and_(
                FolderContext.Id == context_id,
                FolderContext.UserId == user_id,
                FolderContext.IsDeleted == False,
            )
        )
        return self.db.scalars(stmt).first()

    def upsert_context(
        self,
        folder_id: uuid.UUID,
        user_id: uuid.UUID,
        summary: str,
        topics: List[str],
        entities: Dict[str, Any],
        tasks: List[Dict[str, Any]],
        timeline: List[Dict[str, Any]],
        confidence: float,
        screenshots_analyzed: int,
    ) -> FolderContext:
        """Upserts folder context and increments version if already exists."""
        existing = self.get_by_folder_id(folder_id, user_id)
        now = datetime.now(timezone.utc)

        topics_json = json.dumps(topics, default=str)
        entities_json = json.dumps(entities, default=str)
        tasks_json = json.dumps(tasks, default=str)
        timeline_json = json.dumps(timeline, default=str)

        if existing:
            existing.Summary = summary
            existing.TopicsJson = topics_json
            existing.EntitiesJson = entities_json
            existing.TasksJson = tasks_json
            existing.TimelineJson = timeline_json
            existing.Confidence = confidence
            existing.ScreenshotsAnalyzed = screenshots_analyzed
            existing.Version += 1
            existing.GeneratedOn = now
            existing.UpdatedOn = now
            self.db.commit()
            self.db.refresh(existing)
            return existing

        new_context = FolderContext(
            Id=uuid.uuid4(),
            FolderId=folder_id,
            UserId=user_id,
            Summary=summary,
            TopicsJson=topics_json,
            EntitiesJson=entities_json,
            TasksJson=tasks_json,
            TimelineJson=timeline_json,
            Confidence=confidence,
            Version=1,
            ScreenshotsAnalyzed=screenshots_analyzed,
            GeneratedOn=now,
            CreatedOn=now,
        )
        self.db.add(new_context)
        self.db.commit()
        self.db.refresh(new_context)
        return new_context

    def get_recent_contexts(
        self, user_id: uuid.UUID, limit: int = 10
    ) -> List[FolderContext]:
        stmt = (
            select(FolderContext)
            .where(
                and_(
                    FolderContext.UserId == user_id,
                    FolderContext.IsDeleted == False,
                )
            )
            .order_by(FolderContext.GeneratedOn.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def search_contexts(
        self, user_id: uuid.UUID, term: str, limit: int = 20
    ) -> List[Tuple[FolderContext, str, str]]:
        """
        Searches across folder summaries, topics, entities, and tasks.
        Returns list of tuples: (FolderContext, matched_field, snippet).
        """
        pattern = f"%{term.strip().lower()}%"
        stmt = (
            select(FolderContext)
            .where(
                and_(
                    FolderContext.UserId == user_id,
                    FolderContext.IsDeleted == False,
                    or_(
                        func.lower(FolderContext.Summary).like(pattern),
                        func.lower(FolderContext.TopicsJson).like(pattern),
                        func.lower(FolderContext.EntitiesJson).like(pattern),
                        func.lower(FolderContext.TasksJson).like(pattern),
                        func.lower(FolderContext.TimelineJson).like(pattern),
                    ),
                )
            )
            .order_by(FolderContext.GeneratedOn.desc())
            .limit(limit)
        )
        contexts = list(self.db.scalars(stmt).all())

        results: List[Tuple[FolderContext, str, str]] = []
        term_clean = term.strip().lower()

        for ctx in contexts:
            matched_field = "summary"
            snippet = ctx.Summary[:160]

            if term_clean in ctx.Summary.lower():
                matched_field = "summary"
                # Extract excerpt around term
                idx = ctx.Summary.lower().find(term_clean)
                start = max(0, idx - 40)
                end = min(len(ctx.Summary), idx + len(term_clean) + 40)
                snippet = f"...{ctx.Summary[start:end]}..."
            elif term_clean in ctx.TopicsJson.lower():
                matched_field = "topic"
                snippet = f"Topic match in: {ctx.TopicsJson}"
            elif term_clean in ctx.EntitiesJson.lower():
                matched_field = "entity"
                snippet = f"Entity match in: {ctx.EntitiesJson[:150]}..."
            elif term_clean in ctx.TasksJson.lower():
                matched_field = "task"
                snippet = f"Action task match in: {ctx.TasksJson[:150]}..."
            elif term_clean in ctx.TimelineJson.lower():
                matched_field = "timeline"
                snippet = f"Timeline event match in: {ctx.TimelineJson[:150]}..."

            results.append((ctx, matched_field, snippet))

        return results

    def save_insights(
        self, folder_context_id: uuid.UUID, insights: List[Dict[str, Any]]
    ) -> None:
        """Deletes existing insights and inserts new atomic insights for a context."""
        self.db.execute(
            delete(ContextInsight).where(
                ContextInsight.FolderContextId == folder_context_id
            )
        )
        now = datetime.now(timezone.utc)
        for item in insights:
            insight = ContextInsight(
                Id=uuid.uuid4(),
                FolderContextId=folder_context_id,
                InsightType=item.get("insightType", "summary"),
                Value=item.get("value", ""),
                Confidence=item.get("confidence", 1.0),
                CreatedOn=now,
            )
            self.db.add(insight)
        self.db.commit()

    def record_entity_occurrences(
        self,
        folder_id: uuid.UUID,
        screenshot_id: uuid.UUID,
        entities_dict: Dict[str, List[str]],
    ) -> None:
        """Records entity occurrences associated with a screenshot in a folder."""
        # Clear existing occurrences for this screenshot to prevent duplicate counts
        self.db.execute(
            delete(EntityOccurrence).where(
                EntityOccurrence.ScreenshotId == screenshot_id
            )
        )
        now = datetime.now(timezone.utc)
        for entity_type, entity_list in entities_dict.items():
            if not isinstance(entity_list, list):
                continue
            for entity_val in entity_list:
                clean_val = str(entity_val).strip()
                if not clean_val:
                    continue
                occurrence = EntityOccurrence(
                    Id=uuid.uuid4(),
                    Entity=clean_val[:260],
                    EntityType=entity_type[:50],
                    ScreenshotId=screenshot_id,
                    FolderId=folder_id,
                    Count=1,
                    CreatedOn=now,
                )
                self.db.add(occurrence)
        self.db.commit()

    def get_entity_occurrences_by_folder(
        self, folder_id: uuid.UUID
    ) -> List[EntityOccurrence]:
        stmt = (
            select(EntityOccurrence)
            .where(EntityOccurrence.FolderId == folder_id)
            .order_by(EntityOccurrence.CreatedOn.desc())
        )
        return list(self.db.scalars(stmt).all())

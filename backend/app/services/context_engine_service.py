import uuid
import re
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from collections import Counter
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.screenshot import Screenshot
from app.models.folder_context import FolderContext
from app.repositories.category_repository import CategoryRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.repositories.folder_context_repository import FolderContextRepository
from app.services.entity_extraction_service import EntityExtractionService
from app.services.timeline_service import TimelineService
from app.schemas.classification import ExtractedEntitiesDto
from app.schemas.context import (
    FolderContextDto,
    ContextTaskDto,
    TimelineEventDto,
    FolderEntitiesDto,
    EntityItemDto,
    RecentContextDto,
    ContextSearchResultDto,
)


class ContextEngineService:
    """
    ContextVault Folder Knowledge Context Engine.
    Transforms raw classified screenshots, OCR text streams, and metadata into:
    - Synthesized Executive Knowledge Summaries
    - Recurring Topic Detection
    - 14 Structured Entity Aggregations & Normalizations
    - Actionable Tasks, Meetings, and Deadlines
    - Chronological Event Timelines (oldest -> newest)
    - Versioned Folder Context Storage
    """

    STOP_WORDS = {
        "the", "and", "to", "of", "a", "in", "for", "is", "on", "that", "by", "this",
        "with", "i", "you", "it", "not", "or", "be", "are", "from", "at", "as", "your",
        "all", "have", "new", "more", "an", "was", "we", "will", "my", "has", "can",
        "our", "do", "if", "so", "what", "there", "about", "which", "when", "one",
        "their", "then", "would", "up", "out", "who", "them", "some", "me", "into",
        "screenshot", "image", "png", "jpg", "jpeg", "am", "pm",
    }

    TASK_PATTERNS = [
        re.compile(r"(?:todo|action\s+item|task)\s*[:\-]\s*([^\n\r]+)", re.IGNORECASE),
        re.compile(r"\[\s*\]\s*([^\n\r]+)", re.IGNORECASE),
        re.compile(r"(?:need\s+to|must|please|follow\s+up(?:\s+on)?)\s+([^\n\r\.]{5,80})", re.IGNORECASE),
        re.compile(r"(?:deadline|due\s+(?:on|by|date))\s*[:\-]?\s*([^\n\r]+)", re.IGNORECASE),
        re.compile(r"(?:meeting\s+(?:with|at|on)|standup\s+(?:at|with)|sync\s+(?:with|at))\s*([^\n\r]+)", re.IGNORECASE),
        re.compile(r"(?:submit|deliver|review|pay\s+before|pay\s+by)\s+([^\n\r\.]{5,80})", re.IGNORECASE),
    ]

    def __init__(self, db: Session):
        self.db = db
        self.category_repo = CategoryRepository(db)
        self.screenshot_repo = ScreenshotRepository(db)
        self.context_repo = FolderContextRepository(db)
        self.entity_service = EntityExtractionService()
        self.timeline_service = TimelineService()

    def get_folder_context(
        self, folder_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[FolderContextDto]:
        """Fetches active folder context for a folder."""
        category = self.category_repo.get_by_id(folder_id)
        if not category or category.IsDeleted:
            return None

        ctx = self.context_repo.get_by_folder_id(folder_id, user_id)
        if not ctx:
            return None

        return self._map_to_dto(ctx, category.Name)

    def generate_folder_context(
        self,
        folder_id: uuid.UUID,
        user_id: uuid.UUID,
        force_regenerate: bool = False,
    ) -> Optional[FolderContextDto]:
        """
        Generates or refreshes knowledge context for a single folder.
        Does NOT regenerate all folders.
        """
        category = self.category_repo.get_by_id(folder_id)
        if not category or category.IsDeleted:
            return None

        # Fetch screenshots for this specific folder and user
        screenshots = self.screenshot_repo.get_by_category_and_user(folder_id, user_id)

        # Handle empty folder case gracefully
        if not screenshots:
            summary = (
                f"Smart Folder '{category.Name}' currently contains no screenshots. "
                "Add or classify screenshots into this folder to automatically synthesize "
                "executive knowledge summaries, action items, and timelines."
            )
            empty_entities = ExtractedEntitiesDto()
            upserted = self.context_repo.upsert_context(
                folder_id=folder_id,
                user_id=user_id,
                summary=summary,
                topics=[],
                entities=empty_entities.model_dump(),
                tasks=[],
                timeline=[],
                confidence=0.0,
                screenshots_analyzed=0,
            )
            return self._map_to_dto(upserted, category.Name)

        # 1. Entity Extraction per screenshot & recording occurrences
        entities_per_screenshot: Dict[str, ExtractedEntitiesDto] = {}
        for s in screenshots:
            extracted = self.entity_service.extract_entities(s.OCRText or "")
            entities_per_screenshot[str(s.Id)] = extracted
            # Record occurrences in EntityOccurrences table
            self.context_repo.record_entity_occurrences(
                folder_id=folder_id,
                screenshot_id=s.Id,
                entities_dict=extracted.model_dump(),
            )

        # 2. Merge and Aggregate Entities
        merged_entities = self._merge_entities(list(entities_per_screenshot.values()))

        # 3. Detect Recurring Topics
        topics = self._detect_topics(screenshots)

        # 4. Extract Tasks, Meetings & Deadlines
        tasks = self._extract_tasks(screenshots)

        # 5. Build Chronological Timeline (oldest -> newest)
        timeline = self.timeline_service.generate_timeline(
            screenshots, entities_per_screenshot
        )

        # 6. Calculate Confidence
        confidence = self._calculate_confidence(screenshots, merged_entities)

        # 7. Generate Executive Summary
        summary = self._synthesize_summary(
            category_name=category.Name,
            screenshots=screenshots,
            topics=topics,
            entities=merged_entities,
            tasks=tasks,
        )

        # 8. Upsert Context record in SQLite/SQL Server (increments Version if existing)
        tasks_dicts = [t.model_dump(mode="json") for t in tasks]
        timeline_dicts = [
            {
                "timestamp": ev.timestamp.isoformat(),
                "screenshotId": str(ev.screenshotId),
                "fileName": ev.fileName,
                "eventTitle": ev.eventTitle,
                "eventDescription": ev.eventDescription,
                "eventType": ev.eventType,
            }
            for ev in timeline
        ]

        saved_ctx = self.context_repo.upsert_context(
            folder_id=folder_id,
            user_id=user_id,
            summary=summary,
            topics=topics,
            entities=merged_entities.model_dump(),
            tasks=tasks_dicts,
            timeline=timeline_dicts,
            confidence=confidence,
            screenshots_analyzed=len(screenshots),
        )

        # 9. Save Atomic Context Insights
        insights = [
            {"insightType": "summary", "value": summary[:500], "confidence": confidence},
            {
                "insightType": "metric",
                "value": f"{len(screenshots)} screenshots analyzed across {len(topics)} topics",
                "confidence": 1.0,
            },
        ]
        if tasks:
            insights.append({
                "insightType": "action_item",
                "value": f"{len(tasks)} actionable tasks identified; next: '{tasks[0].title}'",
                "confidence": 0.95,
            })
        if merged_entities.amounts:
            insights.append({
                "insightType": "payment",
                "value": f"Key financial amounts detected: {', '.join(merged_entities.amounts[:3])}",
                "confidence": 0.90,
            })
        self.context_repo.save_insights(saved_ctx.Id, insights)

        return self._map_to_dto(saved_ctx, category.Name)

    def get_recent_contexts(
        self, user_id: uuid.UUID, limit: int = 10
    ) -> List[RecentContextDto]:
        """Returns list of recently generated/updated folder contexts."""
        contexts = self.context_repo.get_recent_contexts(user_id, limit)
        results: List[RecentContextDto] = []
        for ctx in contexts:
            folder_name = ctx.folder.Name if ctx.folder else "Folder"
            results.append(
                RecentContextDto(
                    id=ctx.Id,
                    folderId=ctx.FolderId,
                    folderName=folder_name,
                    summary=ctx.Summary,
                    confidence=ctx.Confidence,
                    version=ctx.Version,
                    screenshotsAnalyzed=ctx.ScreenshotsAnalyzed,
                    generatedOn=ctx.GeneratedOn,
                )
            )
        return results

    def get_timeline(
        self, folder_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[TimelineEventDto]:
        """Returns sorted chronological timeline events for a folder."""
        ctx = self.get_folder_context(folder_id, user_id)
        if not ctx:
            # Auto-generate if not present
            ctx = self.generate_folder_context(folder_id, user_id)
        return ctx.timeline if ctx else []

    def get_entities(
        self, folder_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[FolderEntitiesDto]:
        """Returns grouped structured entities with occurrence frequencies for a folder."""
        category = self.category_repo.get_by_id(folder_id)
        if not category or category.IsDeleted:
            return None

        occurrences = self.context_repo.get_entity_occurrences_by_folder(folder_id)
        grouped: Dict[str, Dict[str, int]] = {}

        for occ in occurrences:
            if occ.EntityType not in grouped:
                grouped[occ.EntityType] = {}
            grouped[occ.EntityType][occ.Entity] = (
                grouped[occ.EntityType].get(occ.Entity, 0) + occ.Count
            )

        result_grouped: Dict[str, List[EntityItemDto]] = {}
        total = 0
        for entity_type, counts in grouped.items():
            sorted_items = sorted(counts.items(), key=lambda x: x[1], reverse=True)
            result_grouped[entity_type] = [
                EntityItemDto(entity=k, count=v) for k, v in sorted_items
            ]
            total += sum(counts.values())

        return FolderEntitiesDto(
            folderId=folder_id,
            folderName=category.Name,
            entities=result_grouped,
            totalCount=total,
        )

    def search_context_knowledge(
        self, user_id: uuid.UUID, query: str, limit: int = 20
    ) -> List[ContextSearchResultDto]:
        """Searches across folder summaries, topics, entities, tasks, and timeline events."""
        if not query or not query.strip():
            return []

        search_tuples = self.context_repo.search_contexts(user_id, query, limit)
        results: List[ContextSearchResultDto] = []

        for ctx, matched_field, snippet in search_tuples:
            folder_name = ctx.folder.Name if ctx.folder else "Folder"
            results.append(
                ContextSearchResultDto(
                    folderId=ctx.FolderId,
                    folderName=folder_name,
                    contextId=ctx.Id,
                    matchedField=matched_field,
                    matchedSnippet=snippet,
                    score=1.0,
                )
            )
        return results

    # -------------------------------------------------------------------------
    # Internal Aggregation & NLP Helpers
    # -------------------------------------------------------------------------

    def _merge_entities(
        self, entities_list: List[ExtractedEntitiesDto]
    ) -> ExtractedEntitiesDto:
        """Merges multiple ExtractedEntitiesDto into a unified deduplicated DTO."""
        merged = ExtractedEntitiesDto()
        for field in [
            "amounts", "urls", "emails", "phoneNumbers", "merchants",
            "projectNames", "dates", "organizations", "people", "upiIds",
            "bankAccounts", "invoiceNumbers", "ticketNumbers", "shoppingItems",
            "documentIds",
        ]:
            combined: List[str] = []
            for item in entities_list:
                val = getattr(item, field, None)
                if val and isinstance(val, list):
                    combined.extend(val)
            # Deduplicate preserving order
            seen = set()
            deduped = []
            for x in combined:
                clean = str(x).strip()
                if clean and clean.lower() not in seen:
                    seen.add(clean.lower())
                    deduped.append(clean)
            setattr(merged, field, deduped[:15])

        return merged

    def _detect_topics(self, screenshots: List[Screenshot]) -> List[str]:
        """Extracts recurring topical themes across OCR text streams."""
        tokens: List[str] = []
        for s in screenshots:
            text = (s.OCRText or "")
            words = re.findall(r"\b[A-Za-z]{3,20}\b", text.lower())
            tokens.extend([w for w in words if w not in self.STOP_WORDS])

            # Also add subcategory / detected app as strong topic signals
            if s.SubCategory:
                tokens.append(s.SubCategory.lower())
            if s.DetectedApp:
                tokens.append(s.DetectedApp.lower())

        counts = Counter(tokens)
        common = [word.title() for word, cnt in counts.most_common(12) if cnt >= 1]
        return common[:8]

    def _extract_tasks(self, screenshots: List[Screenshot]) -> List[ContextTaskDto]:
        """Extracts actionable tasks, todos, deadlines, and meetings from screenshots."""
        tasks: List[ContextTaskDto] = []
        seen_titles = set()

        for s in screenshots:
            ocr_text = s.OCRText or ""
            if not ocr_text:
                continue

            for pattern in self.TASK_PATTERNS:
                for match in pattern.finditer(ocr_text):
                    raw_task = match.group(1).strip()
                    # Clean task text
                    clean_task = re.sub(r"\s+", " ", raw_task).strip(" -:;,.")
                    if len(clean_task) < 5 or len(clean_task) > 120:
                        continue
                    if clean_task.lower() in seen_titles:
                        continue
                    seen_titles.add(clean_task.lower())

                    # Priority detection
                    priority = "medium"
                    if re.search(r"\b(urgent|asap|important|critical|overdue|immediately)\b", clean_task, re.IGNORECASE):
                        priority = "high"
                    elif re.search(r"\b(low|someday|optional|whenever)\b", clean_task, re.IGNORECASE):
                        priority = "low"

                    # Due date extraction
                    due_date = None
                    date_match = re.search(
                        r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})\b",
                        clean_task,
                        re.IGNORECASE,
                    )
                    if date_match:
                        due_date = date_match.group(0)

                    task_id = f"task_{uuid.uuid4().hex[:8]}"
                    tasks.append(
                        ContextTaskDto(
                            id=task_id,
                            title=clean_task,
                            status="pending",
                            priority=priority,
                            dueDate=due_date,
                            sourceScreenshotId=s.Id,
                        )
                    )
                    if len(tasks) >= 12:
                        break
            if len(tasks) >= 12:
                break

        return tasks

    def _calculate_confidence(
        self, screenshots: List[Screenshot], entities: ExtractedEntitiesDto
    ) -> float:
        """Calculates aggregate context confidence score between 0.0 and 1.0."""
        if not screenshots:
            return 0.0

        avg_screenshot_conf = sum(s.Confidence for s in screenshots) / len(screenshots)
        ocr_ratio = sum(1 for s in screenshots if s.OCRText and len(s.OCRText.strip()) > 15) / len(screenshots)

        entity_count = (
            len(entities.amounts) + len(entities.organizations) + len(entities.dates)
            + len(entities.invoiceNumbers) + len(entities.projectNames)
        )
        entity_bonus = min(0.15, entity_count * 0.02)

        conf = (avg_screenshot_conf * 0.5) + (ocr_ratio * 0.35) + entity_bonus
        return round(min(0.98, max(0.35, conf)), 2)

    def _synthesize_summary(
        self,
        category_name: str,
        screenshots: List[Screenshot],
        topics: List[str],
        entities: ExtractedEntitiesDto,
        tasks: List[ContextTaskDto],
    ) -> str:
        """Deterministically synthesizes an executive knowledge summary."""
        count = len(screenshots)
        sentences = [
            f"Smart Folder '{category_name}' aggregates {count} screenshot{'s' if count != 1 else ''}."
        ]

        # Topics sentence
        if topics:
            topics_str = ", ".join(topics[:4])
            sentences.append(f"Key identified themes include {topics_str}.")

        # Financial / Transactions sentence
        if entities.amounts or entities.invoiceNumbers or entities.upiIds:
            fin_details = []
            if entities.amounts:
                fin_details.append(f"{len(entities.amounts)} transaction amounts (e.g., {entities.amounts[0]})")
            if entities.invoiceNumbers:
                fin_details.append(f"invoices/receipts referenced ({entities.invoiceNumbers[0]})")
            if entities.organizations:
                fin_details.append(f"merchants including {entities.organizations[0]}")
            sentences.append(f"Financial summary captures {', '.join(fin_details)}.")

        # Document reference sentence
        if entities.documentIds or entities.ticketNumbers:
            docs = []
            if entities.documentIds:
                docs.append(f"{len(entities.documentIds)} official IDs ({entities.documentIds[0]})")
            if entities.ticketNumbers:
                docs.append(f"tickets/bookings ({entities.ticketNumbers[0]})")
            sentences.append(f"Identified official references: {', '.join(docs)}.")

        # Action items sentence
        if tasks:
            sentences.append(
                f"Contains {len(tasks)} actionable task{'s' if len(tasks) != 1 else ''}, including '{tasks[0].title}'."
            )

        return " ".join(sentences)

    def _map_to_dto(self, ctx: FolderContext, folder_name: str) -> FolderContextDto:
        """Maps database FolderContext entity to FolderContextDto."""
        topics = json.loads(ctx.TopicsJson) if ctx.TopicsJson else []
        entities_dict = json.loads(ctx.EntitiesJson) if ctx.EntitiesJson else {}
        tasks_dicts = json.loads(ctx.TasksJson) if ctx.TasksJson else []
        timeline_dicts = json.loads(ctx.TimelineJson) if ctx.TimelineJson else []

        tasks = [ContextTaskDto(**t) for t in tasks_dicts]
        timeline = [
            TimelineEventDto(
                timestamp=datetime.fromisoformat(ev["timestamp"]) if isinstance(ev["timestamp"], str) else ev["timestamp"],
                screenshotId=uuid.UUID(ev["screenshotId"]) if isinstance(ev["screenshotId"], str) else ev["screenshotId"],
                fileName=ev["fileName"],
                eventTitle=ev["eventTitle"],
                eventDescription=ev["eventDescription"],
                eventType=ev["eventType"],
            )
            for ev in timeline_dicts
        ]

        return FolderContextDto(
            id=ctx.Id,
            folderId=ctx.FolderId,
            folderName=folder_name,
            summary=ctx.Summary,
            topics=topics,
            entities=ExtractedEntitiesDto(**entities_dict),
            tasks=tasks,
            timeline=timeline,
            confidence=ctx.Confidence,
            version=ctx.Version,
            screenshotsAnalyzed=ctx.ScreenshotsAnalyzed,
            generatedOn=ctx.GeneratedOn,
        )

import math
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.screenshot import Screenshot
from app.repositories.category_repository import CategoryRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.repositories.classification_repository import ClassificationRepository
from app.services.classification_service import ClassificationService
from app.services.search_index_service import SearchIndexService
from app.schemas.screenshot import (
    ScreenshotUploadMetadataRequest,
    ScreenshotSyncRequest,
    ScreenshotDetailDto,
    ScreenshotSummaryDto,
    ScreenshotUpdateDto,
    PagedScreenshotsDto,
    SyncBatchResponseDto,
)
from app.schemas.classification import (
    ClassificationResultDto,
    ExtractedEntitiesDto,
)


class ScreenshotService:
    """Core orchestration service for screenshot ingestion, classification, and management."""

    def __init__(self, db: Session):
        self.db = db
        self.screenshot_repo = ScreenshotRepository(db)
        self.category_repo = CategoryRepository(db)
        self.classification_repo = ClassificationRepository(db)
        self.classification_service = ClassificationService()
        self.search_service = SearchIndexService(db)

    def upload_metadata(
        self, user_id: uuid.UUID, req: ScreenshotUploadMetadataRequest
    ) -> ScreenshotDetailDto:
        """
        Receives screenshot metadata from client ML Kit OCR pipeline.
        Enforces idempotent SHA-256 deduplication per user.
        If duplicate exists, returns existing entity with isDuplicate=True without mutating DB.
        If new, runs AI classification engine, builds category hierarchy, and indexes metadata.
        """
        # Ensure system categories are seeded
        self.category_repo.seed_system_categories_if_empty()

        # 1. Deduplication check
        existing = self.screenshot_repo.get_by_user_and_hash(user_id, req.sha256Hash)
        if existing:
            detail = self._map_detail_dto(existing)
            detail.isDuplicate = True
            # Reconstruct classification representation
            detail.classification = self._synthesize_classification(existing)
            return detail

        # 2. Run Classification Engine
        raw_ocr = req.extractedText or req.ocrText or ""
        ocr_combined = (raw_ocr + " " + (req.normalizedText or "")).strip()
        classification = self.classification_service.classify(
            ocr_text=ocr_combined,
            file_name=req.fileName,
            detected_app=req.detectedApp,
        )

        # 3. Resolve canonical primary category and build hierarchy tree
        canonical_category = self.category_repo.get_by_name(classification.category)
        if not canonical_category:
            canonical_category = self.category_repo.find_or_create_by_path([classification.category])

        folder_path = classification.folderPath if classification.folderPath else [classification.category]
        self.category_repo.find_or_create_by_path(folder_path, user_id=user_id)
        classification.categoryId = canonical_category.Id

        # 4. Insert Screenshot Entity
        new_screenshot = Screenshot(
            Id=uuid.uuid4(),
            UserId=user_id,
            CategoryId=canonical_category.Id,
            SubCategory=classification.subCategory,
            FileName=req.fileName,
            OCRText=raw_ocr,
            NormalizedText=req.normalizedText,
            SHA256Hash=req.sha256Hash,
            DeviceFolder=req.deviceFolder,
            DetectedApp=classification.detectedApp or req.detectedApp,
            Width=req.width,
            Height=req.height,
            MimeType=req.mimeType,
            Confidence=classification.confidence,
            IsFavorite=False,
            IsReviewed=False,
            IsDeleted=False,
            CreatedOn=datetime.now(timezone.utc),
        )
        self.screenshot_repo.create(new_screenshot)
        classification.screenshotId = new_screenshot.Id

        # 5. Link Tags
        if classification.suggestedTags:
            self.screenshot_repo.assign_tags(new_screenshot, classification.suggestedTags, user_id)

        # 6. Audit Trail Ledger
        self.classification_repo.record_event(
            screenshot_id=new_screenshot.Id,
            user_id=user_id,
            category=classification.category,
            sub_category=classification.subCategory,
            tags=classification.suggestedTags,
            entities=classification.entities.model_dump(),
            confidence=classification.confidence,
            model_name=classification.modelName,
        )

        # 7. Search Index
        self.search_service.index_screenshot(
            screenshot_id=new_screenshot.Id,
            user_id=user_id,
            file_name=new_screenshot.FileName,
            ocr_text=new_screenshot.OCRText,
            category_name=canonical_category.Name,
            sub_category=new_screenshot.SubCategory,
            tags=classification.suggestedTags,
            detected_app=new_screenshot.DetectedApp,
        )

        # 8. Increment Category Counter
        self.category_repo.increment_screenshot_count(canonical_category.Id, 1)

        # 9. Return Detail DTO
        detail = self._map_detail_dto(new_screenshot)
        detail.classification = classification
        detail.isDuplicate = False
        return detail

    def sync_batch(
        self, user_id: uuid.UUID, req: ScreenshotSyncRequest
    ) -> SyncBatchResponseDto:
        """Batch ingestion supporting offline sync queue flush."""
        inserted_count = 0
        duplicate_count = 0
        results: List[ScreenshotDetailDto] = []

        for item in req.screenshots:
            detail = self.upload_metadata(user_id, item)
            results.append(detail)
            if detail.isDuplicate:
                duplicate_count += 1
            else:
                inserted_count += 1

        return SyncBatchResponseDto(
            processedCount=len(req.screenshots),
            insertedCount=inserted_count,
            duplicateCount=duplicate_count,
            results=results,
        )

    def get_screenshot(self, user_id: uuid.UUID, screenshot_id: uuid.UUID) -> ScreenshotDetailDto:
        sc = self.screenshot_repo.get_by_id_and_user(screenshot_id, user_id)
        if not sc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")
        detail = self._map_detail_dto(sc)
        detail.classification = self._synthesize_classification(sc)
        return detail

    def list_screenshots(
        self,
        user_id: uuid.UUID,
        category_id: Optional[uuid.UUID] = None,
        sub_category: Optional[str] = None,
        tag: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        is_reviewed: Optional[bool] = None,
        search_term: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PagedScreenshotsDto:
        items, total = self.screenshot_repo.list_paged(
            user_id=user_id,
            category_id=category_id,
            sub_category=sub_category,
            tag=tag,
            is_favorite=is_favorite,
            is_reviewed=is_reviewed,
            search_term=search_term,
            page=page,
            page_size=page_size,
        )
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        summary_items = [self._map_summary_dto(item) for item in items]
        return PagedScreenshotsDto(
            items=summary_items,
            totalCount=total,
            page=page,
            pageSize=page_size,
            totalPages=total_pages,
        )

    def update_screenshot(
        self, user_id: uuid.UUID, screenshot_id: uuid.UUID, req: ScreenshotUpdateDto
    ) -> ScreenshotDetailDto:
        sc = self.screenshot_repo.get_by_id_and_user(screenshot_id, user_id)
        if not sc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")

        old_cat_id = sc.CategoryId

        if req.categoryId is not None:
            new_cat = self.category_repo.get_by_id(req.categoryId)
            if not new_cat or new_cat.IsDeleted:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target category does not exist")
            sc.CategoryId = req.categoryId
            if old_cat_id and old_cat_id != req.categoryId:
                self.category_repo.decrement_screenshot_count(old_cat_id, 1)
                self.category_repo.increment_screenshot_count(req.categoryId, 1)

        if req.subCategory is not None:
            sc.SubCategory = req.subCategory
        if req.isFavorite is not None:
            sc.IsFavorite = req.isFavorite
        if req.isReviewed is not None:
            sc.IsReviewed = req.isReviewed

        sc.UpdatedOn = datetime.now(timezone.utc)
        self.screenshot_repo.update(sc)

        if req.tags is not None:
            self.screenshot_repo.assign_tags(sc, req.tags, user_id)

        # Refresh search index
        cat_name = sc.category.Name if sc.category else "Unsorted"
        tag_names = [t.Name for t in sc.tags]
        self.search_service.index_screenshot(
            screenshot_id=sc.Id,
            user_id=user_id,
            file_name=sc.FileName,
            ocr_text=sc.OCRText,
            category_name=cat_name,
            sub_category=sc.SubCategory,
            tags=tag_names,
            detected_app=sc.DetectedApp,
        )

        detail = self._map_detail_dto(sc)
        detail.classification = self._synthesize_classification(sc)
        return detail

    def toggle_favorite(self, user_id: uuid.UUID, screenshot_id: uuid.UUID) -> bool:
        sc = self.screenshot_repo.get_by_id_and_user(screenshot_id, user_id)
        if not sc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")
        sc.IsFavorite = not sc.IsFavorite
        sc.UpdatedOn = datetime.now(timezone.utc)
        self.screenshot_repo.update(sc)
        return sc.IsFavorite

    def toggle_review(self, user_id: uuid.UUID, screenshot_id: uuid.UUID) -> bool:
        sc = self.screenshot_repo.get_by_id_and_user(screenshot_id, user_id)
        if not sc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")
        sc.IsReviewed = not sc.IsReviewed
        sc.UpdatedOn = datetime.now(timezone.utc)
        self.screenshot_repo.update(sc)
        return sc.IsReviewed

    def delete_screenshot(self, user_id: uuid.UUID, screenshot_id: uuid.UUID) -> bool:
        sc = self.screenshot_repo.get_by_id_and_user(screenshot_id, user_id)
        if not sc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")
        if sc.CategoryId:
            self.category_repo.decrement_screenshot_count(sc.CategoryId, 1)
        return self.screenshot_repo.soft_delete(screenshot_id, user_id)

    def reclassify(
        self,
        user_id: uuid.UUID,
        screenshot_id: uuid.UUID,
        user_hint: Optional[str] = None,
        force_category: Optional[str] = None,
        force_sub_category: Optional[str] = None,
    ) -> ClassificationResultDto:
        sc = self.screenshot_repo.get_by_id_and_user(screenshot_id, user_id)
        if not sc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")

        # Run classification engine
        combined_text = f"{sc.OCRText or ''} {user_hint or ''}".strip()
        result = self.classification_service.classify(
            ocr_text=combined_text,
            file_name=sc.FileName,
            detected_app=sc.DetectedApp,
            hint=user_hint,
        )

        if force_category:
            result.category = force_category
            result.folderPath = [force_category]
        if force_sub_category:
            result.subCategory = force_sub_category
            if len(result.folderPath) > 1:
                result.folderPath[1] = force_sub_category
            else:
                result.folderPath.append(force_sub_category)

        # Resolve category entity
        old_cat_id = sc.CategoryId
        canonical_category = self.category_repo.get_by_name(result.category)
        if not canonical_category:
            canonical_category = self.category_repo.find_or_create_by_path([result.category])
        self.category_repo.find_or_create_by_path(result.folderPath, user_id=user_id)
        result.categoryId = canonical_category.Id
        result.screenshotId = sc.Id

        # Update screenshot record
        sc.CategoryId = canonical_category.Id
        sc.SubCategory = result.subCategory
        sc.Confidence = result.confidence
        sc.UpdatedOn = datetime.now(timezone.utc)
        self.screenshot_repo.update(sc)

        if old_cat_id != canonical_category.Id:
            if old_cat_id:
                self.category_repo.decrement_screenshot_count(old_cat_id, 1)
            self.category_repo.increment_screenshot_count(canonical_category.Id, 1)

        # Assign tags
        if result.suggestedTags:
            self.screenshot_repo.assign_tags(sc, result.suggestedTags, user_id)

        # Record audit event
        self.classification_repo.record_event(
            screenshot_id=sc.Id,
            user_id=user_id,
            category=result.category,
            sub_category=result.subCategory,
            tags=result.suggestedTags,
            entities=result.entities.model_dump(),
            confidence=result.confidence,
            model_name="RuleEngine-v1.0-reclassify",
        )

        # Update search index
        tag_names = [t.Name for t in sc.tags]
        self.search_service.index_screenshot(
            screenshot_id=sc.Id,
            user_id=user_id,
            file_name=sc.FileName,
            ocr_text=sc.OCRText,
            category_name=canonical_category.Name,
            sub_category=sc.SubCategory,
            tags=tag_names,
            detected_app=sc.DetectedApp,
        )

        return result

    def _map_summary_dto(self, sc: Screenshot) -> ScreenshotSummaryDto:
        tag_names = [t.Name for t in sc.tags] if sc.tags else []
        snippet = (sc.OCRText or "")[:120].strip() if sc.OCRText else None
        return ScreenshotSummaryDto(
            id=sc.Id,
            fileName=sc.FileName,
            sha256Hash=sc.SHA256Hash,
            categoryId=sc.CategoryId,
            categoryName=sc.category.Name if sc.category else None,
            categoryColor=sc.category.Color if sc.category else None,
            categoryIcon=sc.category.Icon if sc.category else None,
            subCategory=sc.SubCategory,
            detectedApp=sc.DetectedApp,
            confidence=sc.Confidence,
            isFavorite=sc.IsFavorite,
            isReviewed=sc.IsReviewed,
            createdOn=sc.CreatedOn,
            tags=tag_names,
            textSnippet=snippet,
        )

    def _map_detail_dto(self, sc: Screenshot) -> ScreenshotDetailDto:
        tag_names = [t.Name for t in sc.tags] if sc.tags else []
        snippet = (sc.OCRText or "")[:120].strip() if sc.OCRText else None
        return ScreenshotDetailDto(
            id=sc.Id,
            userId=sc.UserId,
            fileName=sc.FileName,
            sha256Hash=sc.SHA256Hash,
            categoryId=sc.CategoryId,
            categoryName=sc.category.Name if sc.category else None,
            categoryColor=sc.category.Color if sc.category else None,
            categoryIcon=sc.category.Icon if sc.category else None,
            categoryPath=sc.category.Path if sc.category else None,
            subCategory=sc.SubCategory,
            detectedApp=sc.DetectedApp,
            confidence=sc.Confidence,
            isFavorite=sc.IsFavorite,
            isReviewed=sc.IsReviewed,
            createdOn=sc.CreatedOn,
            updatedOn=sc.UpdatedOn,
            tags=tag_names,
            textSnippet=snippet,
            ocrText=sc.OCRText,
            normalizedText=sc.NormalizedText,
            deviceFolder=sc.DeviceFolder,
            width=sc.Width,
            height=sc.Height,
            mimeType=sc.MimeType,
            classification=None,
            isDuplicate=False,
        )

    def _synthesize_classification(self, sc: Screenshot) -> ClassificationResultDto:
        cat_name = sc.category.Name if sc.category else "Unsorted"
        tag_names = [t.Name for t in sc.tags] if sc.tags else []
        entities = self.classification_service.extract_entities(sc.OCRText or "")
        folder_path = [cat_name]
        if sc.SubCategory:
            folder_path.append(sc.SubCategory)
        return ClassificationResultDto(
            screenshotId=sc.Id,
            category=cat_name,
            categoryId=sc.CategoryId,
            subCategory=sc.SubCategory,
            folderPath=folder_path,
            confidence=sc.Confidence,
            detectedApp=sc.DetectedApp,
            suggestedTags=tag_names,
            entities=entities,
            summary=f"Screenshot categorized under {cat_name}.",
            modelName="RuleEngine-v1.0",
        )

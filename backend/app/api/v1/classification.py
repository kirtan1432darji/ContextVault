import json
import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.classification_service import ClassificationService
from app.services.screenshot_service import ScreenshotService
from app.repositories.classification_repository import ClassificationRepository
from app.schemas.api_response import ApiResponse
from app.schemas.classification import (
    ClassifyRequest,
    ReclassifyRequest,
    ClassificationResultDto,
    ClassificationHistoryDto,
)

router = APIRouter(prefix="/classification", tags=["Classification"])


@router.post(
    "/classify",
    response_model=ApiResponse[ClassificationResultDto],
    summary="Run classification engine on raw OCR text and metadata without persisting",
)
def classify_text(
    request: ClassifyRequest,
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ClassificationResultDto]:
    """Evaluates OCR text against rules and entities to produce category recommendation."""
    service = ClassificationService()
    result = service.classify(
        ocr_text=request.ocrText,
        file_name=request.fileName,
        detected_app=request.detectedApp,
        hint=request.hint,
    )
    return ApiResponse.ok(data=result, message="Text classified successfully.")


@router.post(
    "/reclassify",
    response_model=ApiResponse[ClassificationResultDto],
    summary="Reclassify an existing screenshot with updated user hint or manual override",
)
def reclassify_screenshot(
    request: ReclassifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ClassificationResultDto]:
    service = ScreenshotService(db)
    updated = service.reclassify(
        user_id=current_user.Id,
        screenshot_id=request.screenshotId,
        user_hint=request.userHint,
        force_category=request.forceCategory,
        force_sub_category=request.forceSubCategory,
    )
    return ApiResponse.ok(data=updated, message="Screenshot reclassified successfully.")


@router.get(
    "/history/{screenshot_id}",
    response_model=ApiResponse[List[ClassificationHistoryDto]],
    summary="Retrieve audit trail history of classification runs for a screenshot",
)
def get_classification_history(
    screenshot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[List[ClassificationHistoryDto]]:
    repo = ClassificationRepository(db)
    events = repo.get_by_screenshot(screenshot_id)
    history_dtos = []
    for ev in events:
        tags = json.loads(ev.TagsJson) if ev.TagsJson else []
        entities = json.loads(ev.EntitiesJson) if ev.EntitiesJson else {}
        history_dtos.append(
            ClassificationHistoryDto(
                id=ev.Id,
                screenshotId=ev.ScreenshotId,
                category=ev.Category,
                subCategory=ev.SubCategory,
                tags=tags,
                entities=entities,
                confidence=ev.Confidence,
                modelName=ev.ModelName,
                createdOn=ev.CreatedOn,
            )
        )
    return ApiResponse.ok(data=history_dtos, message="Classification history retrieved successfully.")

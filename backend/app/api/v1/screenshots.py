import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.screenshot_service import ScreenshotService
from app.schemas.api_response import ApiResponse
from app.schemas.screenshot import (
    ScreenshotUploadMetadataRequest,
    ScreenshotSyncRequest,
    ScreenshotDetailDto,
    ScreenshotUpdateDto,
    PagedScreenshotsDto,
    SyncBatchResponseDto,
)

router = APIRouter(prefix="/screenshots", tags=["Screenshots"])


@router.post(
    "/upload-metadata",
    response_model=ApiResponse[ScreenshotDetailDto],
    status_code=status.HTTP_201_CREATED,
    summary="Ingest screenshot metadata from on-device OCR pipeline",
)
def upload_metadata(
    request: ScreenshotUploadMetadataRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ScreenshotDetailDto]:
    """
    Receives non-binary screenshot metadata.
    Enforces SHA-256 deduplication per user.
    Auto-categorizes, links entities, and records audit trail.
    """
    service = ScreenshotService(db)
    detail = service.upload_metadata(current_user.Id, request)
    msg = "Existing screenshot detected (deduplicated)." if detail.isDuplicate else "Screenshot metadata processed and categorized."
    return ApiResponse.ok(data=detail, message=msg)


@router.post(
    "/sync",
    response_model=ApiResponse[SyncBatchResponseDto],
    summary="Batch upload and synchronize queued offline screenshots",
)
def sync_batch(
    request: ScreenshotSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SyncBatchResponseDto]:
    service = ScreenshotService(db)
    result = service.sync_batch(current_user.Id, request)
    return ApiResponse.ok(
        data=result,
        message=f"Processed {result.processedCount} screenshots ({result.insertedCount} inserted, {result.duplicateCount} duplicates).",
    )


@router.get(
    "",
    response_model=ApiResponse[PagedScreenshotsDto],
    summary="Query screenshots with filters, tags, and pagination",
)
def list_screenshots(
    categoryId: Optional[uuid.UUID] = Query(default=None, description="Filter by Category ID"),
    subCategory: Optional[str] = Query(default=None, description="Filter by Subcategory"),
    tag: Optional[str] = Query(default=None, description="Filter by tag name"),
    isFavorite: Optional[bool] = Query(default=None, description="Filter by favorite flag"),
    isReviewed: Optional[bool] = Query(default=None, description="Filter by reviewed flag"),
    searchTerm: Optional[str] = Query(default=None, description="Search OCR text or file name"),
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    pageSize: int = Query(default=20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[PagedScreenshotsDto]:
    service = ScreenshotService(db)
    paged = service.list_screenshots(
        user_id=current_user.Id,
        category_id=categoryId,
        sub_category=subCategory,
        tag=tag,
        is_favorite=isFavorite,
        is_reviewed=isReviewed,
        search_term=searchTerm,
        page=page,
        page_size=pageSize,
    )
    return ApiResponse.ok(data=paged, message="Screenshots retrieved successfully.")


@router.get(
    "/{screenshot_id}",
    response_model=ApiResponse[ScreenshotDetailDto],
    summary="Get single screenshot detail with tags and classification",
)
def get_screenshot(
    screenshot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ScreenshotDetailDto]:
    service = ScreenshotService(db)
    sc = service.get_screenshot(current_user.Id, screenshot_id)
    return ApiResponse.ok(data=sc, message="Screenshot retrieved successfully.")


@router.put(
    "/{screenshot_id}",
    response_model=ApiResponse[ScreenshotDetailDto],
    summary="Update screenshot category, subcategory, review status, or tags",
)
def update_screenshot(
    screenshot_id: uuid.UUID,
    request: ScreenshotUpdateDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ScreenshotDetailDto]:
    service = ScreenshotService(db)
    updated = service.update_screenshot(current_user.Id, screenshot_id, request)
    return ApiResponse.ok(data=updated, message="Screenshot updated successfully.")


@router.patch(
    "/{screenshot_id}/favorite",
    response_model=ApiResponse[dict],
    summary="Toggle bookmark/favorite status of a screenshot",
)
def toggle_favorite(
    screenshot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    service = ScreenshotService(db)
    new_status = service.toggle_favorite(current_user.Id, screenshot_id)
    return ApiResponse.ok(data={"isFavorite": new_status}, message=f"Screenshot favorite set to {new_status}.")


@router.patch(
    "/{screenshot_id}/review",
    response_model=ApiResponse[dict],
    summary="Toggle reviewed status of a screenshot",
)
def toggle_review(
    screenshot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    service = ScreenshotService(db)
    new_status = service.toggle_review(current_user.Id, screenshot_id)
    return ApiResponse.ok(data={"isReviewed": new_status}, message=f"Screenshot review set to {new_status}.")


@router.delete(
    "/{screenshot_id}",
    response_model=ApiResponse[dict],
    summary="Soft-delete screenshot metadata",
)
def delete_screenshot(
    screenshot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    service = ScreenshotService(db)
    service.delete_screenshot(current_user.Id, screenshot_id)
    return ApiResponse.ok(data={"deleted": True}, message="Screenshot deleted successfully.")

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.context_engine_service import ContextEngineService
from app.schemas.api_response import ApiResponse
from app.schemas.context import (
    FolderContextDto,
    RecentContextDto,
    TimelineEventDto,
    FolderEntitiesDto,
    ContextSearchResultDto,
)

router = APIRouter(prefix="/context", tags=["Folder Context Engine"])


@router.get(
    "/folder/{folderId}",
    response_model=ApiResponse[FolderContextDto],
    summary="Fetch synthesized folder knowledge context",
    description="Retrieves the active, versioned executive summary, structured entities, tasks, and timeline for a folder.",
)
def get_folder_context(
    folderId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[FolderContextDto]:
    service = ContextEngineService(db)
    ctx = service.get_folder_context(folder_id=folderId, user_id=current_user.Id)
    if not ctx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder context not found. Generate context first via POST /api/context/generate/{folderId}.",
        )
    return ApiResponse.ok(data=ctx, message="Folder context retrieved successfully.")


@router.post(
    "/generate/{folderId}",
    response_model=ApiResponse[FolderContextDto],
    status_code=status.HTTP_200_OK,
    summary="Generate or refresh context for a smart folder",
    description="Analyzes all screenshots classified under the given folder and synthesizes an executive summary, extracts tasks, entities, and builds a timeline.",
)
def generate_folder_context(
    folderId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[FolderContextDto]:
    service = ContextEngineService(db)
    ctx = service.generate_folder_context(
        folder_id=folderId, user_id=current_user.Id, force_regenerate=False
    )
    if not ctx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category/Folder {folderId} not found or has been deleted.",
        )
    return ApiResponse.ok(data=ctx, message="Folder context generated successfully.")


@router.post(
    "/regenerate/{folderId}",
    response_model=ApiResponse[FolderContextDto],
    status_code=status.HTTP_200_OK,
    summary="Force regenerate context and increment version counter",
    description="Forces full re-aggregation of all screenshots in the specified folder, increments the version number, and updates search indexes.",
)
def regenerate_folder_context(
    folderId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[FolderContextDto]:
    service = ContextEngineService(db)
    ctx = service.generate_folder_context(
        folder_id=folderId, user_id=current_user.Id, force_regenerate=True
    )
    if not ctx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category/Folder {folderId} not found or has been deleted.",
        )
    return ApiResponse.ok(
        data=ctx, message=f"Folder context regenerated (Version {ctx.version})."
    )


@router.get(
    "/recent",
    response_model=ApiResponse[List[RecentContextDto]],
    summary="Retrieve recently generated or updated folder contexts",
    description="Returns lightweight cards for the most recently synthesized folder knowledge contexts.",
)
def get_recent_contexts(
    limit: int = Query(default=10, ge=1, le=50, description="Maximum items to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[List[RecentContextDto]]:
    service = ContextEngineService(db)
    recent = service.get_recent_contexts(user_id=current_user.Id, limit=limit)
    return ApiResponse.ok(
        data=recent, message=f"Retrieved {len(recent)} recent folder contexts."
    )


@router.get(
    "/search",
    response_model=ApiResponse[List[ContextSearchResultDto]],
    summary="Search across folder knowledge bases",
    description="Searches across folder summaries, topics, entities, tasks, and timeline events for a given query term.",
)
def search_folder_context(
    q: str = Query(..., min_length=1, description="Search query keyword or phrase"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum matches"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[List[ContextSearchResultDto]]:
    service = ContextEngineService(db)
    matches = service.search_context_knowledge(
        user_id=current_user.Id, query=q, limit=limit
    )
    return ApiResponse.ok(
        data=matches, message=f"Found {len(matches)} matching folder context hits."
    )


@router.get(
    "/timeline/{folderId}",
    response_model=ApiResponse[List[TimelineEventDto]],
    summary="Fetch chronological timeline for a folder",
    description="Retrieves chronological timeline events (sorted strictly oldest to newest) synthesizing all screenshots in the folder.",
)
def get_folder_timeline(
    folderId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[List[TimelineEventDto]]:
    service = ContextEngineService(db)
    timeline = service.get_timeline(folder_id=folderId, user_id=current_user.Id)
    return ApiResponse.ok(
        data=timeline,
        message=f"Retrieved {len(timeline)} chronological timeline events.",
    )


@router.get(
    "/entities/{folderId}",
    response_model=ApiResponse[FolderEntitiesDto],
    summary="Fetch structured entity knowledge graph for a folder",
    description="Returns all 14 structured entity categories grouped with their occurrence frequencies across screenshots in the folder.",
)
def get_folder_entities(
    folderId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[FolderEntitiesDto]:
    service = ContextEngineService(db)
    entities = service.get_entities(folder_id=folderId, user_id=current_user.Id)
    if not entities:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category/Folder {folderId} not found.",
        )
    return ApiResponse.ok(
        data=entities,
        message=f"Retrieved {entities.totalCount} entity occurrences across folder.",
    )

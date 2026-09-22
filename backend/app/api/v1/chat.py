import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.chat_engine_service import ChatEngineService
from app.schemas.api_response import ApiResponse
from app.schemas.chat import (
    ChatMessageDto,
    ChatRequestDto,
    ChatSuggestionsDto,
    ChatSessionSummaryDto,
    ChatHistoryResponseDto,
)

router = APIRouter(prefix="/chat", tags=["Context AI Chat Engine"])


@router.post(
    "/message",
    response_model=ApiResponse[ChatMessageDto],
    status_code=status.HTTP_200_OK,
    summary="Send message to Context AI with folder/screenshot grounding",
    description=(
        "Processes user questions with multi-turn context, extracts grounded citations from OCR text "
        "and folder context, and returns a verified answer without uploading image binaries."
    ),
)
def send_chat_message(
    request: ChatRequestDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ChatMessageDto]:
    service = ChatEngineService(db)
    response_dto = service.process_message(user_id=current_user.Id, request=request)
    return ApiResponse.ok(data=response_dto, message="Chat response generated successfully.")


@router.get(
    "/history/{folderId}",
    response_model=ApiResponse[ChatHistoryResponseDto],
    summary="Fetch multi-turn chat history for a smart folder",
    description="Retrieves chronological chat messages and citations for the specified smart folder, optionally filtered by session ID.",
)
def get_chat_history(
    folderId: uuid.UUID,
    sessionId: Optional[uuid.UUID] = Query(None, description="Filter by specific session ID"),
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    pageSize: int = Query(default=50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ChatHistoryResponseDto]:
    service = ChatEngineService(db)
    offset = (page - 1) * pageSize
    history_dto = service.get_history(
        user_id=current_user.Id,
        folder_id=folderId,
        session_id=sessionId,
        limit=pageSize,
        offset=offset,
    )
    return ApiResponse.ok(
        data=history_dto,
        message=f"Retrieved {len(history_dto.messages)} chat messages.",
    )


@router.delete(
    "/history/{folderId}",
    response_model=ApiResponse[int],
    summary="Delete conversation history for a smart folder",
    description="Soft-deletes all chat messages and sessions associated with the specified folder ID.",
)
def delete_chat_history_for_folder(
    folderId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[int]:
    service = ChatEngineService(db)
    count = service.delete_history(user_id=current_user.Id, folder_id=folderId)
    return ApiResponse.ok(
        data=count,
        message=f"Deleted {count} chat message(s) for folder {folderId}.",
    )


@router.get(
    "/suggestions/{folderId}",
    response_model=ApiResponse[ChatSuggestionsDto],
    summary="Fetch dynamic suggested prompts for a smart folder",
    description="Analyzes folder context, entities, and tasks to return relevant prompt suggestion chips for the user.",
)
def get_chat_suggestions(
    folderId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[ChatSuggestionsDto]:
    service = ChatEngineService(db)
    suggestions_dto = service.get_suggestions(
        user_id=current_user.Id, folder_id=folderId
    )
    return ApiResponse.ok(
        data=suggestions_dto,
        message=f"Generated {len(suggestions_dto.suggestions)} contextual suggestions.",
    )


@router.get(
    "/sessions",
    response_model=ApiResponse[List[ChatSessionSummaryDto]],
    summary="List active conversation sessions",
    description="Lists distinct chat sessions, optionally filtered by folderId query parameter.",
)
def list_chat_sessions(
    folderId: Optional[uuid.UUID] = Query(None, description="Optional smart folder ID to filter sessions"),
    limit: int = Query(default=20, ge=1, le=50, description="Maximum sessions to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[List[ChatSessionSummaryDto]]:
    service = ChatEngineService(db)
    sessions = service.get_sessions(
        user_id=current_user.Id, folder_id=folderId, limit=limit
    )
    return ApiResponse.ok(
        data=sessions, message=f"Retrieved {len(sessions)} active chat sessions."
    )


@router.get(
    "/sessions/{folderId}",
    response_model=ApiResponse[List[ChatSessionSummaryDto]],
    summary="List active conversation sessions in a folder",
    description="Lists distinct chat sessions in a folder with last message preview and message count.",
)
def get_folder_chat_sessions(
    folderId: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=50, description="Maximum sessions to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[List[ChatSessionSummaryDto]]:
    service = ChatEngineService(db)
    sessions = service.get_sessions(
        user_id=current_user.Id, folder_id=folderId, limit=limit
    )
    return ApiResponse.ok(
        data=sessions, message=f"Retrieved {len(sessions)} active chat sessions."
    )


@router.delete(
    "/session/{sessionId}",
    response_model=ApiResponse[bool],
    summary="Clear or delete a conversation session",
    description="Soft-deletes all messages associated with the specified session ID.",
)
def delete_chat_session(
    sessionId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[bool]:
    service = ChatEngineService(db)
    deleted = service.delete_session(user_id=current_user.Id, session_id=sessionId)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session {sessionId} not found or already deleted.",
        )
    return ApiResponse.ok(data=True, message="Chat session deleted successfully.")

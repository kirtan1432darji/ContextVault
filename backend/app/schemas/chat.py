import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class ChatMessageCitationDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    screenshotId: uuid.UUID
    fileName: str
    snippet: Optional[str] = None
    thumbnailPath: Optional[str] = None


class ChatMessageDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sessionId: uuid.UUID
    folderId: Optional[uuid.UUID] = None
    screenshotId: Optional[uuid.UUID] = None
    role: str = Field(..., description="Role: 'user', 'assistant', or 'system'")
    content: str
    citations: List[ChatMessageCitationDto] = Field(default_factory=list)
    createdAt: datetime
    suggestedFollowUps: Optional[List[str]] = Field(default_factory=list)
    promptTokens: Optional[int] = None
    completionTokens: Optional[int] = None


class ChatRequestDto(BaseModel):
    sessionId: Optional[uuid.UUID] = Field(
        None, description="Existing session UUID or omit to create a new session"
    )
    folderId: Optional[uuid.UUID] = Field(
        None, description="Category/Smart Folder UUID for grounded contextual retrieval"
    )
    screenshotId: Optional[uuid.UUID] = Field(
        None, description="Optional specific screenshot UUID context"
    )
    content: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="User question or query for Context AI",
    )


class ChatSuggestionsDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    folderId: uuid.UUID
    folderName: str
    suggestions: List[str] = Field(default_factory=list)


class ChatSessionSummaryDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sessionId: uuid.UUID
    folderId: Optional[uuid.UUID] = None
    lastMessage: str
    messageCount: int
    createdAt: datetime
    updatedAt: datetime


class ChatHistoryResponseDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    folderId: Optional[uuid.UUID] = None
    sessionId: Optional[uuid.UUID] = None
    totalCount: int
    messages: List[ChatMessageDto] = Field(default_factory=list)

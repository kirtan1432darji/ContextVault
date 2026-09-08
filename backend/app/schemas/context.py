import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.classification import ExtractedEntitiesDto


class ContextTaskDto(BaseModel):
    id: str = Field(..., description="Unique task identifier")
    title: str = Field(..., description="Actionable task or todo item description")
    status: str = Field(default="pending", description="Task completion status (pending/completed)")
    priority: str = Field(default="medium", description="Task priority (low/medium/high)")
    dueDate: Optional[str] = Field(default=None, description="Extracted due date or deadline string")
    sourceScreenshotId: Optional[uuid.UUID] = Field(default=None, description="Screenshot where task was identified")

    model_config = ConfigDict(from_attributes=True)


class TimelineEventDto(BaseModel):
    timestamp: datetime = Field(..., description="Chronological event timestamp")
    screenshotId: uuid.UUID = Field(..., description="Source screenshot identifier")
    fileName: str = Field(..., description="Source screenshot file name")
    eventTitle: str = Field(..., description="Short descriptive event header")
    eventDescription: str = Field(..., description="Contextual narrative for the event")
    eventType: str = Field(..., description="Event classification (payment, receipt, communication, document, task, note, code, travel)")

    model_config = ConfigDict(from_attributes=True)


class EntityItemDto(BaseModel):
    entity: str = Field(..., description="Normalized entity value")
    count: int = Field(default=1, description="Occurrence frequency count across the folder")

    model_config = ConfigDict(from_attributes=True)


class FolderEntitiesDto(BaseModel):
    folderId: uuid.UUID = Field(..., description="Target category/folder ID")
    folderName: str = Field(..., description="Category/folder name")
    entities: Dict[str, List[EntityItemDto]] = Field(default_factory=dict, description="Grouped entities with frequencies")
    totalCount: int = Field(default=0, description="Total entity occurrences")

    model_config = ConfigDict(from_attributes=True)


class FolderContextDto(BaseModel):
    id: uuid.UUID = Field(..., description="Folder context primary ID")
    folderId: uuid.UUID = Field(..., description="Associated folder/category ID")
    folderName: str = Field(..., description="Associated folder/category name")
    summary: str = Field(..., description="Executive knowledge summary synthesizing the folder")
    topics: List[str] = Field(default_factory=list, description="Recurring detected topics and themes")
    entities: ExtractedEntitiesDto = Field(default_factory=ExtractedEntitiesDto, description="Merged structured entities")
    tasks: List[ContextTaskDto] = Field(default_factory=list, description="Extracted action items and deadlines")
    timeline: List[TimelineEventDto] = Field(default_factory=list, description="Chronological timeline events (oldest to newest)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Aggregate confidence score")
    version: int = Field(..., ge=1, description="Folder context version counter")
    screenshotsAnalyzed: int = Field(..., ge=0, description="Total count of screenshots analyzed")
    generatedOn: datetime = Field(..., description="Timestamp when context was synthesized")

    model_config = ConfigDict(from_attributes=True)


class RecentContextDto(BaseModel):
    id: uuid.UUID = Field(..., description="Folder context ID")
    folderId: uuid.UUID = Field(..., description="Folder category ID")
    folderName: str = Field(..., description="Folder name")
    summary: str = Field(..., description="Brief executive summary")
    confidence: float = Field(..., description="Aggregate confidence score")
    version: int = Field(..., description="Context version")
    screenshotsAnalyzed: int = Field(..., description="Count of screenshots analyzed")
    generatedOn: datetime = Field(..., description="Timestamp of generation")

    model_config = ConfigDict(from_attributes=True)


class ContextSearchResultDto(BaseModel):
    folderId: uuid.UUID = Field(..., description="Matching folder ID")
    folderName: str = Field(..., description="Matching folder name")
    contextId: uuid.UUID = Field(..., description="Context record ID")
    matchedField: str = Field(..., description="Field where match was found (summary/topic/entity/task/timeline)")
    matchedSnippet: str = Field(..., description="Relevant text excerpt containing the search term")
    score: float = Field(default=1.0, description="Relevance ranking score")

    model_config = ConfigDict(from_attributes=True)

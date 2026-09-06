import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.classification import ClassificationResultDto


class ScreenshotUploadMetadataRequest(BaseModel):
    screenshotId: Optional[str] = Field(default=None, description="Client device local identifier / asset ID")
    fileName: str = Field(..., min_length=1, max_length=260, description="Screenshot file name")
    sha256Hash: str = Field(..., min_length=16, max_length=64, description="SHA-256 fingerprint for deduplication")
    timestamp: Optional[str] = Field(default=None, description="Creation timestamp on device")
    extractedText: Optional[str] = Field(default="", description="Raw OCR text extracted on-device via ML Kit")
    normalizedText: Optional[str] = Field(default="", description="Sanitized/normalized text token stream")
    width: int = Field(default=1080, ge=1, description="Pixel width")
    height: int = Field(default=2400, ge=1, description="Pixel height")
    mimeType: str = Field(default="image/png", max_length=50, description="MIME content type")
    deviceFolder: Optional[str] = Field(default=None, max_length=260, description="Source folder on device")
    detectedApp: Optional[str] = Field(default=None, max_length=100, description="App package name or app title")


class ScreenshotSyncRequest(BaseModel):
    screenshots: List[ScreenshotUploadMetadataRequest] = Field(..., description="Batch list of screenshot metadata")


class ScreenshotSummaryDto(BaseModel):
    id: uuid.UUID
    fileName: str
    sha256Hash: str
    categoryId: Optional[uuid.UUID] = None
    categoryName: Optional[str] = None
    categoryColor: Optional[str] = None
    categoryIcon: Optional[str] = None
    subCategory: Optional[str] = None
    detectedApp: Optional[str] = None
    confidence: float = 0.0
    isFavorite: bool = False
    isReviewed: bool = False
    createdOn: datetime
    tags: List[str] = Field(default_factory=list)
    textSnippet: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ScreenshotDetailDto(ScreenshotSummaryDto):
    userId: uuid.UUID
    ocrText: Optional[str] = None
    normalizedText: Optional[str] = None
    deviceFolder: Optional[str] = None
    width: int
    height: int
    mimeType: str
    updatedOn: Optional[datetime] = None
    classification: Optional[ClassificationResultDto] = None
    isDuplicate: bool = False

    model_config = ConfigDict(from_attributes=True)


class ScreenshotUpdateDto(BaseModel):
    categoryId: Optional[uuid.UUID] = Field(default=None, description="Category ID override")
    subCategory: Optional[str] = Field(default=None, max_length=100, description="Subcategory override")
    isFavorite: Optional[bool] = Field(default=None, description="Bookmark state")
    isReviewed: Optional[bool] = Field(default=None, description="Reviewed state")
    tags: Optional[List[str]] = Field(default=None, description="List of tag names")


class PagedScreenshotsDto(BaseModel):
    items: List[ScreenshotSummaryDto]
    totalCount: int
    page: int
    pageSize: int
    totalPages: int


class SyncBatchResponseDto(BaseModel):
    processedCount: int
    insertedCount: int
    duplicateCount: int
    results: List[ScreenshotDetailDto]

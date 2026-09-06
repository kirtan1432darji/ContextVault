from pydantic import BaseModel, Field
from typing import List, Optional, Any, Generic, TypeVar
from datetime import datetime
import uuid

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Operation completed successfully."
    data: Optional[T] = None
    errors: Optional[List[str]] = None

    @classmethod
    def ok(cls, data: T, message: str = "Operation completed successfully."):
        return cls(success=True, message=message, data=data, errors=None)

    @classmethod
    def fail(cls, message: str, errors: Optional[List[str]] = None):
        return cls(success=False, message=message, data=None, errors=errors or [message])

# Auth
class UserRegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class UserLoginRequest(BaseModel):
    emailOrUsername: str
    password: str

class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "Bearer"
    userId: uuid.UUID
    username: str
    email: str

# Screenshots
class ScanScreenshotRequest(BaseModel):
    device_asset_id: Optional[str] = None
    image_id: Optional[str] = None
    file_path: str
    file_name: str
    file_size: int = 0
    captured_date: Optional[str] = None
    created_at: Optional[str] = None
    source_app: Optional[str] = None
    width: int = 1080
    height: int = 2400
    ocr_text: Optional[str] = ""
    vision_description: Optional[str] = None
    hash: Optional[str] = None
    auto_classify: bool = True

class BatchScanScreenshotRequest(BaseModel):
    screenshots: List[ScanScreenshotRequest] = Field(default_factory=list)

class ScreenshotDto(BaseModel):
    id: uuid.UUID
    deviceAssetId: Optional[str] = None
    filePath: str
    fileName: str
    createdAt: datetime
    width: int
    height: int
    fileSize: int
    categoryId: str
    categoryName: str
    subcategory: Optional[str] = ""
    confidence: float
    sourceApp: Optional[str] = None
    isFavorite: bool = False
    isReviewed: bool = False
    isSynced: bool = True
    ocrStatus: str = "completed"
    ocrText: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

# Classification
class ClassifyRequestDto(BaseModel):
    screenshot_id: Optional[str] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    ocr_text: str
    vision_description: Optional[str] = None
    source_app: Optional[str] = None
    existing_category: Optional[str] = None

class ClassificationResponseDto(BaseModel):
    screenshot_id: Optional[str] = None
    category_id: str
    category_name: str
    subcategory: str
    folder_path: List[str] = Field(default_factory=list)
    confidence: float
    detected_app: Optional[str] = None
    suggested_tags: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    is_auto_categorized: bool = True

# Categories
class CategoryDto(BaseModel):
    id: str
    name: str
    parentId: Optional[str] = None
    icon: str
    color: str
    description: Optional[str] = None
    isSystem: bool = True
    displayOrder: int = 0
    screenshotCount: int = 0
    subCategories: List["CategoryDto"] = Field(default_factory=list)

# Context & Chat
class ContextTaskDto(BaseModel):
    id: str
    title: str
    isCompleted: bool = False
    dueDate: Optional[str] = None

class ContextEntityDto(BaseModel):
    name: str
    type: str
    count: int = 1

class FolderContextDto(BaseModel):
    categoryId: str
    categoryName: str
    summary: str
    keywords: List[str] = Field(default_factory=list)
    confidence: float = 0.95
    screenshotCount: int = 0
    lastUpdatedAt: Optional[datetime] = None
    tasks: List[ContextTaskDto] = Field(default_factory=list)
    entities: List[ContextEntityDto] = Field(default_factory=list)
    people: List[str] = Field(default_factory=list)
    links: List[str] = Field(default_factory=list)
    topics: List[str] = Field(default_factory=list)

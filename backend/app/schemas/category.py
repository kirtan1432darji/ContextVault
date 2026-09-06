import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Category name")
    parentId: Optional[uuid.UUID] = Field(default=None, description="Parent category ID for multi-tier nesting")
    icon: str = Field(default="folder-outline", max_length=100, description="Icon identifier")
    color: str = Field(default="#6366F1", max_length=50, description="Hex color code")
    description: Optional[str] = Field(default=None, max_length=500, description="Category description")
    displayOrder: int = Field(default=0, description="Display sorting order")


class CategoryCreateRequest(CategoryBase):
    pass


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    parentId: Optional[uuid.UUID] = None
    icon: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=500)
    displayOrder: Optional[int] = None


class CategoryDto(CategoryBase):
    id: uuid.UUID
    userId: Optional[uuid.UUID] = None
    path: str
    isSystem: bool
    screenshotCount: int
    createdOn: datetime
    updatedOn: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CategoryTreeDto(CategoryDto):
    subCategories: List["CategoryTreeDto"] = Field(default_factory=list, description="Nested child categories")

    model_config = ConfigDict(from_attributes=True)

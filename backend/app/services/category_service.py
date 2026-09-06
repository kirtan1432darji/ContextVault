import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.category import Category
from app.repositories.category_repository import CategoryRepository
from app.schemas.category import (
    CategoryCreateRequest,
    CategoryUpdateRequest,
    CategoryDto,
    CategoryTreeDto,
)


class CategoryService:
    """Service managing categories, hierarchical trees, and taxonomy lifecycle."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = CategoryRepository(db)

    def seed_system_categories(self) -> List[Category]:
        return self.repo.seed_system_categories_if_empty()

    def get_category_tree(self, user_id: Optional[uuid.UUID]) -> List[CategoryTreeDto]:
        self.seed_system_categories()
        roots = self.repo.get_category_tree(user_id)
        return [self._map_tree_node(r) for r in roots]

    def get_categories_flat(self, user_id: Optional[uuid.UUID]) -> List[CategoryDto]:
        self.seed_system_categories()
        categories = self.repo.get_all_for_user(user_id)
        return [self._map_category_dto(c) for c in categories]

    def get_by_id(self, category_id: uuid.UUID) -> Optional[CategoryDto]:
        cat = self.repo.get_by_id(category_id)
        if not cat or cat.IsDeleted:
            return None
        return self._map_category_dto(cat)

    def create_category(self, user_id: uuid.UUID, req: CategoryCreateRequest) -> CategoryDto:
        # Check parent if specified
        parent_path = ""
        if req.parentId:
            parent = self.repo.get_by_id(req.parentId)
            if not parent or parent.IsDeleted:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")
            parent_path = parent.Path

        # Check duplicate sibling name
        existing = self.repo.get_by_name(req.name, req.parentId)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A category with this name already exists in this folder")

        full_path = f"{parent_path}/{req.name}" if parent_path else req.name
        cat = Category(
            Id=uuid.uuid4(),
            UserId=user_id,
            ParentCategoryId=req.parentId,
            Name=req.name,
            Path=full_path,
            Icon=req.icon,
            Color=req.color,
            Description=req.description,
            IsSystem=False,
            DisplayOrder=req.displayOrder,
            ScreenshotCount=0,
            IsDeleted=False,
            CreatedOn=datetime.now(timezone.utc),
        )
        self.repo.create(cat)
        return self._map_category_dto(cat)

    def update_category(
        self, user_id: uuid.UUID, category_id: uuid.UUID, req: CategoryUpdateRequest
    ) -> CategoryDto:
        cat = self.repo.get_by_id(category_id)
        if not cat or cat.IsDeleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        if cat.IsSystem:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System categories cannot be modified")

        if cat.UserId != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this category")

        if req.name is not None:
            cat.Name = req.name
        if req.parentId is not None:
            cat.ParentCategoryId = req.parentId
        if req.icon is not None:
            cat.Icon = req.icon
        if req.color is not None:
            cat.Color = req.color
        if req.description is not None:
            cat.Description = req.description
        if req.displayOrder is not None:
            cat.DisplayOrder = req.displayOrder

        cat.UpdatedOn = datetime.now(timezone.utc)
        self.repo.update(cat)
        return self._map_category_dto(cat)

    def delete_category(self, user_id: uuid.UUID, category_id: uuid.UUID) -> bool:
        cat = self.repo.get_by_id(category_id)
        if not cat or cat.IsDeleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        if cat.IsSystem:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System categories cannot be deleted")

        if cat.UserId != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this category")

        cat.IsDeleted = True
        cat.DeletedOn = datetime.now(timezone.utc)
        self.repo.update(cat)
        return True

    def _map_category_dto(self, c: Category) -> CategoryDto:
        return CategoryDto(
            id=c.Id,
            name=c.Name,
            parentId=c.ParentCategoryId,
            path=c.Path,
            icon=c.Icon,
            color=c.Color,
            description=c.Description,
            isSystem=c.IsSystem,
            displayOrder=c.DisplayOrder,
            screenshotCount=c.ScreenshotCount,
            createdOn=c.CreatedOn,
            updatedOn=c.UpdatedOn,
        )

    def _map_tree_node(self, node: Category) -> CategoryTreeDto:
        children = [self._map_tree_node(ch) for ch in node.sub_categories if not ch.IsDeleted]
        return CategoryTreeDto(
            id=node.Id,
            name=node.Name,
            parentId=node.ParentCategoryId,
            path=node.Path,
            icon=node.Icon,
            color=node.Color,
            description=node.Description,
            isSystem=node.IsSystem,
            displayOrder=node.DisplayOrder,
            screenshotCount=node.ScreenshotCount,
            createdOn=node.CreatedOn,
            updatedOn=node.UpdatedOn,
            subCategories=children,
        )

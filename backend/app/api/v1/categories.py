import uuid
from typing import Optional, List, Union, Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.category_service import CategoryService
from app.schemas.api_response import ApiResponse
from app.schemas.category import (
    CategoryCreateRequest,
    CategoryUpdateRequest,
    CategoryDto,
    CategoryTreeDto,
)

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get(
    "",
    response_model=ApiResponse[Union[List[CategoryTreeDto], List[CategoryDto]]],
    summary="Retrieve canonical and custom category taxonomy",
)
def get_categories(
    tree: bool = Query(default=True, description="Return nested hierarchy tree if true, flat list if false"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_active_user),
) -> ApiResponse[Any]:
    """Returns canonical 11 smart folders plus any user custom categories."""
    service = CategoryService(db)
    user_id = current_user.Id if current_user else None
    if tree:
        tree_data = service.get_category_tree(user_id)
        return ApiResponse.ok(data=tree_data, message="Category tree retrieved successfully.")
    else:
        flat_data = service.get_categories_flat(user_id)
        return ApiResponse.ok(data=flat_data, message="Categories list retrieved successfully.")


@router.get(
    "/{category_id}",
    response_model=ApiResponse[CategoryDto],
    summary="Get single category details by ID",
)
def get_category_by_id(
    category_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[CategoryDto]:
    service = CategoryService(db)
    cat = service.get_by_id(category_id)
    if not cat:
        return ApiResponse.fail(message="Category not found.", errors=["Category does not exist."])
    return ApiResponse.ok(data=cat, message="Category retrieved successfully.")


@router.post(
    "",
    response_model=ApiResponse[CategoryDto],
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom user smart folder / subcategory",
)
def create_category(
    request: CategoryCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[CategoryDto]:
    service = CategoryService(db)
    created = service.create_category(current_user.Id, request)
    return ApiResponse.ok(data=created, message="Category created successfully.")


@router.put(
    "/{category_id}",
    response_model=ApiResponse[CategoryDto],
    summary="Update a custom user category",
)
def update_category(
    category_id: uuid.UUID,
    request: CategoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[CategoryDto]:
    service = CategoryService(db)
    updated = service.update_category(current_user.Id, category_id, request)
    return ApiResponse.ok(data=updated, message="Category updated successfully.")


@router.delete(
    "/{category_id}",
    response_model=ApiResponse[dict],
    summary="Soft-delete a custom category",
)
def delete_category(
    category_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    service = CategoryService(db)
    service.delete_category(current_user.Id, category_id)
    return ApiResponse.ok(data={"deleted": True}, message="Category deleted successfully.")

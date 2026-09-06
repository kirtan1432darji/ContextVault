import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session, selectinload
from app.models.screenshot import Screenshot
from app.models.category import Category
from app.models.tag import Tag, ScreenshotTag
from app.repositories.base_repository import BaseRepository


class ScreenshotRepository(BaseRepository[Screenshot]):
    """Repository managing Screenshot entity persistence, deduplication, and queries."""

    def __init__(self, db: Session):
        super().__init__(Screenshot, db)

    def get_by_id_and_user(self, screenshot_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Screenshot]:
        stmt = (
            select(Screenshot)
            .where(
                and_(
                    Screenshot.Id == screenshot_id,
                    Screenshot.UserId == user_id,
                    Screenshot.IsDeleted == False,
                )
            )
            .options(
                selectinload(Screenshot.category),
                selectinload(Screenshot.tags),
                selectinload(Screenshot.search_index),
            )
        )
        return self.db.scalars(stmt).first()

    def get_by_user_and_hash(self, user_id: uuid.UUID, sha256_hash: str) -> Optional[Screenshot]:
        """Finds existing screenshot for duplicate prevention."""
        stmt = (
            select(Screenshot)
            .where(
                and_(
                    Screenshot.UserId == user_id,
                    Screenshot.SHA256Hash == sha256_hash,
                    Screenshot.IsDeleted == False,
                )
            )
            .options(
                selectinload(Screenshot.category),
                selectinload(Screenshot.tags),
                selectinload(Screenshot.search_index),
            )
        )
        return self.db.scalars(stmt).first()

    def list_paged(
        self,
        user_id: uuid.UUID,
        category_id: Optional[uuid.UUID] = None,
        sub_category: Optional[str] = None,
        tag: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        is_reviewed: Optional[bool] = None,
        search_term: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Screenshot], int]:
        filters = [Screenshot.UserId == user_id, Screenshot.IsDeleted == False]

        if category_id:
            filters.append(Screenshot.CategoryId == category_id)
        if sub_category:
            filters.append(Screenshot.SubCategory == sub_category)
        if is_favorite is not None:
            filters.append(Screenshot.IsFavorite == is_favorite)
        if is_reviewed is not None:
            filters.append(Screenshot.IsReviewed == is_reviewed)
        if tag:
            filters.append(Screenshot.tags.any(Tag.Name == tag))
        if search_term:
            term = f"%{search_term.strip()}%"
            filters.append(
                or_(
                    Screenshot.FileName.like(term),
                    Screenshot.OCRText.like(term),
                    Screenshot.NormalizedText.like(term),
                    Screenshot.SubCategory.like(term),
                    Screenshot.DetectedApp.like(term),
                )
            )

        # Count total
        count_stmt = select(func.count(Screenshot.Id)).where(and_(*filters))
        total_count = self.db.scalar(count_stmt) or 0

        # Paged query
        offset = (page - 1) * page_size
        stmt = (
            select(Screenshot)
            .where(and_(*filters))
            .options(
                selectinload(Screenshot.category),
                selectinload(Screenshot.tags),
            )
            .order_by(Screenshot.CreatedOn.desc())
            .offset(offset)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).all())
        return items, total_count

    def get_recent(self, user_id: uuid.UUID, limit: int = 20) -> List[Screenshot]:
        stmt = (
            select(Screenshot)
            .where(and_(Screenshot.UserId == user_id, Screenshot.IsDeleted == False))
            .options(
                selectinload(Screenshot.category),
                selectinload(Screenshot.tags),
            )
            .order_by(Screenshot.CreatedOn.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def soft_delete(self, screenshot_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        sc = self.get_by_id_and_user(screenshot_id, user_id)
        if not sc:
            return False
        sc.IsDeleted = True
        sc.DeletedOn = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def assign_tags(self, screenshot: Screenshot, tag_names: List[str], user_id: uuid.UUID) -> None:
        """Finds or creates tags by name and links them to the screenshot."""
        current_tags = []
        for name in tag_names:
            clean_name = name.strip()
            if not clean_name:
                continue
            stmt = select(Tag).where(Tag.Name == clean_name)
            existing_tag = self.db.scalars(stmt).first()
            if not existing_tag:
                existing_tag = Tag(
                    Id=uuid.uuid4(),
                    Name=clean_name,
                    Color="#6366F1",
                    UserId=user_id,
                    CreatedOn=datetime.now(timezone.utc),
                )
                self.db.add(existing_tag)
                self.db.commit()
                self.db.refresh(existing_tag)
            current_tags.append(existing_tag)

        screenshot.tags = current_tags
        self.db.commit()
        self.db.refresh(screenshot)

    def get_by_category_and_user(
        self, category_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[Screenshot]:
        """Fetches all non-deleted screenshots for a given category and user."""
        stmt = (
            select(Screenshot)
            .where(
                and_(
                    Screenshot.CategoryId == category_id,
                    Screenshot.UserId == user_id,
                    Screenshot.IsDeleted == False,
                )
            )
            .options(
                selectinload(Screenshot.category),
                selectinload(Screenshot.tags),
            )
            .order_by(Screenshot.CreatedOn.asc())
        )
        return list(self.db.scalars(stmt).all())

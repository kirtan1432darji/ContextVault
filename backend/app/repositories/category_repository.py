import uuid
from datetime import datetime, timezone
from typing import Optional, List, Sequence
from sqlalchemy import select, update, and_, or_
from sqlalchemy.orm import Session, selectinload
from app.models.category import Category
from app.repositories.base_repository import BaseRepository

CANONICAL_CATEGORIES = [
    {"name": "Receipts & Invoices", "icon": "receipt-outline", "color": "#10B981", "displayOrder": 1, "description": "Bills, orders, invoices, payment receipts"},
    {"name": "Finance & Banking", "icon": "bank-outline", "color": "#3B82F6", "displayOrder": 2, "description": "Bank statements, UPI, crypto, tax, portfolios"},
    {"name": "Projects / Work", "icon": "briefcase-outline", "color": "#8B5CF6", "displayOrder": 3, "description": "Multi-tier project tasks, specs, milestones, payroll"},
    {"name": "Shopping & Wishlist", "icon": "cart-outline", "color": "#F97316", "displayOrder": 4, "description": "E-commerce products, shoes, electronics, wishlist items"},
    {"name": "Code & Tech", "icon": "code-braces", "color": "#F59E0B", "displayOrder": 5, "description": "GitHub snippets, stack traces, terminal logs, API configs"},
    {"name": "Social & Chat", "icon": "chat-outline", "color": "#EC4899", "displayOrder": 6, "description": "WhatsApp, Telegram, Discord, Instagram, Twitter/X"},
    {"name": "Documents & IDs", "icon": "card-account-details-outline", "color": "#06B6D4", "displayOrder": 7, "description": "Passports, driver licenses, identity cards, contracts"},
    {"name": "Travel & Tickets", "icon": "airplane", "color": "#14B8A6", "displayOrder": 8, "description": "Flight boarding passes, train bookings, hotel vouchers"},
    {"name": "Notes & Knowledge", "icon": "book-open-outline", "color": "#6366F1", "displayOrder": 9, "description": "Articles, recipes, learning materials, study notes"},
    {"name": "Memes & Humor", "icon": "emoticon-happy-outline", "color": "#EAB308", "displayOrder": 10, "description": "Jokes, snapshots, comedy cards"},
    {"name": "Unsorted", "icon": "folder-question-outline", "color": "#94A3B8", "displayOrder": 11, "description": "Awaiting OCR processing or low-confidence review"},
]


class CategoryRepository(BaseRepository[Category]):
    """Repository managing Category persistence and hierarchical operations."""

    def __init__(self, db: Session):
        super().__init__(Category, db)

    def get_by_name(self, name: str, parent_id: Optional[uuid.UUID] = None) -> Optional[Category]:
        stmt = select(Category).where(
            and_(
                Category.Name == name,
                Category.ParentCategoryId == parent_id,
                Category.IsDeleted == False,
            )
        )
        return self.db.scalars(stmt).first()

    def get_by_path(self, path: str) -> Optional[Category]:
        stmt = select(Category).where(
            and_(
                Category.Path == path,
                Category.IsDeleted == False,
            )
        )
        return self.db.scalars(stmt).first()

    def get_system_categories(self) -> List[Category]:
        stmt = (
            select(Category)
            .where(and_(Category.IsSystem == True, Category.IsDeleted == False))
            .order_by(Category.DisplayOrder.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_all_for_user(self, user_id: Optional[uuid.UUID]) -> List[Category]:
        """Returns all system categories plus user custom categories."""
        filters = [Category.IsDeleted == False]
        if user_id:
            filters.append(or_(Category.IsSystem == True, Category.UserId == user_id))
        else:
            filters.append(Category.IsSystem == True)

        stmt = select(Category).where(and_(*filters)).order_by(Category.DisplayOrder.asc(), Category.Name.asc())
        return list(self.db.scalars(stmt).all())

    def get_category_tree(self, user_id: Optional[uuid.UUID]) -> List[Category]:
        """Returns root categories with eager-loaded sub-categories hierarchy."""
        filters = [Category.ParentCategoryId == None, Category.IsDeleted == False]
        if user_id:
            filters.append(or_(Category.IsSystem == True, Category.UserId == user_id))
        else:
            filters.append(Category.IsSystem == True)

        stmt = (
            select(Category)
            .where(and_(*filters))
            .options(selectinload(Category.sub_categories))
            .order_by(Category.DisplayOrder.asc(), Category.Name.asc())
        )
        return list(self.db.scalars(stmt).all())

    def seed_system_categories_if_empty(self) -> List[Category]:
        """Seeds canonical 11 categories if not already in the database."""
        existing = self.get_system_categories()
        if existing:
            return existing

        created = []
        for defn in CANONICAL_CATEGORIES:
            cat = Category(
                Id=uuid.uuid4(),
                UserId=None,
                ParentCategoryId=None,
                Name=defn["name"],
                Path=defn["name"],
                Icon=defn["icon"],
                Color=defn["color"],
                Description=defn.get("description"),
                IsSystem=True,
                DisplayOrder=defn["displayOrder"],
                ScreenshotCount=0,
                IsDeleted=False,
            )
            self.db.add(cat)
            created.append(cat)

        self.db.commit()
        for cat in created:
            self.db.refresh(cat)
        return created

    def find_or_create_by_path(self, path_segments: List[str], user_id: Optional[uuid.UUID] = None) -> Category:
        """Finds or dynamically creates nested category hierarchy."""
        if not path_segments:
            return self.get_by_name("Unsorted") or self.seed_system_categories_if_empty()[-1]

        parent: Optional[Category] = None
        current_path = ""

        for idx, segment in enumerate(path_segments):
            clean_segment = segment.strip()
            if not clean_segment:
                continue

            current_path = f"{current_path}/{clean_segment}" if current_path else clean_segment
            parent_id = parent.Id if parent else None

            existing = self.get_by_name(clean_segment, parent_id)
            if not existing:
                is_system_top = (idx == 0 and any(c["name"] == clean_segment for c in CANONICAL_CATEGORIES))
                color = parent.Color if parent else "#6366F1"
                icon = parent.Icon if parent else "folder-outline"

                new_cat = Category(
                    Id=uuid.uuid4(),
                    UserId=None if is_system_top else user_id,
                    ParentCategoryId=parent_id,
                    Name=clean_segment,
                    Path=current_path,
                    Icon=icon,
                    Color=color,
                    IsSystem=is_system_top,
                    DisplayOrder=idx,
                    ScreenshotCount=0,
                    IsDeleted=False,
                )
                self.db.add(new_cat)
                self.db.commit()
                self.db.refresh(new_cat)
                parent = new_cat
            else:
                parent = existing

        return parent

    def increment_screenshot_count(self, category_id: uuid.UUID, delta: int = 1) -> None:
        cat = self.get_by_id(category_id)
        if cat:
            cat.ScreenshotCount = max(0, cat.ScreenshotCount + delta)
            cat.UpdatedOn = datetime.now(timezone.utc)
            self.db.commit()

    def decrement_screenshot_count(self, category_id: uuid.UUID, delta: int = 1) -> None:
        self.increment_screenshot_count(category_id, -delta)

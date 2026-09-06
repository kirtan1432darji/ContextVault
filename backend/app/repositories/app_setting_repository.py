import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.app_setting import AppSetting
from app.repositories.base_repository import BaseRepository


class AppSettingRepository(BaseRepository[AppSetting]):
    """Repository handling configuration settings persistence."""

    def __init__(self, db: Session):
        super().__init__(AppSetting, db)

    def get_setting(self, key: str, user_id: Optional[uuid.UUID] = None) -> Optional[AppSetting]:
        stmt = select(AppSetting).where(
            AppSetting.SettingKey == key,
            AppSetting.UserId == user_id,
            AppSetting.IsDeleted == False,
        )
        return self.db.scalars(stmt).first()

    def set_setting(
        self,
        key: str,
        value: str,
        user_id: Optional[uuid.UUID] = None,
        data_type: str = "String",
        description: Optional[str] = None,
    ) -> AppSetting:
        existing = self.get_setting(key, user_id)
        if existing:
            existing.SettingValue = value
            existing.DataType = data_type
            if description is not None:
                existing.Description = description
            existing.UpdatedOn = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(existing)
            return existing

        new_setting = AppSetting(
            UserId=user_id,
            SettingKey=key,
            SettingValue=value,
            DataType=data_type,
            Description=description,
        )
        return self.create(new_setting)

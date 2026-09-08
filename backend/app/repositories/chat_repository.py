import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import Session
from app.models.chat_history import ChatHistory
from app.repositories.base_repository import BaseRepository


class ChatRepository(BaseRepository[ChatHistory]):
    """Repository managing ChatHistories persistence, multi-turn history, and sessions."""

    def __init__(self, db: Session):
        super().__init__(ChatHistory, db)

    def save_message(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        role: str,
        message: str,
        category_id: Optional[uuid.UUID] = None,
        screenshot_id: Optional[uuid.UUID] = None,
        citations_json: Optional[str] = "[]",
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        ai_model_id: Optional[uuid.UUID] = None,
    ) -> ChatHistory:
        """Persists an atomic chat message record."""
        chat_msg = ChatHistory(
            Id=uuid.uuid4(),
            SessionId=session_id,
            UserId=user_id,
            CategoryId=category_id,
            ScreenshotId=screenshot_id,
            Role=role,
            Message=message,
            ReferencedScreenshotIdsJson=citations_json or "[]",
            PromptTokens=prompt_tokens,
            CompletionTokens=completion_tokens,
            AIModelId=ai_model_id,
            CreatedOn=datetime.now(timezone.utc),
            IsDeleted=False,
        )
        self.db.add(chat_msg)
        self.db.commit()
        self.db.refresh(chat_msg)
        return chat_msg

    def get_history(
        self,
        user_id: uuid.UUID,
        category_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ChatHistory]:
        """Retrieves chronological messages for a user, optionally filtered by folder or session."""
        conditions = [
            ChatHistory.UserId == user_id,
            ChatHistory.IsDeleted == False,
        ]
        if category_id is not None:
            conditions.append(ChatHistory.CategoryId == category_id)
        if session_id is not None:
            conditions.append(ChatHistory.SessionId == session_id)

        stmt = (
            select(ChatHistory)
            .where(and_(*conditions))
            .order_by(ChatHistory.CreatedOn.asc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def count_history(
        self,
        user_id: uuid.UUID,
        category_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None,
    ) -> int:
        """Counts total non-deleted messages for a given filter."""
        conditions = [
            ChatHistory.UserId == user_id,
            ChatHistory.IsDeleted == False,
        ]
        if category_id is not None:
            conditions.append(ChatHistory.CategoryId == category_id)
        if session_id is not None:
            conditions.append(ChatHistory.SessionId == session_id)

        stmt = select(func.count(ChatHistory.Id)).where(and_(*conditions))
        return self.db.scalar(stmt) or 0

    def get_recent_session_messages(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        limit: int = 10,
    ) -> List[ChatHistory]:
        """Fetches the most recent N messages of a session for conversation context injection."""
        stmt = (
            select(ChatHistory)
            .where(
                and_(
                    ChatHistory.UserId == user_id,
                    ChatHistory.SessionId == session_id,
                    ChatHistory.IsDeleted == False,
                )
            )
            .order_by(ChatHistory.CreatedOn.desc())
            .limit(limit)
        )
        messages = list(self.db.scalars(stmt).all())
        messages.reverse()  # Return in chronological order
        return messages

    def get_sessions(
        self,
        user_id: uuid.UUID,
        category_id: Optional[uuid.UUID] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Summarizes distinct active chat sessions."""
        conditions = [
            ChatHistory.UserId == user_id,
            ChatHistory.IsDeleted == False,
        ]
        if category_id is not None:
            conditions.append(ChatHistory.CategoryId == category_id)

        stmt = (
            select(
                ChatHistory.SessionId,
                ChatHistory.CategoryId,
                func.count(ChatHistory.Id).label("message_count"),
                func.max(ChatHistory.CreatedOn).label("updated_at"),
                func.min(ChatHistory.CreatedOn).label("created_at"),
            )
            .where(and_(*conditions))
            .group_by(ChatHistory.SessionId, ChatHistory.CategoryId)
            .order_by(desc("updated_at"))
            .limit(limit)
        )
        rows = self.db.execute(stmt).all()
        results = []
        for r in rows:
            # Find the last message content for preview
            last_msg_stmt = (
                select(ChatHistory.Message)
                .where(
                    and_(
                        ChatHistory.SessionId == r.SessionId,
                        ChatHistory.IsDeleted == False,
                    )
                )
                .order_by(ChatHistory.CreatedOn.desc())
                .limit(1)
            )
            last_msg = self.db.scalar(last_msg_stmt) or ""
            results.append({
                "sessionId": r.SessionId,
                "folderId": r.CategoryId,
                "title": f"Session {str(r.SessionId)[:8]}",
                "lastMessage": last_msg[:100],
                "messageCount": r.message_count,
                "createdAt": r.created_at,
                "updatedAt": r.updated_at,
            })
        return results

    def delete_session(self, user_id: uuid.UUID, session_id: uuid.UUID) -> bool:
        """Soft-deletes all messages in a session."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(ChatHistory)
            .where(
                and_(
                    ChatHistory.UserId == user_id,
                    ChatHistory.SessionId == session_id,
                    ChatHistory.IsDeleted == False,
                )
            )
        )
        messages = list(self.db.scalars(stmt).all())
        if not messages:
            return False
        for msg in messages:
            msg.IsDeleted = True
            msg.DeletedOn = now
        self.db.commit()
        return True

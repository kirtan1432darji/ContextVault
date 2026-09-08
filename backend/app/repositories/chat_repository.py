import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import Session
from app.models.chat import ChatSession, ChatMessage
from app.repositories.base_repository import BaseRepository


class ChatRepository(BaseRepository[ChatMessage]):
    """
    ContextVault Multi-Turn Context AI Repository.
    Manages persistence of ChatSessions, ChatMessages, citations, and conversation history.
    """

    def __init__(self, db: Session):
        super().__init__(ChatMessage, db)

    def create_session(
        self,
        user_id: uuid.UUID,
        folder_id: Optional[uuid.UUID] = None,
        title: Optional[str] = None,
        session_id: Optional[uuid.UUID] = None,
    ) -> ChatSession:
        """Creates and persists a new ChatSession entity."""
        session = ChatSession(
            Id=session_id or uuid.uuid4(),
            UserId=user_id,
            FolderId=folder_id,
            Title=title or f"Chat {datetime.now(timezone.utc).strftime('%b %d, %H:%M')}",
            IsDeleted=False,
            CreatedOn=datetime.now(timezone.utc),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[ChatSession]:
        """Retrieves an active ChatSession by ID and User."""
        stmt = select(ChatSession).where(
            and_(
                ChatSession.Id == session_id,
                ChatSession.UserId == user_id,
                ChatSession.IsDeleted == False,
            )
        )
        return self.db.scalar(stmt)

    def save_message(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        role: str,
        message: str,
        folder_id: Optional[uuid.UUID] = None,
        category_id: Optional[uuid.UUID] = None,
        screenshot_id: Optional[uuid.UUID] = None,
        citations_json: Optional[str] = "[]",
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        ai_model_id: Optional[uuid.UUID] = None,
    ) -> ChatMessage:
        """
        Persists a conversation message.
        Ensures the parent session exists, auto-creating it if necessary.
        """
        resolved_folder_id = folder_id if folder_id is not None else category_id

        # Verify parent session exists, otherwise create it
        session = self.get_session(session_id, user_id)
        if not session:
            session = self.create_session(
                user_id=user_id,
                folder_id=resolved_folder_id,
                session_id=session_id,
                title=message[:40] if message else None,
            )

        chat_msg = ChatMessage(
            Id=uuid.uuid4(),
            SessionId=session_id,
            UserId=user_id,
            FolderId=resolved_folder_id,
            ScreenshotId=screenshot_id,
            Role=role,
            Message=message,
            CitationsJson=citations_json or "[]",
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

    def get_chat_history(
        self,
        user_id: uuid.UUID,
        folder_id: Optional[uuid.UUID] = None,
        category_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ChatMessage]:
        """Retrieves chronological messages for a user, optionally filtered by folder or session."""
        resolved_folder_id = folder_id if folder_id is not None else category_id
        conditions = [
            ChatMessage.UserId == user_id,
            ChatMessage.IsDeleted == False,
        ]
        if resolved_folder_id is not None:
            conditions.append(ChatMessage.FolderId == resolved_folder_id)
        if session_id is not None:
            conditions.append(ChatMessage.SessionId == session_id)

        stmt = (
            select(ChatMessage)
            .where(and_(*conditions))
            .order_by(ChatMessage.CreatedOn.asc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    # Backward compatibility alias
    get_history = get_chat_history

    def count_chat_history(
        self,
        user_id: uuid.UUID,
        folder_id: Optional[uuid.UUID] = None,
        category_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None,
    ) -> int:
        """Counts total non-deleted messages matching the filter criteria."""
        resolved_folder_id = folder_id if folder_id is not None else category_id
        conditions = [
            ChatMessage.UserId == user_id,
            ChatMessage.IsDeleted == False,
        ]
        if resolved_folder_id is not None:
            conditions.append(ChatMessage.FolderId == resolved_folder_id)
        if session_id is not None:
            conditions.append(ChatMessage.SessionId == session_id)

        stmt = select(func.count(ChatMessage.Id)).where(and_(*conditions))
        return self.db.scalar(stmt) or 0

    # Backward compatibility alias
    count_history = count_chat_history

    def get_recent_session_messages(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        limit: int = 10,
    ) -> List[ChatMessage]:
        """Fetches the most recent N messages of a session for conversation context injection."""
        stmt = (
            select(ChatMessage)
            .where(
                and_(
                    ChatMessage.UserId == user_id,
                    ChatMessage.SessionId == session_id,
                    ChatMessage.IsDeleted == False,
                )
            )
            .order_by(ChatMessage.CreatedOn.desc())
            .limit(limit)
        )
        messages = list(self.db.scalars(stmt).all())
        messages.reverse()  # Chronological order
        return messages

    def get_recent_sessions(
        self,
        user_id: uuid.UUID,
        folder_id: Optional[uuid.UUID] = None,
        category_id: Optional[uuid.UUID] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Summarizes distinct active chat sessions with message counts and last message preview."""
        resolved_folder_id = folder_id if folder_id is not None else category_id
        conditions = [
            ChatMessage.UserId == user_id,
            ChatMessage.IsDeleted == False,
        ]
        if resolved_folder_id is not None:
            conditions.append(ChatMessage.FolderId == resolved_folder_id)

        stmt = (
            select(
                ChatMessage.SessionId,
                ChatMessage.FolderId,
                func.count(ChatMessage.Id).label("message_count"),
                func.max(ChatMessage.CreatedOn).label("updated_at"),
                func.min(ChatMessage.CreatedOn).label("created_at"),
            )
            .where(and_(*conditions))
            .group_by(ChatMessage.SessionId, ChatMessage.FolderId)
            .order_by(desc("updated_at"))
            .limit(limit)
        )
        rows = self.db.execute(stmt).all()
        results = []
        for r in rows:
            # Find the last message content for preview
            last_msg_stmt = (
                select(ChatMessage.Message)
                .where(
                    and_(
                        ChatMessage.SessionId == r.SessionId,
                        ChatMessage.IsDeleted == False,
                    )
                )
                .order_by(ChatMessage.CreatedOn.desc())
                .limit(1)
            )
            last_msg = self.db.scalar(last_msg_stmt) or ""
            results.append({
                "sessionId": r.SessionId,
                "folderId": r.FolderId,
                "title": f"Session {str(r.SessionId)[:8]}",
                "lastMessage": last_msg[:100],
                "messageCount": r.message_count,
                "createdAt": r.created_at,
                "updatedAt": r.updated_at,
            })
        return results

    # Backward compatibility alias
    get_sessions = get_recent_sessions

    def delete_session(self, user_id: uuid.UUID, session_id: uuid.UUID) -> bool:
        """Soft-deletes a session and all its messages."""
        now = datetime.now(timezone.utc)
        # 1. Soft-delete messages
        stmt = select(ChatMessage).where(
            and_(
                ChatMessage.UserId == user_id,
                ChatMessage.SessionId == session_id,
                ChatMessage.IsDeleted == False,
            )
        )
        messages = list(self.db.scalars(stmt).all())
        if not messages:
            return False

        for msg in messages:
            msg.IsDeleted = True
            msg.DeletedOn = now

        # 2. Soft-delete session
        session_stmt = select(ChatSession).where(
            and_(
                ChatSession.UserId == user_id,
                ChatSession.Id == session_id,
                ChatSession.IsDeleted == False,
            )
        )
        session = self.db.scalar(session_stmt)
        if session:
            session.IsDeleted = True
            session.DeletedOn = now

        self.db.commit()
        return True

    def delete_chat_history(
        self, user_id: uuid.UUID, folder_id: uuid.UUID
    ) -> int:
        """Soft-deletes all chat messages and sessions associated with a folder."""
        now = datetime.now(timezone.utc)
        stmt = select(ChatMessage).where(
            and_(
                ChatMessage.UserId == user_id,
                ChatMessage.FolderId == folder_id,
                ChatMessage.IsDeleted == False,
            )
        )
        messages = list(self.db.scalars(stmt).all())
        count = len(messages)
        for msg in messages:
            msg.IsDeleted = True
            msg.DeletedOn = now

        # Also mark associated sessions as deleted
        sessions_stmt = select(ChatSession).where(
            and_(
                ChatSession.UserId == user_id,
                ChatSession.FolderId == folder_id,
                ChatSession.IsDeleted == False,
            )
        )
        sessions = list(self.db.scalars(sessions_stmt).all())
        for s in sessions:
            s.IsDeleted = True
            s.DeletedOn = now

        self.db.commit()
        return count

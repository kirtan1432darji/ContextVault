"""
Backward-compatibility module for ChatHistory.
Points to ChatMessage and ChatSession in app.models.chat.
"""
from app.models.chat import ChatSession, ChatMessage, ChatHistory

__all__ = ["ChatSession", "ChatMessage", "ChatHistory"]

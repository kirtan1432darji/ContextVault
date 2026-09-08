import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.chat import ChatMessage, ChatSession
from app.models.category import Category
from app.models.screenshot import Screenshot
from app.repositories.chat_repository import ChatRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.repositories.folder_context_repository import FolderContextRepository
from app.services.context_engine_service import ContextEngineService
from app.services.prompt_builder_service import PromptBuilderService
from app.services.citation_service import CitationService
from app.schemas.chat import (
    ChatMessageCitationDto,
    ChatMessageDto,
    ChatRequestDto,
    ChatSuggestionsDto,
    ChatSessionSummaryDto,
    ChatHistoryResponseDto,
)


class ChatEngineService:
    """
    ContextVault Multi-Turn Context AI Chat Engine.
    Orchestrates:
    - PromptBuilderService: synthesizes folder context, timeline, entities, OCR snippets.
    - CitationService: resolves, ranks, and formats grounded screenshot references.
    - ChatRepository: persists conversation history, turns, and session records.
    Enforces privacy-first zero image binary transmission.
    """

    DEFAULT_FOLLOW_UPS = [
        "What are the key action items in this folder?",
        "Can you summarize all screenshots here?",
        "What dates or deadlines are mentioned?",
    ]

    CATEGORY_SUGGESTIONS_MAP = {
        "Receipts & Invoices": [
            "What is the total amount spent across all receipts?",
            "List all merchants and invoice dates found here",
            "Which items are tax-deductible or business expenses?",
            "Find payment confirmation numbers and order IDs",
        ],
        "Finance & Banking": [
            "Summarize my recent account balances and statements",
            "What UPI transactions or transfer references were found?",
            "List all bank names and account references detected",
            "What was my highest expense or transfer?",
        ],
        "Projects / Work": [
            "What are my pending action items and tasks?",
            "Summarize the latest project specs or sprint notes",
            "List all deadlines and deliverables mentioned",
            "Who are the clients or team members referenced?",
        ],
        "Shopping & Wishlist": [
            "What products and prices are in this wishlist?",
            "Compare prices of items saved here",
            "List all store links and discount codes found",
        ],
        "Code & Tech": [
            "Find GitHub repositories and code snippets",
            "What terminal errors or stack traces are recorded?",
            "List all server configurations and API endpoints",
        ],
        "Social & Chat": [
            "Summarize the conversation messages captured here",
            "What important links or phone numbers were shared?",
            "List key discussion highlights and dates",
        ],
        "Documents & IDs": [
            "What document types and ID numbers are stored here?",
            "Check expiration dates on these documents",
            "List names and institutions referenced on these cards",
        ],
        "Travel & Tickets": [
            "Show my flight numbers, departure times, and gates",
            "What are the hotel booking and reservation details?",
            "Provide a chronological travel itinerary for these tickets",
        ],
        "Notes & Knowledge": [
            "Provide a concise executive summary of these study notes",
            "What are the main concepts and takeaways?",
            "Extract key definitions and bullet points",
        ],
        "Memes & Humor": [
            "Describe the jokes and humorous themes in this folder",
            "Find memes related to coding or work life",
        ],
    }

    def __init__(self, db: Session):
        self.db = db
        self.chat_repo = ChatRepository(db)
        self.category_repo = CategoryRepository(db)
        self.screenshot_repo = ScreenshotRepository(db)
        self.context_repo = FolderContextRepository(db)
        self.context_engine = ContextEngineService(db)
        self.prompt_builder = PromptBuilderService()
        self.citation_service = CitationService()

    def process_message(
        self, user_id: uuid.UUID, request: ChatRequestDto
    ) -> ChatMessageDto:
        """
        Processes a user question, retrieves relevant folder context and screenshot OCR snippets,
        synthesizes a grounded answer with citations, and persists the conversation turn.
        """
        session_id = request.sessionId or uuid.uuid4()
        user_query = request.content.strip()

        # 1. Estimate user prompt tokens
        user_tokens = max(1, len(user_query.split()) * 2)

        # 2. Persist user message in history
        self.chat_repo.save_message(
            user_id=user_id,
            session_id=session_id,
            role="user",
            message=user_query,
            folder_id=request.folderId,
            screenshot_id=request.screenshotId,
            citations_json="[]",
            prompt_tokens=user_tokens,
            completion_tokens=0,
        )

        # 3. Retrieve conversation history for context continuity
        session_history = self.chat_repo.get_recent_session_messages(
            user_id=user_id, session_id=session_id, limit=6
        )

        # 4. Assemble Grounded Knowledge Context & Citations
        citations, answer, follow_ups = self._synthesize_grounded_response(
            user_id=user_id,
            query=user_query,
            folder_id=request.folderId,
            screenshot_id=request.screenshotId,
            history=session_history,
        )

        # 5. Calculate completion token estimate
        completion_tokens = max(1, len(answer.split()) * 2)

        # 6. Serialize citations for database persistence
        citations_serialized = self.citation_service.serialize_citations(citations)

        # 7. Persist assistant response in history
        assistant_record = self.chat_repo.save_message(
            user_id=user_id,
            session_id=session_id,
            role="assistant",
            message=answer,
            folder_id=request.folderId,
            screenshot_id=request.screenshotId,
            citations_json=citations_serialized,
            prompt_tokens=user_tokens,
            completion_tokens=completion_tokens,
        )

        # 8. Return response DTO
        return ChatMessageDto(
            id=assistant_record.Id,
            sessionId=session_id,
            folderId=request.folderId,
            screenshotId=request.screenshotId,
            role="assistant",
            content=answer,
            citations=citations,
            createdAt=assistant_record.CreatedOn,
            suggestedFollowUps=follow_ups,
            promptTokens=user_tokens,
            completionTokens=completion_tokens,
        )

    def get_history(
        self,
        user_id: uuid.UUID,
        folder_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> ChatHistoryResponseDto:
        """Retrieves paginated conversation history with formatted citations."""
        messages = self.chat_repo.get_chat_history(
            user_id=user_id,
            folder_id=folder_id,
            session_id=session_id,
            limit=limit,
            offset=offset,
        )
        total_count = self.chat_repo.count_chat_history(
            user_id=user_id,
            folder_id=folder_id,
            session_id=session_id,
        )

        dto_list: List[ChatMessageDto] = []
        for msg in messages:
            citations_list = self.citation_service.deserialize_citations(
                msg.CitationsJson
            )
            dto_list.append(
                ChatMessageDto(
                    id=msg.Id,
                    sessionId=msg.SessionId,
                    folderId=msg.FolderId,
                    screenshotId=msg.ScreenshotId,
                    role=msg.Role.lower(),
                    content=msg.Message,
                    citations=citations_list,
                    createdAt=msg.CreatedOn,
                    suggestedFollowUps=[],
                    promptTokens=msg.PromptTokens,
                    completionTokens=msg.CompletionTokens,
                )
            )

        return ChatHistoryResponseDto(
            folderId=folder_id,
            sessionId=session_id,
            totalCount=total_count,
            messages=dto_list,
        )

    def get_suggestions(
        self, user_id: uuid.UUID, folder_id: uuid.UUID
    ) -> ChatSuggestionsDto:
        """Generates contextual prompt suggestions tailored to the folder's category, entities, and tasks."""
        category = self.category_repo.get_by_id(folder_id)
        folder_name = category.Name if category else "Smart Folder"

        suggestions: List[str] = []

        # 1. Category-specific suggestions
        if category and category.Name in self.CATEGORY_SUGGESTIONS_MAP:
            suggestions.extend(self.CATEGORY_SUGGESTIONS_MAP[category.Name][:3])

        # 2. Check if folder has context with tasks
        ctx = self.context_repo.get_by_folder_id(folder_id, user_id)
        if ctx:
            ctx_data = self.prompt_builder.parse_folder_context_block(ctx)
            tasks = ctx_data["tasks"]
            if tasks and len(tasks) > 0:
                suggestions.append(f"Show details for task: '{tasks[0].get('task', 'next action')}'")

            entities = ctx_data["entities"]
            if isinstance(entities, dict):
                currencies = entities.get("currencies", [])
                if currencies and "What is the total amount spent across all receipts?" not in suggestions:
                    suggestions.append("Summarize all payment amounts and expenses")
                dates = entities.get("dates", [])
                if dates:
                    suggestions.append("What key dates or deadlines are recorded here?")

        # Fallbacks if list is short
        if len(suggestions) < 3:
            for default_s in self.DEFAULT_FOLLOW_UPS:
                if default_s not in suggestions:
                    suggestions.append(default_s)
                if len(suggestions) >= 4:
                    break

        return ChatSuggestionsDto(
            folderId=folder_id,
            folderName=folder_name,
            suggestions=suggestions[:4],
        )

    def get_sessions(
        self, user_id: uuid.UUID, folder_id: Optional[uuid.UUID] = None, limit: int = 20
    ) -> List[ChatSessionSummaryDto]:
        """Returns summarized active chat sessions for the user."""
        raw_sessions = self.chat_repo.get_recent_sessions(
            user_id=user_id, folder_id=folder_id, limit=limit
        )
        results: List[ChatSessionSummaryDto] = []
        for s in raw_sessions:
            results.append(
                ChatSessionSummaryDto(
                    sessionId=s["sessionId"],
                    folderId=s["folderId"],
                    lastMessage=s["lastMessage"],
                    messageCount=s["messageCount"],
                    createdAt=s["createdAt"],
                    updatedAt=s["updatedAt"],
                )
            )
        return results

    def delete_session(self, user_id: uuid.UUID, session_id: uuid.UUID) -> bool:
        """Deletes a chat session and its messages."""
        return self.chat_repo.delete_session(user_id=user_id, session_id=session_id)

    def delete_history(self, user_id: uuid.UUID, folder_id: uuid.UUID) -> int:
        """Deletes all chat messages and sessions in a folder."""
        return self.chat_repo.delete_chat_history(user_id=user_id, folder_id=folder_id)

    # --------------------------------------------------------------------------
    # Internal RAG & Grounded Synthesis Methods
    # --------------------------------------------------------------------------

    def _synthesize_grounded_response(
        self,
        user_id: uuid.UUID,
        query: str,
        folder_id: Optional[uuid.UUID],
        screenshot_id: Optional[uuid.UUID],
        history: List[ChatMessage],
    ) -> Tuple[List[ChatMessageCitationDto], str, List[str]]:
        """
        Analyzes query intent, searches folder screenshots and context, extracts citations,
        and generates an accurate grounded response.
        """
        citations: List[ChatMessageCitationDto] = []
        follow_ups: List[str] = list(self.DEFAULT_FOLLOW_UPS)

        # A. Specific Screenshot Context
        if screenshot_id:
            shot = self.screenshot_repo.get_by_id_and_user(screenshot_id, user_id)
            if shot:
                citation = self.citation_service.find_citation_for_screenshot(shot)
                citations.append(citation)
                ocr_text = shot.OCRText or ""
                answer = (
                    f"**Analysis of {shot.FileName}:**\n\n"
                    f"- **Category:** {shot.category.Name if shot.category else 'Unsorted'}\n"
                    f"- **Detected App:** {shot.DetectedApp or 'General'}\n"
                    f"- **Content:** {ocr_text if len(ocr_text) < 400 else ocr_text[:400] + '...'}\n\n"
                    f"Let me know if you would like me to extract specific entities or action items from this screenshot."
                )
                return citations, answer, ["Extract tasks from this", "Find dates and amounts"]

        # B. Smart Folder Context
        if folder_id:
            category = self.category_repo.get_by_id(folder_id)
            folder_name = category.Name if category else "Smart Folder"

            # 1. Fetch or generate folder context
            folder_ctx = self.context_repo.get_by_folder_id(folder_id, user_id)
            if not folder_ctx:
                # Auto-generate folder context on demand
                folder_ctx_dto = self.context_engine.generate_folder_context(
                    folder_id=folder_id, user_id=user_id
                )
                if folder_ctx_dto:
                    folder_ctx = self.context_repo.get_by_folder_id(folder_id, user_id)

            # 2. Fetch screenshots in folder
            screenshots, _ = self.screenshot_repo.list_paged(
                user_id=user_id, category_id=folder_id, page=1, page_size=25
            )

            # 3. Find keyword matches in screenshots for citations using CitationService
            citations = self.citation_service.find_citations_for_query(
                query=query, screenshots=screenshots, max_citations=4
            )

            # 4. Generate Grounded Answer by analyzing user intent using PromptBuilderService
            answer = self.prompt_builder.synthesize_grounded_answer(
                query=query,
                folder_name=folder_name,
                folder_ctx=folder_ctx,
                screenshots=screenshots,
                citations=citations,
            )

            # Customize follow-up suggestions based on category
            if category and category.Name in self.CATEGORY_SUGGESTIONS_MAP:
                follow_ups = self.CATEGORY_SUGGESTIONS_MAP[category.Name][:3]

            return citations, answer, follow_ups

        # C. General Vault Context (No specific folder provided)
        screenshots, _ = self.screenshot_repo.list_paged(
            user_id=user_id, page=1, page_size=10
        )
        if screenshots:
            latest = screenshots[0]
            citations.append(self.citation_service.build_citation(latest))

        answer = (
            f"I searched across your ContextVault knowledge base.\n\n"
            f"You currently have {len(screenshots)} recent screenshots indexed. "
            f"To get precise, citation-grounded insights, select a Smart Folder "
            f"(such as Receipts & Invoices, Finance, or Projects) to chat within that specific context."
        )
        return citations, answer, follow_ups

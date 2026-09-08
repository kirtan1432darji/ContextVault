import uuid
import json
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.chat_history import ChatHistory
from app.models.category import Category
from app.models.screenshot import Screenshot
from app.repositories.chat_repository import ChatRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.repositories.folder_context_repository import FolderContextRepository
from app.services.context_engine_service import ContextEngineService
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
    Executes grounded Retrieval-Augmented Generation (RAG) over:
    - Synthesized Folder Knowledge Summaries
    - 14 Structured Extracted Entity Categories (currencies, dates, urls, contacts, etc.)
    - Actionable detected tasks and deadlines
    - Chronological event timelines
    - Cached on-device OCR text blocks and screenshot metadata
    Zero image binaries leave device.
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
            category_id=request.folderId,
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
        citations_serialized = json.dumps(
            [c.model_dump(mode="json") for c in citations]
        )

        # 7. Persist assistant response in history
        assistant_record = self.chat_repo.save_message(
            user_id=user_id,
            session_id=session_id,
            role="assistant",
            message=answer,
            category_id=request.folderId,
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
        messages = self.chat_repo.get_history(
            user_id=user_id,
            category_id=folder_id,
            session_id=session_id,
            limit=limit,
            offset=offset,
        )
        total_count = self.chat_repo.count_history(
            user_id=user_id,
            category_id=folder_id,
            session_id=session_id,
        )

        dto_list: List[ChatMessageDto] = []
        for msg in messages:
            citations_list: List[ChatMessageCitationDto] = []
            if msg.ReferencedScreenshotIdsJson:
                try:
                    raw_cits = json.loads(msg.ReferencedScreenshotIdsJson)
                    if isinstance(raw_cits, list):
                        for c in raw_cits:
                            if isinstance(c, dict) and "screenshotId" in c:
                                citations_list.append(
                                    ChatMessageCitationDto(
                                        screenshotId=uuid.UUID(str(c["screenshotId"])),
                                        fileName=c.get("fileName", "screenshot.png"),
                                        snippet=c.get("snippet"),
                                        thumbnailPath=c.get("thumbnailPath"),
                                    )
                                )
                except Exception:
                    pass

            dto_list.append(
                ChatMessageDto(
                    id=msg.Id,
                    sessionId=msg.SessionId,
                    folderId=msg.CategoryId,
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
            try:
                tasks = json.loads(ctx.TasksJson)
                if tasks and len(tasks) > 0:
                    suggestions.append(f"Show details for task: '{tasks[0].get('task', 'next action')}'")
            except Exception:
                pass

            try:
                entities = json.loads(ctx.EntitiesJson)
                if isinstance(entities, dict):
                    currencies = entities.get("currencies", [])
                    if currencies and "What is the total amount spent across all receipts?" not in suggestions:
                        suggestions.append("Summarize all payment amounts and expenses")
                    dates = entities.get("dates", [])
                    if dates:
                        suggestions.append("What key dates or deadlines are recorded here?")
            except Exception:
                pass

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
        raw_sessions = self.chat_repo.get_sessions(
            user_id=user_id, category_id=folder_id, limit=limit
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
        """Deletes a chat session."""
        return self.chat_repo.delete_session(user_id=user_id, session_id=session_id)

    # --------------------------------------------------------------------------
    # Internal RAG & Grounded Synthesis Methods
    # --------------------------------------------------------------------------

    def _synthesize_grounded_response(
        self,
        user_id: uuid.UUID,
        query: str,
        folder_id: Optional[uuid.UUID],
        screenshot_id: Optional[uuid.UUID],
        history: List[ChatHistory],
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
                ocr_text = shot.OCRText or ""
                snippet = ocr_text[:120].strip() if ocr_text else "No OCR text detected"
                citations.append(
                    ChatMessageCitationDto(
                        screenshotId=shot.Id,
                        fileName=shot.FileName,
                        snippet=snippet,
                        thumbnailPath=shot.DeviceFolder,
                    )
                )
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
            screenshots, total_shots = self.screenshot_repo.list_paged(
                user_id=user_id, category_id=folder_id, page=1, page_size=25
            )

            # 3. Find keyword matches in screenshots for citations
            query_words = [
                w.lower() for w in re.findall(r"\w+", query)
                if len(w) > 2 and w.lower() not in ContextEngineService.STOP_WORDS
            ]

            scored_shots: List[Tuple[Screenshot, int, str]] = []
            for s in screenshots:
                score = 0
                snippet = ""
                text = (s.OCRText or "") + " " + (s.FileName or "") + " " + (s.DetectedApp or "")
                text_lower = text.lower()

                for qw in query_words:
                    if qw in text_lower:
                        score += 2
                        # Extract snippet window around match
                        idx = text_lower.find(qw)
                        start = max(0, idx - 40)
                        end = min(len(text), idx + len(qw) + 60)
                        snippet = text[start:end].replace("\n", " ").strip()

                if score > 0:
                    scored_shots.append((s, score, snippet or (s.OCRText[:100] if s.OCRText else "")))
                elif not query_words and len(scored_shots) < 3:
                    # Generic query -> take top screenshots
                    scored_shots.append((s, 1, s.OCRText[:100] if s.OCRText else s.FileName))

            scored_shots.sort(key=lambda x: x[1], reverse=True)

            for s, score, snip in scored_shots[:4]:
                citations.append(
                    ChatMessageCitationDto(
                        screenshotId=s.Id,
                        fileName=s.FileName,
                        snippet=snip[:150] if snip else "Matched screenshot context",
                        thumbnailPath=s.DeviceFolder,
                    )
                )

            # If no keyword matched but screenshots exist, cite the latest screenshot
            if not citations and screenshots:
                latest = screenshots[0]
                citations.append(
                    ChatMessageCitationDto(
                        screenshotId=latest.Id,
                        fileName=latest.FileName,
                        snippet=(latest.OCRText[:120] if latest.OCRText else latest.FileName),
                        thumbnailPath=latest.DeviceFolder,
                    )
                )

            # 4. Generate Grounded Answer by analyzing user intent
            answer = self._generate_answer_by_intent(
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
            citations.append(
                ChatMessageCitationDto(
                    screenshotId=latest.Id,
                    fileName=latest.FileName,
                    snippet=(latest.OCRText[:120] if latest.OCRText else latest.FileName),
                    thumbnailPath=latest.DeviceFolder,
                )
            )

        answer = (
            f"I searched across your ContextVault knowledge base.\n\n"
            f"You currently have {len(screenshots)} recent screenshots indexed. "
            f"To get precise, citation-grounded insights, select a Smart Folder "
            f"(such as Receipts & Invoices, Finance, or Projects) to chat within that specific context."
        )
        return citations, answer, follow_ups

    def _generate_answer_by_intent(
        self,
        query: str,
        folder_name: str,
        folder_ctx: Optional[Any],
        screenshots: List[Screenshot],
        citations: List[ChatMessageCitationDto],
    ) -> str:
        """Determines query intent and synthesizes a structured, factual answer."""
        q_lower = query.lower()

        # Parse context entities and tasks if available
        summary = ""
        tasks = []
        entities = {}
        if folder_ctx:
            summary = folder_ctx.Summary or ""
            try:
                tasks = json.loads(folder_ctx.TasksJson or "[]")
            except Exception:
                tasks = []
            try:
                entities = json.loads(folder_ctx.EntitiesJson or "{}")
            except Exception:
                entities = {}

        # 1. Intent: Expense / Money / Spending / Invoice amounts
        if any(w in q_lower for w in ["spend", "total", "cost", "amount", "price", "expense", "bill", "invoice", "paid"]):
            currencies = entities.get("currencies", [])
            # Also extract monetary amounts from screenshot OCR text
            ocr_amounts = []
            for s in screenshots:
                if s.OCRText:
                    found = re.findall(r"[\$₹€£]\s*[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s*(?:USD|INR|EUR|GBP)\b", s.OCRText)
                    ocr_amounts.extend(found)

            all_amounts = list(dict.fromkeys(currencies + ocr_amounts))
            if all_amounts:
                amounts_str = ", ".join(all_amounts[:6])
                return (
                    f"**Financial Overview for {folder_name}:**\n\n"
                    f"Detected monetary amounts in this folder: **{amounts_str}**.\n\n"
                    f"Based on {len(citations)} cited screenshot(s), these items correspond to transactions, invoices, or receipts. "
                    f"Check the citation cards below for the exact records."
                )
            else:
                return (
                    f"I analyzed {len(screenshots)} screenshot(s) in **{folder_name}**, but did not detect explicit currency amounts. "
                    f"Make sure screenshots with financial figures have completed OCR processing."
                )

        # 2. Intent: Tasks / To-dos / Deadlines / Action items
        if any(w in q_lower for w in ["task", "todo", "to-do", "deadline", "due", "action item", "meeting", "follow up"]):
            if tasks:
                tasks_bullets = "\n".join([f"- [ ] **{t.get('task')}** ({t.get('priority', 'Medium')} priority)" for t in tasks[:5]])
                return (
                    f"**Action Items & Deadlines in {folder_name}:**\n\n"
                    f"{tasks_bullets}\n\n"
                    f"These tasks were extracted from your screenshots and are ready for follow-up."
                )
            else:
                return (
                    f"No pending action items or deadlines were detected in **{folder_name}**. "
                    f"All screenshots appear to be informational records."
                )

        # 3. Intent: Contacts / People / Names / Organizations / Accounts
        if any(w in q_lower for w in ["who", "person", "people", "contact", "email", "phone", "merchant", "vendor", "company"]):
            emails = entities.get("emails", [])
            phones = entities.get("phones", [])
            names = entities.get("names", [])
            organizations = entities.get("organizations", [])

            lines = []
            if organizations:
                lines.append(f"- **Organizations / Vendors:** {', '.join(organizations[:5])}")
            if names:
                lines.append(f"- **Key People:** {', '.join(names[:5])}")
            if emails:
                lines.append(f"- **Email Addresses:** {', '.join(emails[:3])}")
            if phones:
                lines.append(f"- **Phone Numbers:** {', '.join(phones[:3])}")

            if lines:
                return (
                    f"**Entities & Contacts Detected in {folder_name}:**\n\n"
                    + "\n".join(lines)
                    + "\n\nReferenced from the cited screenshots below."
                )
            else:
                return f"No specific contacts, emails, or vendor names were identified in **{folder_name}**."

        # 4. Intent: Summary / Overview / What is in this folder
        if any(w in q_lower for w in ["summar", "overview", "what is", "tell me about", "what's in", "explain"]):
            if summary:
                return (
                    f"**Executive Summary for {folder_name}:**\n\n"
                    f"{summary}\n\n"
                    f"Analyzed **{len(screenshots)}** screenshot(s) categorized under this folder."
                )
            elif screenshots:
                topics = [s.DetectedApp or s.FileName for s in screenshots[:5]]
                return (
                    f"**Summary of {folder_name}:**\n\n"
                    f"This folder contains **{len(screenshots)}** screenshot(s), primarily involving: "
                    f"{', '.join(topics)}.\n\n"
                    f"You can ask me to extract expenses, action items, or look up specific details."
                )

        # 5. General / Specific Keyword Answer
        if citations:
            best_snippet = citations[0].snippet or ""
            return (
                f"Based on **{folder_name}**, here is the most relevant information found in **{citations[0].fileName}**:\n\n"
                f"> \"{best_snippet}\"\n\n"
                f"I referenced {len(citations)} screenshot(s) matching your inquiry."
            )

        return (
            f"I reviewed **{folder_name}** ({len(screenshots)} screenshots total). "
            f"Could you please specify whether you want to find expenses, deadlines, or specific text?"
        )

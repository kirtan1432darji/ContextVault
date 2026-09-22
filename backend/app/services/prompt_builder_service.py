import re
import json
from typing import Optional, List, Dict, Any, Tuple
from app.models.folder_context import FolderContext
from app.models.screenshot import Screenshot
from app.models.chat import ChatMessage
from app.schemas.chat import ChatMessageCitationDto

STOP_WORDS = {
    "the", "and", "or", "to", "in", "a", "of", "for", "on", "with", "at", "by", "from",
    "up", "about", "into", "over", "after", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "can", "could", "should", "would",
    "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their",
    "what", "which", "who", "whom", "how", "all", "any", "both", "each", "few", "more",
}


class PromptBuilderService:
    """
    ContextVault Grounded Prompt Synthesis Service.
    Transforms folder knowledge summaries, extracted entity categories, chronological
    timelines, actionable tasks, and OCR text excerpts into structured contextual prompts.
    Enforces privacy-first zero-image-binary retrieval-augmented generation.
    """

    INTENT_FINANCE = "finance"
    INTENT_TASKS = "tasks"
    INTENT_CONTACTS = "contacts"
    INTENT_SUMMARY = "summary"
    INTENT_TIMELINE = "timeline"
    INTENT_GENERAL = "general"

    FINANCE_KEYWORDS = [
        "spend", "spending", "total", "cost", "amount", "price", "expense",
        "bill", "invoice", "paid", "upi", "transaction", "balance", "bank", "receipt",
    ]
    TASK_KEYWORDS = [
        "task", "tasks", "todo", "to-do", "deadline", "deadlines", "due",
        "action item", "action items", "meeting", "follow up", "priority",
    ]
    CONTACT_KEYWORDS = [
        "who", "person", "people", "contact", "contacts", "email", "phone",
        "merchant", "vendor", "company", "doctor", "client", "team",
    ]
    SUMMARY_KEYWORDS = [
        "summar", "summary", "overview", "what is", "tell me about", "what's in", "explain",
    ]
    TIMELINE_KEYWORDS = [
        "timeline", "chronology", "when", "dates", "schedule", "history", "recent",
    ]

    def detect_intent(self, query: str) -> str:
        """Determines the semantic intent of the user's inquiry."""
        q = query.lower()
        if any(w in q for w in self.FINANCE_KEYWORDS):
            return self.INTENT_FINANCE
        if any(w in q for w in self.TASK_KEYWORDS):
            return self.INTENT_TASKS
        if any(w in q for w in self.CONTACT_KEYWORDS):
            return self.INTENT_CONTACTS
        if any(w in q for w in self.SUMMARY_KEYWORDS):
            return self.INTENT_SUMMARY
        if any(w in q for w in self.TIMELINE_KEYWORDS):
            return self.INTENT_TIMELINE
        return self.INTENT_GENERAL

    def extract_query_keywords(self, query: str) -> List[str]:
        """Extracts meaningful query keywords excluding common stop words."""
        tokens = re.findall(r"\w+", query.lower())
        return [t for t in tokens if len(t) > 2 and t not in STOP_WORDS]

    def parse_folder_context_block(self, folder_ctx: Optional[FolderContext]) -> Dict[str, Any]:
        """Parses JSON structures stored inside FolderContext into native Python objects."""
        if not folder_ctx:
            return {
                "summary": "",
                "tasks": [],
                "entities": {},
                "timeline": [],
                "topics": [],
            }

        summary = folder_ctx.Summary or ""
        try:
            tasks = json.loads(folder_ctx.TasksJson or "[]")
            if not isinstance(tasks, list):
                tasks = []
        except Exception:
            tasks = []

        try:
            entities = json.loads(folder_ctx.EntitiesJson or "{}")
            if not isinstance(entities, dict):
                entities = {}
        except Exception:
            entities = {}

        try:
            timeline = json.loads(folder_ctx.TimelineJson or "[]")
            if not isinstance(timeline, list):
                timeline = []
        except Exception:
            timeline = []

        try:
            topics = json.loads(folder_ctx.TopicsJson or "[]")
            if not isinstance(topics, list):
                topics = []
        except Exception:
            topics = []

        return {
            "summary": summary,
            "tasks": tasks,
            "entities": entities,
            "timeline": timeline,
            "topics": topics,
        }

    def build_grounded_prompt(
        self,
        folder_name: str,
        folder_ctx: Optional[FolderContext],
        screenshots: List[Screenshot],
        session_history: List[ChatMessage],
        query: str,
    ) -> Dict[str, Any]:
        """
        Synthesizes a complete grounded context payload including system instructions,
        parsed knowledge context, chronological conversation turns, and OCR snippets.
        """
        intent = self.detect_intent(query)
        parsed_ctx = self.parse_folder_context_block(folder_ctx)
        query_words = self.extract_query_keywords(query)

        # Build snippets from screenshots
        snippets = []
        for s in screenshots:
            if s.OCRText:
                text_lower = s.OCRText.lower()
                matched = any(w in text_lower for w in query_words)
                if matched or not query_words:
                    snippets.append({
                        "screenshotId": str(s.Id),
                        "fileName": s.FileName,
                        "ocrExcerpt": s.OCRText[:200].strip(),
                        "detectedApp": s.DetectedApp or "Unknown",
                    })

        # Format recent dialogue
        dialogue = []
        for msg in session_history[-6:]:
            dialogue.append({
                "role": msg.Role,
                "message": msg.Message,
            })

        return {
            "system": (
                "You are ContextVault AI, an intelligent, privacy-first screenshot assistant. "
                "All answers must be grounded in the user's stored metadata and OCR text. "
                "Never fabricate facts or reference image pixels directly."
            ),
            "folderName": folder_name,
            "intent": intent,
            "summary": parsed_ctx["summary"],
            "tasks": parsed_ctx["tasks"],
            "entities": parsed_ctx["entities"],
            "timeline": parsed_ctx["timeline"],
            "topics": parsed_ctx["topics"],
            "snippets": snippets[:5],
            "dialogue": dialogue,
            "query": query,
        }

    def synthesize_grounded_answer(
        self,
        query: str,
        folder_name: str,
        folder_ctx: Optional[FolderContext],
        screenshots: List[Screenshot],
        citations: List[ChatMessageCitationDto],
    ) -> str:
        """
        Synthesizes a human-readable, factual answer grounded in folder entities,
        tasks, timeline events, and OCR text.
        """
        intent = self.detect_intent(query)
        ctx_data = self.parse_folder_context_block(folder_ctx)
        summary = ctx_data["summary"]
        tasks = ctx_data["tasks"]
        entities = ctx_data["entities"]
        timeline = ctx_data["timeline"]

        # 1. Financial / Expenses / Invoices Intent
        if intent == self.INTENT_FINANCE:
            currencies = entities.get("currencies", [])
            ocr_amounts = []
            for s in screenshots:
                if s.OCRText:
                    found = re.findall(
                        r"[\$₹€£]\s*[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s*(?:USD|INR|EUR|GBP)\b",
                        s.OCRText,
                    )
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
            return (
                f"I analyzed {len(screenshots)} screenshot(s) in **{folder_name}**, but did not detect explicit currency amounts. "
                f"Make sure screenshots with financial figures have completed OCR processing."
            )

        # 2. Tasks / Action Items / Deadlines Intent
        if intent == self.INTENT_TASKS:
            if tasks:
                tasks_bullets = "\n".join([
                    f"- [ ] **{t.get('task')}** ({t.get('priority', 'Medium')} priority)"
                    for t in tasks[:5]
                ])
                return (
                    f"**Action Items & Deadlines in {folder_name}:**\n\n"
                    f"{tasks_bullets}\n\n"
                    f"These tasks were extracted from your screenshots and are ready for follow-up."
                )
            return (
                f"No pending action items or deadlines were detected in **{folder_name}**. "
                f"All screenshots appear to be informational records."
            )

        # 3. Contacts / People / Vendors / Entities Intent
        if intent == self.INTENT_CONTACTS:
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
            return f"No specific contacts, emails, or vendor names were identified in **{folder_name}**."

        # 4. Timeline / Dates Intent
        if intent == self.INTENT_TIMELINE:
            if timeline:
                events_str = "\n".join([
                    f"- **{evt.get('date', 'Unknown Date')}:** {evt.get('title', 'Event')} — {evt.get('description', '')}"
                    for evt in timeline[:5]
                ])
                return (
                    f"**Timeline of Events in {folder_name}:**\n\n"
                    f"{events_str}\n\n"
                    f"Chronologically ordered based on screenshot timestamps and OCR date mentions."
                )

        # 5. Summary / Overview Intent
        if intent == self.INTENT_SUMMARY:
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

        # 6. General / Specific Keyword Intent
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

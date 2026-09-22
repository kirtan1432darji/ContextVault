import re
import json
import uuid
from typing import Optional, List, Tuple
from app.models.screenshot import Screenshot
from app.schemas.chat import ChatMessageCitationDto

STOP_WORDS = {
    "the", "and", "or", "to", "in", "a", "of", "for", "on", "with", "at", "by", "from",
    "up", "about", "into", "over", "after", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "can", "could", "should", "would",
    "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their",
    "what", "which", "who", "whom", "how", "all", "any", "both", "each", "few", "more",
}


class CitationService:
    """
    ContextVault Grounded Citation Resolution Service.
    Resolves, ranks, and formats screenshot references from OCR text, filename,
    and app metadata to provide transparent attribution for Context AI responses.
    """

    def build_citation(
        self, screenshot: Screenshot, snippet: Optional[str] = None
    ) -> ChatMessageCitationDto:
        """Constructs a validated citation DTO from a screenshot model."""
        clean_snippet = snippet
        if not clean_snippet:
            if screenshot.OCRText:
                clean_snippet = screenshot.OCRText[:120].replace("\n", " ").strip()
            else:
                clean_snippet = screenshot.FileName

        return ChatMessageCitationDto(
            screenshotId=screenshot.Id,
            fileName=screenshot.FileName,
            snippet=clean_snippet[:160] if clean_snippet else "Screenshot context",
            thumbnailPath=screenshot.DeviceFolder,
        )

    def find_citation_for_screenshot(
        self, screenshot: Screenshot
    ) -> ChatMessageCitationDto:
        """Constructs a citation for a single targeted screenshot."""
        return self.build_citation(screenshot)

    def find_citations_for_query(
        self,
        query: str,
        screenshots: List[Screenshot],
        max_citations: int = 4,
    ) -> List[ChatMessageCitationDto]:
        """
        Ranks screenshots by keyword relevance against OCR text, app name, and file name,
        extracting optimal surrounding text windows for citation preview cards.
        """
        if not screenshots:
            return []

        query_tokens = [
            t.lower()
            for t in re.findall(r"\w+", query)
            if len(t) > 2 and t.lower() not in STOP_WORDS
        ]

        scored: List[Tuple[Screenshot, int, str]] = []

        for s in screenshots:
            score = 0
            snippet = ""
            full_text = f"{s.OCRText or ''} {s.FileName or ''} {s.DetectedApp or ''}"
            text_lower = full_text.lower()

            for token in query_tokens:
                if token in text_lower:
                    score += 2
                    # Find surrounding snippet window around the match
                    idx = text_lower.find(token)
                    start = max(0, idx - 40)
                    end = min(len(full_text), idx + len(token) + 60)
                    snippet = full_text[start:end].replace("\n", " ").strip()

            if score > 0:
                scored.append((s, score, snippet or (s.OCRText[:100] if s.OCRText else s.FileName)))
            elif not query_tokens and len(scored) < max_citations:
                scored.append((s, 1, s.OCRText[:100] if s.OCRText else s.FileName))

        scored.sort(key=lambda x: x[1], reverse=True)

        citations: List[ChatMessageCitationDto] = []
        for s, _, snip in scored[:max_citations]:
            citations.append(self.build_citation(s, snip))

        # Fallback: if no keyword matches but screenshots exist, cite the most recent screenshot
        if not citations and screenshots:
            citations.append(self.build_citation(screenshots[0]))

        return citations

    def serialize_citations(self, citations: List[ChatMessageCitationDto]) -> str:
        """Serializes citation DTOs into JSON string for database persistence."""
        return json.dumps([c.model_dump(mode="json") for c in citations])

    def deserialize_citations(
        self, citations_json: Optional[str]
    ) -> List[ChatMessageCitationDto]:
        """Safely deserializes stored JSON string into typed citation DTOs."""
        if not citations_json:
            return []
        try:
            raw_list = json.loads(citations_json)
            if not isinstance(raw_list, list):
                return []
            citations = []
            for item in raw_list:
                if isinstance(item, dict) and "screenshotId" in item:
                    citations.append(
                        ChatMessageCitationDto(
                            screenshotId=uuid.UUID(str(item["screenshotId"])),
                            fileName=item.get("fileName", "screenshot.png"),
                            snippet=item.get("snippet"),
                            thumbnailPath=item.get("thumbnailPath"),
                        )
                    )
            return citations
        except Exception:
            return []

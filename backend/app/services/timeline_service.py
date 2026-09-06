import re
from datetime import datetime, timezone
from typing import List, Optional
from app.models.screenshot import Screenshot
from app.schemas.context import TimelineEventDto
from app.schemas.classification import ExtractedEntitiesDto


class TimelineService:
    """
    Timeline Generation Engine.
    Transforms screenshot metadata and OCR intelligence into a chronological event narrative.
    Sorts events strictly from oldest to newest.
    """

    def generate_timeline(
        self,
        screenshots: List[Screenshot],
        entities_map: Optional[dict[str, ExtractedEntitiesDto]] = None,
    ) -> List[TimelineEventDto]:
        """
        Builds chronological event timeline from a list of screenshots.
        Sorted: oldest -> newest.
        """
        events: List[TimelineEventDto] = []

        for s in screenshots:
            ocr_clean = (s.OCRText or "").strip()
            text_lower = ocr_clean.lower()
            detected_app = s.DetectedApp or ""
            sub_cat = s.SubCategory or ""
            cat_name = s.category.Name if s.category else (sub_cat or "General")

            entities = entities_map.get(str(s.Id)) if entities_map else None

            # Determine event type
            event_type = self._determine_event_type(cat_name, text_lower, detected_app)

            # Determine event title
            event_title = self._determine_event_title(
                cat_name, sub_cat, event_type, detected_app, entities, text_lower
            )

            # Determine event description
            event_desc = self._determine_event_description(
                ocr_clean, event_type, entities, detected_app
            )

            events.append(
                TimelineEventDto(
                    timestamp=s.CreatedOn,
                    screenshotId=s.Id,
                    fileName=s.FileName,
                    eventTitle=event_title,
                    eventDescription=event_desc,
                    eventType=event_type,
                )
            )

        # Sort strictly oldest -> newest
        events.sort(key=lambda ev: ev.timestamp)
        return events

    def _determine_event_type(
        self, category: str, text_lower: str, detected_app: str
    ) -> str:
        cat_lower = category.lower()
        if "finance" in cat_lower or "bank" in cat_lower or "upi" in text_lower or detected_app in ["Google Pay", "PhonePe", "Paytm"]:
            return "payment"
        elif "receipt" in cat_lower or "invoice" in cat_lower or "tax invoice" in text_lower:
            return "receipt"
        elif "travel" in cat_lower or "ticket" in cat_lower or "flight" in text_lower or "pnr" in text_lower:
            return "travel"
        elif "shopping" in cat_lower or "order" in text_lower or "wishlist" in text_lower:
            return "shopping"
        elif "document" in cat_lower or "passport" in text_lower or "aadhaar" in text_lower or "license" in text_lower:
            return "document"
        elif "code" in cat_lower or "tech" in cat_lower or "github" in text_lower:
            return "code"
        elif "social" in cat_lower or "chat" in cat_lower or detected_app in ["WhatsApp", "Telegram", "Instagram", "Discord"]:
            return "communication"
        elif "project" in cat_lower or "work" in cat_lower or "todo" in text_lower or "jira" in text_lower:
            return "task"
        elif "note" in cat_lower or "knowledge" in cat_lower:
            return "note"
        return "general"

    def _determine_event_title(
        self,
        category: str,
        subcategory: str,
        event_type: str,
        app: str,
        entities: Optional[ExtractedEntitiesDto],
        text_lower: str,
    ) -> str:
        merchants = entities.merchants if entities and entities.merchants else []
        amounts = entities.amounts if entities and entities.amounts else []

        if event_type == "payment":
            target = merchants[0] if merchants else (app or "Account")
            amt = f" of {amounts[0]}" if amounts else ""
            return f"Payment to {target}{amt}"

        elif event_type == "receipt":
            vendor = merchants[0] if merchants else (subcategory or "Merchant")
            return f"Invoice / Bill from {vendor}"

        elif event_type == "travel":
            return f"Travel Booking: {subcategory or 'Tickets & Passes'}"

        elif event_type == "shopping":
            merchant = merchants[0] if merchants else (app or "Store")
            return f"Shopping Item / Order from {merchant}"

        elif event_type == "document":
            return f"Document Stored: {subcategory or 'Official ID'}"

        elif event_type == "code":
            return f"Technical Snippet: {subcategory or 'Code Reference'}"

        elif event_type == "communication":
            source = app or subcategory or "Messaging"
            return f"Chat / Message via {source}"

        elif event_type == "task":
            return f"Action Item: {subcategory or 'Work Update'}"

        return f"{category}: {subcategory}" if subcategory else f"{category} Snapshot"

    def _determine_event_description(
        self,
        ocr_text: str,
        event_type: str,
        entities: Optional[ExtractedEntitiesDto],
        app: str,
    ) -> str:
        if not ocr_text:
            return "Screenshot captured with no detectable OCR text."

        highlights = []
        if app:
            highlights.append(f"Recorded in {app}")
        if entities:
            if entities.amounts:
                highlights.append(f"Amount: {entities.amounts[0]}")
            if entities.dates:
                highlights.append(f"Date: {entities.dates[0]}")
            if entities.invoiceNumbers:
                highlights.append(f"Ref: {entities.invoiceNumbers[0]}")

        snippet = re.sub(r"\s+", " ", ocr_text[:160]).strip()
        highlight_str = f" ({', '.join(highlights)})" if highlights else ""
        return f"{snippet}{highlight_str}"

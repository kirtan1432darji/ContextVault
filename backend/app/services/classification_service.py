import re
import uuid
from typing import Optional, List, Dict, Any, Tuple
from app.schemas.classification import (
    ClassificationResultDto,
    ExtractedEntitiesDto,
)


class ClassificationService:
    """
    Deterministic rule-based NLP and entity classification engine.
    Analyzes OCR text streams, file names, and app telemetry to categorize screenshots
    into ContextVault's 11 canonical smart folders with multi-tier nesting.
    """

    # Regex patterns for entity extraction
    CURRENCY_REGEX = re.compile(
        r"(?:[\$\€\£\₹]|USD|EUR|GBP|INR|Rs\.?)\s*[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})\s*(?:USD|EUR|GBP|INR)",
        re.IGNORECASE,
    )
    URL_REGEX = re.compile(
        r"https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)",
        re.IGNORECASE,
    )
    EMAIL_REGEX = re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b",
        re.IGNORECASE,
    )
    PHONE_REGEX = re.compile(
        r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[-.\s]?[6-9]\d{9}",
    )
    DATE_REGEX = re.compile(
        r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b",
        re.IGNORECASE,
    )

    # Known Merchants & Platforms
    MERCHANTS = [
        "Amazon", "Flipkart", "Walmart", "Target", "Best Buy", "eBay", "AliExpress",
        "Apple", "Google", "Microsoft", "Netflix", "Spotify", "Steam", "PlayStation",
        "Uber", "Lyft", "Swiggy", "Zomato", "DoorDash", "Instacart", "Starbucks", "McDonald's",
        "Nike", "Adidas", "Zara", "H&M", "Sephora", "IKEA", "Airbnb", "Booking.com",
        "Delta", "United", "American Airlines", "Indigo", "MakeMyTrip", "Expedia",
    ]

    # Known Source Apps & Packages
    APP_SIGNATURES = {
        "com.whatsapp": "WhatsApp",
        "whatsapp": "WhatsApp",
        "org.telegram.messenger": "Telegram",
        "telegram": "Telegram",
        "com.instagram.android": "Instagram",
        "instagram": "Instagram",
        "com.twitter.android": "Twitter/X",
        "twitter": "Twitter/X",
        "com.discord": "Discord",
        "discord": "Discord",
        "com.slack": "Slack",
        "slack": "Slack",
        "com.github.android": "GitHub",
        "github": "GitHub",
        "com.google.android.apps.nbu.paisa.user": "Google Pay",
        "gpay": "Google Pay",
        "google pay": "Google Pay",
        "com.phonepe.app": "PhonePe",
        "phonepe": "PhonePe",
        "net.one97.paytm": "Paytm",
        "paytm": "Paytm",
        "com.amazon.mShop.android.shopping": "Amazon",
        "amazon": "Amazon",
        "vscode": "VS Code",
    }

    # Canonical Category Rules: list of (keyword, weight)
    CATEGORY_RULES = {
        "Receipts & Invoices": [
            ("tax invoice", 5.0), ("invoice", 4.0), ("receipt", 4.0), ("subtotal", 3.5),
            ("grand total", 4.0), ("amount paid", 3.5), ("order summary", 3.0),
            ("bill to", 3.5), ("order id", 2.5), ("gstin", 4.0), ("vat", 3.0),
            ("cashier", 2.5), ("merchant copy", 3.0), ("payment confirmed", 2.5),
            ("delivery charge", 2.0),
        ],
        "Finance & Banking": [
            ("upi ref", 4.5), ("account balance", 4.0), ("bank statement", 4.5),
            ("transaction successful", 3.5), ("credited to", 3.5), ("debited from", 3.5),
            ("credit card", 3.0), ("debit card", 3.0), ("savings account", 3.5),
            ("imps", 3.0), ("neft", 3.0), ("rtgs", 3.0), ("crypto", 3.0),
            ("bitcoin", 3.5), ("ethereum", 3.5), ("wallet balance", 3.0),
            ("portfolio", 2.5), ("mutual fund", 3.0), ("demat", 3.0),
        ],
        "Projects / Work": [
            ("sprint", 4.0), ("jira", 4.0), ("trello", 3.5), ("linear", 3.5),
            ("milestone", 3.0), ("deliverable", 3.0), ("timesheet", 3.5),
            ("payroll", 3.5), ("client", 2.5), ("deadline", 2.5), ("spec", 2.0),
            ("figma", 3.0), ("confluence", 3.0), ("meeting minutes", 3.0),
            ("standup", 3.0), ("roadmap", 3.0), ("project management", 3.5),
        ],
        "Shopping & Wishlist": [
            ("add to cart", 4.5), ("buy now", 4.0), ("wishlist", 4.5),
            ("out of stock", 3.5), ("in stock", 3.0), ("price drop", 3.5),
            ("item details", 2.5), ("shipping address", 2.5), ("delivery by", 2.5),
            ("customer reviews", 2.5), ("free delivery", 2.0), ("size chart", 3.0),
            ("product description", 2.5),
        ],
        "Code & Tech": [
            ("import ", 3.5), ("def ", 3.5), ("function ", 3.5), ("const ", 3.0),
            ("class ", 2.5), ("return ", 2.5), ("git push", 4.5), ("git commit", 4.5),
            ("github", 4.0), ("stack trace", 4.5), ("traceback", 4.5),
            ("exception:", 4.0), ("nullpointerexception", 4.5), ("syntaxerror", 4.5),
            ("docker", 3.5), ("npm install", 4.0), ("pip install", 4.0),
            ("terminal", 3.0), ("bash", 3.0), ("sql", 2.5), ("fastapi", 3.5),
        ],
        "Social & Chat": [
            ("online", 1.5), ("typing...", 4.5), ("last seen", 4.5),
            ("read receipt", 3.5), ("forwarded", 3.0), ("voice call", 3.0),
            ("video call", 3.0), ("view once", 4.0), ("tweet", 4.0),
            ("retweet", 4.0), ("dm", 2.0), ("followers", 2.5), ("following", 2.5),
            ("unsend", 3.0), ("message deleted", 3.0),
        ],
        "Documents & IDs": [
            ("passport", 5.0), ("driving license", 5.0), ("driver license", 5.0),
            ("identity card", 4.5), ("national id", 4.5), ("aadhaar", 5.0),
            ("pan card", 5.0), ("social security", 5.0), ("ssn", 4.0),
            ("date of birth", 3.0), ("dob:", 3.0), ("expiry date", 2.5),
            ("contract agreement", 4.5), ("non-disclosure agreement", 5.0),
            ("nda", 3.5), ("certificate of", 4.0),
        ],
        "Travel & Tickets": [
            ("boarding pass", 5.0), ("flight", 3.5), ("terminal", 3.0), ("gate", 3.0),
            ("seat:", 3.0), ("pnr", 4.5), ("airline", 3.5), ("departure", 3.0),
            ("arrival", 3.0), ("train ticket", 4.5), ("booking reference", 4.0),
            ("check-in", 3.0), ("check-out", 3.0), ("hotel reservation", 4.5),
            ("itinerary", 3.5), ("e-ticket", 4.5),
        ],
        "Notes & Knowledge": [
            ("chapter", 3.0), ("lecture notes", 4.5), ("definition:", 3.5),
            ("study guide", 4.5), ("summary", 2.5), ("recipe", 4.5),
            ("ingredients:", 4.5), ("instructions:", 3.0), ("wikipedia", 3.5),
            ("bibliography", 4.0), ("key takeaways", 3.5), ("table of contents", 3.0),
        ],
        "Memes & Humor": [
            ("nobody:", 5.0), ("me when", 4.5), ("pov:", 4.0), ("relatable", 3.5),
            ("lol", 2.0), ("lmao", 2.5), ("meme", 4.0), ("funny", 2.0),
        ],
    }

    def extract_entities(self, text: str) -> ExtractedEntitiesDto:
        """Extracts structured entities from OCR raw text."""
        if not text:
            return ExtractedEntitiesDto()

        amounts = list(dict.fromkeys(self.CURRENCY_REGEX.findall(text)))
        urls = list(dict.fromkeys(self.URL_REGEX.findall(text)))
        emails = list(dict.fromkeys(self.EMAIL_REGEX.findall(text)))
        phones = list(dict.fromkeys(self.PHONE_REGEX.findall(text)))
        dates = list(dict.fromkeys(self.DATE_REGEX.findall(text)))

        # Find merchants
        text_lower = text.lower()
        found_merchants = [m for m in self.MERCHANTS if m.lower() in text_lower]

        # Find project names
        found_projects = []
        project_match = re.search(r"(?:project|client|repo)\s*[:\-]\s*([a-zA-Z0-9_\-]+)", text, re.IGNORECASE)
        if project_match:
            found_projects.append(project_match.group(1))
        if "contextvault" in text_lower:
            found_projects.append("ContextVault")

        return ExtractedEntitiesDto(
            amounts=amounts[:5],
            urls=urls[:5],
            emails=emails[:5],
            phoneNumbers=phones[:5],
            merchants=found_merchants[:5],
            projectNames=found_projects[:5],
            dates=dates[:5],
        )

    def detect_app_source(self, raw_app: Optional[str], text: str) -> Optional[str]:
        """Resolves source app name from explicit telemetry or OCR signatures."""
        if raw_app:
            clean_raw = raw_app.strip().lower()
            for pattern, name in self.APP_SIGNATURES.items():
                if pattern in clean_raw:
                    return name
            return raw_app.strip()

        # Fallback to OCR text detection
        text_lower = text.lower()
        for pattern, name in self.APP_SIGNATURES.items():
            if pattern in text_lower:
                return name
        return None

    def classify(
        self,
        ocr_text: str,
        file_name: Optional[str] = None,
        detected_app: Optional[str] = None,
        hint: Optional[str] = None,
    ) -> ClassificationResultDto:
        """
        Runs rule-based NLP classification over screenshot metadata.
        Returns canonical category, subcategory, hierarchical folder path,
        confidence score, extracted entities, suggested tags, and summary.
        """
        combined_text = f"{file_name or ''} {detected_app or ''} {hint or ''} {ocr_text or ''}".strip()
        text_lower = combined_text.lower()

        entities = self.extract_entities(ocr_text or "")
        resolved_app = self.detect_app_source(detected_app, combined_text)

        scores: Dict[str, float] = {cat: 0.0 for cat in self.CATEGORY_RULES.keys()}

        # Keyword matching
        for category, rules in self.CATEGORY_RULES.items():
            for keyword, weight in rules:
                if keyword in text_lower:
                    scores[category] += weight

        # App telemetry bias
        if resolved_app:
            if resolved_app in ["WhatsApp", "Telegram", "Instagram", "Twitter/X", "Discord"]:
                scores["Social & Chat"] += 6.0
            elif resolved_app in ["Google Pay", "PhonePe", "Paytm"]:
                scores["Finance & Banking"] += 6.0
            elif resolved_app in ["GitHub", "VS Code"]:
                scores["Code & Tech"] += 6.0
            elif resolved_app in ["Slack"]:
                scores["Projects / Work"] += 4.0
            elif resolved_app in ["Amazon"]:
                scores["Shopping & Wishlist"] += 4.0

        # Entity presence bonus
        if entities.amounts:
            if "tax invoice" in text_lower or "invoice" in text_lower or "receipt" in text_lower:
                scores["Receipts & Invoices"] += 4.0
            else:
                scores["Finance & Banking"] += 2.5
        if entities.merchants:
            scores["Receipts & Invoices"] += 2.0
            scores["Shopping & Wishlist"] += 2.0

        # Find best category
        best_category, max_score = max(scores.items(), key=lambda item: item[1])

        # Confidence calculation
        if max_score < 2.0:
            category = "Unsorted"
            confidence = 0.15
        else:
            category = best_category
            confidence = min(0.98, max(0.35, 0.40 + (max_score / 25.0)))

        # Subcategory and multi-tier folder path derivation
        sub_category, folder_path = self._determine_subcategory_and_path(
            category, text_lower, entities, resolved_app
        )

        # Suggested tags
        suggested_tags = self._generate_suggested_tags(
            category, sub_category, entities, resolved_app
        )

        # Executive summary
        summary = self._generate_summary(
            category, sub_category, entities, resolved_app, ocr_text
        )

        return ClassificationResultDto(
            screenshotId=None,
            category=category,
            categoryId=None,
            subCategory=sub_category,
            folderPath=folder_path,
            confidence=round(confidence, 2),
            detectedApp=resolved_app,
            suggestedTags=suggested_tags,
            entities=entities,
            summary=summary,
            modelName="RuleEngine-v1.0",
        )

    def _determine_subcategory_and_path(
        self,
        category: str,
        text_lower: str,
        entities: ExtractedEntitiesDto,
        app: Optional[str],
    ) -> Tuple[Optional[str], List[str]]:
        path = [category]
        sub = None

        if category == "Receipts & Invoices":
            if entities.merchants:
                sub = entities.merchants[0]
            elif "invoice" in text_lower:
                sub = "Invoices"
            else:
                sub = "Orders"
            path.append(sub)

        elif category == "Finance & Banking":
            if "upi" in text_lower or (app and "pay" in app.lower()):
                sub = "UPI Transfers"
            elif "statement" in text_lower:
                sub = "Bank Statements"
            elif "crypto" in text_lower or "bitcoin" in text_lower:
                sub = "Crypto"
            elif "credit card" in text_lower:
                sub = "Credit Cards"
            else:
                sub = "Transfers"
            path.append(sub)

        elif category == "Projects / Work":
            # Multi-tier support: Projects -> Client/Project -> Tasks/Specs/Payroll
            target_proj = entities.projectNames[0] if entities.projectNames else "Internal"
            path.append(target_proj)
            if "payroll" in text_lower:
                sub = "Payroll"
                path.append(sub)
            elif "spec" in text_lower:
                sub = "Specs"
                path.append(sub)
            else:
                sub = "Tasks"
                path.append(sub)

        elif category == "Shopping & Wishlist":
            if "shoe" in text_lower or "sneaker" in text_lower:
                sub = "Shoes"
            elif "electronic" in text_lower or "phone" in text_lower or "laptop" in text_lower:
                sub = "Electronics"
            elif "shirt" in text_lower or "dress" in text_lower or "fashion" in text_lower:
                sub = "Fashion"
            elif entities.merchants:
                sub = entities.merchants[0]
            else:
                sub = "Wishlist"
            path.append(sub)

        elif category == "Code & Tech":
            if "github" in text_lower or app == "GitHub":
                sub = "GitHub"
            elif "stack trace" in text_lower or "traceback" in text_lower:
                sub = "Stack Traces"
            elif "terminal" in text_lower or "bash" in text_lower:
                sub = "Terminal & Logs"
            else:
                sub = "Snippets"
            path.append(sub)

        elif category == "Social & Chat":
            sub = app or "Messages"
            path.append(sub)

        elif category == "Documents & IDs":
            if "passport" in text_lower:
                sub = "Passports"
            elif "driving license" in text_lower or "driver license" in text_lower:
                sub = "Driver Licenses"
            elif "aadhaar" in text_lower or "pan card" in text_lower or "ssn" in text_lower:
                sub = "National IDs"
            else:
                sub = "Contracts"
            path.append(sub)

        elif category == "Travel & Tickets":
            if "flight" in text_lower or "boarding pass" in text_lower:
                sub = "Flights"
            elif "train" in text_lower:
                sub = "Train Tickets"
            elif "hotel" in text_lower:
                sub = "Hotels"
            else:
                sub = "Bookings"
            path.append(sub)

        elif category == "Notes & Knowledge":
            if "recipe" in text_lower or "ingredients" in text_lower:
                sub = "Recipes"
            elif "lecture" in text_lower or "study" in text_lower:
                sub = "Study Notes"
            else:
                sub = "Knowledge"
            path.append(sub)

        elif category == "Memes & Humor":
            sub = "Memes"
            path.append(sub)

        return sub, path

    def _generate_suggested_tags(
        self,
        category: str,
        subcategory: Optional[str],
        entities: ExtractedEntitiesDto,
        app: Optional[str],
    ) -> List[str]:
        tags = set()
        if category and category != "Unsorted":
            tags.add(category.split("&")[0].split("/")[0].strip())
        if subcategory:
            tags.add(subcategory)
        if app:
            tags.add(app)
        for m in entities.merchants:
            tags.add(m)
        for p in entities.projectNames:
            tags.add(p)
        return sorted(list(tags))[:8]

    def _generate_summary(
        self,
        category: str,
        subcategory: Optional[str],
        entities: ExtractedEntitiesDto,
        app: Optional[str],
        ocr_text: str,
    ) -> str:
        if category == "Unsorted":
            return "Unsorted screenshot awaiting further processing or OCR review."

        details = []
        if app:
            details.append(f"from {app}")
        if entities.merchants:
            details.append(f"for {entities.merchants[0]}")
        if entities.amounts:
            details.append(f"amounting to {entities.amounts[0]}")
        if entities.dates:
            details.append(f"dated {entities.dates[0]}")

        detail_phrase = f" {' '.join(details)}" if details else ""
        sub_phrase = f" ({subcategory})" if subcategory else ""
        return f"{category}{sub_phrase} captured{detail_phrase}."

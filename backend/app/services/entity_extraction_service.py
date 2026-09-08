import re
from typing import Dict, List, Any
from app.schemas.classification import ExtractedEntitiesDto


class EntityExtractionService:
    """
    High-accuracy deterministic NLP Entity Extraction & Normalization Service.
    Extracts 14 canonical structured entity categories from OCR text streams:
    1. Organizations
    2. People
    3. Dates
    4. URLs
    5. Emails
    6. Phone Numbers
    7. Currency Amounts
    8. UPI IDs
    9. Bank Accounts
    10. Invoice Numbers
    11. Project Names
    12. Ticket Numbers
    13. Shopping Items
    14. Document IDs
    """

    # Regex patterns
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
    UPI_REGEX = re.compile(
        r"\b[a-zA-Z0-9.\-_]{2,49}@(okhdfcbank|okaxis|oksbi|okicici|paytm|ybl|axl|ibl|upi|apl|fbl|idfcbank|sbi|hdfcbank|icici|axisbank)\b",
        re.IGNORECASE,
    )
    BANK_ACCOUNT_REGEX = re.compile(
        r"\b(?:A/C|A/c|Account|Acc(?:\.|\s+No\.?|Number)?)\s*[:\-#]?\s*([xX*0-9]{4,18})\b",
        re.IGNORECASE,
    )
    IFSC_REGEX = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")
    INVOICE_REGEX = re.compile(
        r"\b(?:INV|Invoice|Bill|Receipt|Order|Ref)\s*[-#:]?\s*([A-Za-z0-9\-_/]{4,24})\b",
        re.IGNORECASE,
    )
    TICKET_PNR_REGEX = re.compile(
        r"\b(?:PNR|Booking\s+Ref(?:erence)?|Ticket\s+(?:No|#|ID)|Flight)\s*[:\-#]?\s*([A-Za-z0-9\-_]{5,15})\b",
        re.IGNORECASE,
    )
    JIRA_KEY_REGEX = re.compile(r"\b[A-Z]{2,10}-[0-9]{1,6}\b")
    AADHAAR_REGEX = re.compile(r"\b[2-9]\d{3}\s\d{4}\s\d{4}\b")
    PAN_REGEX = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b")
    SSN_REGEX = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
    PERSON_TITLE_REGEX = re.compile(
        r"\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b"
    )
    PERSON_HEADER_REGEX = re.compile(
        r"(?:To|From|By|Sent by|Attendee|Assignee|Speaker|Organizer)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        re.IGNORECASE,
    )
    ORG_SUFFIX_REGEX = re.compile(
        r"\b([A-Z][a-zA-Z0-9&]+(?:\s+[A-Z][a-zA-Z0-9&]+)*\s+(?:Inc|LLC|Ltd|Corp|Corporation|Pvt\s+Ltd|Technologies|Solutions|Enterprises|GmbH|Co\.))\b"
    )
    SHOPPING_ITEM_REGEX = re.compile(
        r"(?:Item|Product|Description)\s*[:\-]\s*([A-Za-z0-9\s\-_]{3,40})(?:\s*x\s*\d+|\n|$|\s*[\$\₹])",
        re.IGNORECASE,
    )

    KNOWN_ORGANIZATIONS = [
        "Amazon", "Flipkart", "Walmart", "Target", "Best Buy", "eBay", "AliExpress",
        "Apple", "Google", "Microsoft", "Netflix", "Spotify", "Steam", "PlayStation",
        "Uber", "Lyft", "Swiggy", "Zomato", "DoorDash", "Instacart", "Starbucks", "McDonald's",
        "Nike", "Adidas", "Zara", "H&M", "Sephora", "IKEA", "Airbnb", "Booking.com",
        "Delta", "United", "American Airlines", "Indigo", "MakeMyTrip", "Expedia",
        "GitHub", "Slack", "Discord", "OpenAI", "Anthropic", "HDFC Bank", "ICICI Bank",
        "State Bank of India", "Axis Bank", "Chase", "Bank of America", "PayPal", "Stripe",
        "Razorpay", "PhonePe", "Paytm", "Google Pay", "ContextVault",
    ]

    def extract_entities(self, text: str) -> ExtractedEntitiesDto:
        """Extracts and normalizes all 14 structured entity types from text."""
        if not text:
            return ExtractedEntitiesDto()

        text_clean = text.strip()
        text_lower = text_clean.lower()

        # 1. Currency Amounts
        amounts = self._clean_list(self.CURRENCY_REGEX.findall(text_clean), max_items=10)

        # 2. URLs
        urls = self._clean_list(self.URL_REGEX.findall(text_clean), max_items=10, lowercase=True)

        # 3. Emails
        emails = self._clean_list(self.EMAIL_REGEX.findall(text_clean), max_items=10, lowercase=True)

        # 4. Phone Numbers
        phone_matches = self.PHONE_REGEX.findall(text_clean)
        phones = self._clean_list(phone_matches, max_items=10)

        # 5. Dates
        dates = self._clean_list(self.DATE_REGEX.findall(text_clean), max_items=10)

        # 6. UPI IDs
        upi_ids = []
        for m in self.UPI_REGEX.finditer(text_clean):
            upi_ids.append(m.group(0).lower())
        upi_ids = self._clean_list(upi_ids, max_items=8)

        # 7. Bank Accounts / IFSC
        bank_accounts = []
        for m in self.BANK_ACCOUNT_REGEX.finditer(text_clean):
            val = m.group(1).strip()
            if len(val) >= 4:
                bank_accounts.append(val)
        for m in self.IFSC_REGEX.finditer(text_clean):
            bank_accounts.append(f"IFSC:{m.group(0).upper()}")
        bank_accounts = self._clean_list(bank_accounts, max_items=6)

        # 8. Invoice Numbers
        invoice_numbers = []
        for m in self.INVOICE_REGEX.finditer(text_clean):
            val = m.group(1).strip()
            if len(val) >= 3 and not val.lower() in ["the", "this", "total", "date"]:
                invoice_numbers.append(val)
        invoice_numbers = self._clean_list(invoice_numbers, max_items=6)

        # 9. Project Names
        project_names = []
        proj_match = re.search(r"(?:project|client|repo)\s*[:\-]\s*([a-zA-Z0-9_\-]+)", text_clean, re.IGNORECASE)
        if proj_match:
            project_names.append(proj_match.group(1).strip())
        jira_keys = self.JIRA_KEY_REGEX.findall(text_clean)
        project_names.extend(jira_keys)
        if "contextvault" in text_lower:
            project_names.append("ContextVault")
        project_names = self._clean_list(project_names, max_items=8)

        # 10. Ticket Numbers
        ticket_numbers = []
        for m in self.TICKET_PNR_REGEX.finditer(text_clean):
            ticket_numbers.append(m.group(1).strip())
        ticket_numbers = self._clean_list(ticket_numbers, max_items=6)

        # 11. Shopping Items
        shopping_items = []
        for m in self.SHOPPING_ITEM_REGEX.finditer(text_clean):
            item = m.group(1).strip()
            if len(item) > 2 and item.lower() not in ["total", "subtotal", "tax", "shipping"]:
                shopping_items.append(item)
        shopping_items = self._clean_list(shopping_items, max_items=8)

        # 12. Document IDs
        document_ids = []
        for m in self.AADHAAR_REGEX.finditer(text_clean):
            document_ids.append(f"Aadhaar:{m.group(0)}")
        for m in self.PAN_REGEX.finditer(text_clean):
            document_ids.append(f"PAN:{m.group(0).upper()}")
        for m in self.SSN_REGEX.finditer(text_clean):
            document_ids.append(f"SSN:{m.group(0)}")
        passport_match = re.search(r"\bpassport\b[^\n\r]{0,30}\b([A-Z][0-9]{7,8})\b", text_clean, re.IGNORECASE)
        if passport_match:
            document_ids.append(f"Passport:{passport_match.group(1).upper()}")
        document_ids = self._clean_list(document_ids, max_items=6)

        # 13. Organizations
        organizations = []
        for org in self.KNOWN_ORGANIZATIONS:
            if org.lower() in text_lower:
                organizations.append(org)
        for m in self.ORG_SUFFIX_REGEX.finditer(text_clean):
            organizations.append(m.group(1).strip())
        organizations = self._clean_list(organizations, max_items=10)

        # 14. People
        people = []
        for m in self.PERSON_TITLE_REGEX.finditer(text_clean):
            people.append(m.group(1).strip())
        for m in self.PERSON_HEADER_REGEX.finditer(text_clean):
            val = m.group(1).strip()
            if len(val.split()) <= 3 and val.lower() not in ["all", "everyone", "team"]:
                people.append(val)
        # Twitter/Social handles as people identifiers
        handles = re.findall(r"@([a-zA-Z0-9_]{3,20})", text_clean)
        for h in handles:
            if h.lower() not in ["gmail", "yahoo", "outlook", "hotmail", "icloud"]:
                people.append(f"@{h}")
        people = self._clean_list(people, max_items=8)

        return ExtractedEntitiesDto(
            amounts=amounts,
            urls=urls,
            emails=emails,
            phoneNumbers=phones,
            merchants=organizations,  # backward compatibility alias
            projectNames=project_names,
            dates=dates,
            organizations=organizations,
            people=people,
            upiIds=upi_ids,
            bankAccounts=bank_accounts,
            invoiceNumbers=invoice_numbers,
            ticketNumbers=ticket_numbers,
            shoppingItems=shopping_items,
            documentIds=document_ids,
        )

    def _clean_list(
        self, items: List[str], max_items: int = 10, lowercase: bool = False
    ) -> List[str]:
        """Normalizes and deduplicates an entity token list."""
        seen = set()
        clean = []
        for item in items:
            s = str(item).strip()
            if not s:
                continue
            key = s.lower() if lowercase else s
            if key not in seen:
                seen.add(key)
                clean.append(key if lowercase else s)
                if len(clean) >= max_items:
                    break
        return clean

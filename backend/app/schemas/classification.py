import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ExtractedEntitiesDto(BaseModel):
    amounts: List[str] = Field(default_factory=list, description="Extracted currency/financial amounts")
    urls: List[str] = Field(default_factory=list, description="Extracted web URLs and domain links")
    emails: List[str] = Field(default_factory=list, description="Extracted email addresses")
    phoneNumbers: List[str] = Field(default_factory=list, description="Extracted telephone and contact numbers")
    merchants: List[str] = Field(default_factory=list, description="Identified companies, vendors, and merchants")
    projectNames: List[str] = Field(default_factory=list, description="Identified project, repo, or client names")
    dates: List[str] = Field(default_factory=list, description="Extracted calendar dates")
    organizations: List[str] = Field(default_factory=list, description="Extracted company, platform, and organization names")
    people: List[str] = Field(default_factory=list, description="Extracted names of persons")
    upiIds: List[str] = Field(default_factory=list, description="Extracted UPI payment IDs")
    bankAccounts: List[str] = Field(default_factory=list, description="Extracted bank account / IFSC references")
    invoiceNumbers: List[str] = Field(default_factory=list, description="Extracted invoice, receipt, and bill numbers")
    ticketNumbers: List[str] = Field(default_factory=list, description="Extracted ticket, PNR, and booking identifiers")
    shoppingItems: List[str] = Field(default_factory=list, description="Extracted product names and line items")
    documentIds: List[str] = Field(default_factory=list, description="Extracted passport, national ID, and driver license numbers")


class ClassifyRequest(BaseModel):
    ocrText: str = Field(..., min_length=1, description="OCR text extracted from screenshot")
    fileName: Optional[str] = Field(default=None, description="Original screenshot file name")
    detectedApp: Optional[str] = Field(default=None, description="App detected on device")
    hint: Optional[str] = Field(default=None, description="Optional user contextual hint")


class ReclassifyRequest(BaseModel):
    screenshotId: uuid.UUID = Field(..., description="ID of existing screenshot to reclassify")
    userHint: Optional[str] = Field(default=None, description="Guidance or correction from user")
    forceCategory: Optional[str] = Field(default=None, description="Manual category override")
    forceSubCategory: Optional[str] = Field(default=None, description="Manual subcategory override")


class ClassificationResultDto(BaseModel):
    screenshotId: Optional[uuid.UUID] = Field(default=None, description="Associated screenshot ID if stored")
    category: str = Field(..., description="Primary canonical category name")
    categoryId: Optional[uuid.UUID] = Field(default=None, description="Database category entity ID")
    subCategory: Optional[str] = Field(default=None, description="Subcategory or folder segment")
    folderPath: List[str] = Field(default_factory=list, description="Full folder path hierarchy list")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    detectedApp: Optional[str] = Field(default=None, description="App or platform identified")
    suggestedTags: List[str] = Field(default_factory=list, description="Suggested metadata tags")
    entities: ExtractedEntitiesDto = Field(default_factory=ExtractedEntitiesDto, description="Structured entity tokens")
    summary: str = Field(..., description="1-2 sentence executive contextual summary")
    modelName: str = Field(default="RuleEngine-v1.0", description="Classification engine identifier")


class ClassificationHistoryDto(BaseModel):
    id: uuid.UUID
    screenshotId: uuid.UUID
    category: str
    subCategory: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    entities: Dict[str, Any] = Field(default_factory=dict)
    confidence: float
    modelName: str
    createdOn: datetime

    model_config = ConfigDict(from_attributes=True)

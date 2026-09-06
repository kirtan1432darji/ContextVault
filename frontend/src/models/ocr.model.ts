export interface OCRLine {
  text: string;
  confidence: number;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  lines?: OCRLine[];
  boundingBox?: { left: number; top: number; width: number; height: number };
}

export interface OCRResultModel {
  id: string;
  screenshotId: string;
  rawText: string;
  normalizedText: string;
  language: string;
  confidence: number;
  processingTimeMs: number;
  ocrVersion: string;
  blocks: OCRBlock[];
  processedAt: string;
}

export interface OCRCacheRecord {
  id: string;
  screenshotId: string;
  extractedText: string;
  normalizedText?: string;
  processingTime: number; // in ms
  language: string;
  ocrVersion: string;
  confidence: number;
  blocksJson?: string;
  createdOn: string;
}

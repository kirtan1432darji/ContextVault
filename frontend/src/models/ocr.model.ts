export interface OCRBlock {
  text: string;
  confidence: number;
  cornerPoints?: { x: number; y: number }[];
}

export interface OCRResultModel {
  screenshotId: string;
  rawText: string;
  language: string;
  confidence: number;
  blocks: OCRBlock[];
  processedAt: string;
}

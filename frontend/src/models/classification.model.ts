export interface ClassificationResultModel {
  screenshotId?: string;
  categoryId: string;
  categoryName: string;
  subcategory: string;
  folderPath: string[];
  confidence: number;
  detectedApp?: string;
  suggestedTags: string[];
  keywords: string[];
  summary?: string;
  isAutoCategorized: boolean;
}

export interface ClassifyRequestPayload {
  screenshotId?: string;
  fileName?: string;
  filePath?: string;
  ocrText: string;
  visionDescription?: string;
  sourceApp?: string;
  existingCategory?: string;
}

export interface ReclassifyRequestPayload {
  screenshotId: string;
  forceReclassify?: boolean;
  userHint?: string;
}

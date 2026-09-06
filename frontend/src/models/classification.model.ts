export interface ExtractedEntitiesDto {
  amounts: string[];
  urls: string[];
  emails: string[];
  phoneNumbers: string[];
  merchants: string[];
  projectNames: string[];
  dates: string[];
}

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
  entities?: ExtractedEntitiesDto;
  source?: 'backend' | 'local';
  modelName?: string;
}

export interface ClassificationCacheRecord {
  id: string;
  screenshotId: string;
  category: string;
  subcategory?: string;
  tagsJson?: string;
  entitiesJson?: string;
  confidence: number;
  summary?: string;
  source: 'backend' | 'local';
  cachedAt: string;
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

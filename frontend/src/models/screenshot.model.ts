import { TagModel } from './tag.model';

export type OCRStatus = 'none' | 'pending' | 'processing' | 'completed' | 'failed';

export interface ScreenshotModel {
  id: string;
  deviceAssetId: string;
  filePath: string;
  fileName: string;
  createdAt: string;
  width: number;
  height: number;
  fileSize: number;
  categoryId: string;
  categoryName: string;
  subcategory: string;
  confidence: number;
  sourceApp?: string;
  detectedApp?: string;
  keywords?: string[];
  isAutoCategorized?: boolean;
  isFavorite: boolean;
  isReviewed: boolean;
  isSynced: boolean;
  ocrStatus: OCRStatus;
  ocrText?: string;
  tags: TagModel[];
  lastScannedAt?: string;
  isMock?: boolean;
}

export interface ScreenshotFilter {
  categoryId?: string;
  subCategoryId?: string;
  tag?: string;
  sourceApp?: string;
  isFavorite?: boolean;
  isReviewed?: boolean;
  needsReview?: boolean;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

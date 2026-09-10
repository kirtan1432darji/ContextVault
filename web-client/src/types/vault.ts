/**
 * Category / Smart Folder representation.
 */
export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  iconName: string;
  colorHex: string;
  description?: string | null;
  isSystem: boolean;
  orderIndex: number;
  screenshotCount?: number;
  subcategories?: Category[];
}

/**
 * Extracted entity item within OCR text.
 */
export interface ExtractedEntity {
  type: string;
  value: string;
  confidence?: number;
}

/**
 * Screenshot metadata transfer object.
 */
export interface Screenshot {
  id: string;
  userId: string;
  categoryId?: string | null;
  subCategory?: string | null;
  deviceAssetId?: string | null;
  fileName: string;
  fileSize: number;
  fileHash: string;
  width: number;
  height: number;
  mimeType?: string | null;
  ocrText?: string | null;
  confidenceScore: number;
  isAutoCategorized: boolean;
  isFavorite: boolean;
  isReviewed: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName?: string | null;
  tags?: string[];
  entities?: ExtractedEntity[];
}

/**
 * Paginated screenshots response.
 */
export interface PagedScreenshots {
  items: Screenshot[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Living folder context summary.
 */
export interface FolderContext {
  id: string;
  categoryId: string;
  executiveSummary: string;
  entityCount: number;
  timelineEvents: Array<{
    date: string;
    event: string;
  }>;
  suggestedTasks: Array<{
    id: string;
    title: string;
    isCompleted: boolean;
  }>;
  updatedAt: string;
}

/**
 * Query filter options for screenshots.
 */
export interface ScreenshotFilters {
  categoryId?: string;
  subCategory?: string;
  tag?: string;
  isFavorite?: boolean;
  isReviewed?: boolean;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}

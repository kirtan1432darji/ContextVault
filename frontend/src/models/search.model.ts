import { ScreenshotModel } from './screenshot.model';

export interface RecentSearchItem {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
}

export interface SavedSearchItem {
  id: string;
  query: string;
  title: string;
  iconName: string;
  colorHex: string;
  createdAt: string;
  filters?: SearchFilterState;
  lastUsedAt?: string;
  useCount?: number;
}

export type SearchDateRange = 'all' | 'today' | '7days' | '30days';

export interface SearchFilterState {
  folderId?: string;
  dateRange?: SearchDateRange;
  sourceApp?: string;
  entityType?: string;
  screenshotType?: string;
  onlyFavorites?: boolean;
  onlyNeedsReview?: boolean;
}

export interface DetectedEntity {
  label: string;
  value: string;
  type: 'amount' | 'merchant' | 'date' | 'order' | 'code' | 'general';
}

export interface TextToken {
  text: string;
  isMatch: boolean;
}

export interface GlobalSearchResultItem extends ScreenshotModel {
  matchedSnippet: string;
  matchedField: string;
  matchReason: string;
  score: number;
  highlightedSnippet?: TextToken[];
  detectedEntities?: DetectedEntity[];
}

export interface AIAnswerCardData {
  summary: string;
  matchCount: number;
  entities: DetectedEntity[];
  suggestedFollowUps: string[];
  isOffline: boolean;
  query: string;
}

export interface ContextSearchResultDto {
  folderId: string;
  folderName: string;
  contextId: string;
  matchedField: string;
  matchedSnippet: string;
  score: number;
}

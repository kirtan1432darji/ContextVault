export interface ContextTaskModel {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string;
}

export interface ContextEntityModel {
  name: string;
  type: string;
  count: number;
}

export interface ContextDateModel {
  event: string;
  date: string;
}

export interface ContextTimelineItemModel {
  screenshotId: string;
  title: string;
  description: string;
  capturedAt: string;
  imagePath?: string;
}

export interface FolderContextModel {
  categoryId: string;
  categoryName: string;
  summary: string;
  keywords: string[];
  confidence: number;
  screenshotCount: number;
  lastUpdatedAt?: string;
  tasks: ContextTaskModel[];
  entities: ContextEntityModel[];
  people: string[];
  links: string[];
  dates: ContextDateModel[];
  apps: string[];
  topics: string[];
  timeline: ContextTimelineItemModel[];
}

export const createEmptyFolderContext = (
  categoryId: string,
  categoryName: string,
  screenshotCount = 0
): FolderContextModel => ({
  categoryId,
  categoryName,
  summary: '',
  keywords: [],
  confidence: 0,
  screenshotCount,
  lastUpdatedAt: undefined,
  tasks: [],
  entities: [],
  people: [],
  links: [],
  dates: [],
  apps: [],
  topics: [],
  timeline: [],
});

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

export interface ContextEntitiesMap {
  organizations: string[];
  people: string[];
  dates: string[];
  urls: string[];
  shopping: string[];
  tasks: string[];
  payments: string[];
  documents: string[];
  amounts: string[];
}

export interface FolderContextModel {
  categoryId: string;
  categoryName: string;
  summary: string;
  keywords: string[];
  confidence: number;
  screenshotCount: number;
  lastUpdatedAt?: string;
  version?: number;
  tasks: ContextTaskModel[];
  entities: ContextEntityModel[];
  structuredEntities?: ContextEntitiesMap;
  people: string[];
  links: string[];
  dates: ContextDateModel[];
  apps: string[];
  topics: string[];
  timeline: ContextTimelineItemModel[];
  shopping?: string[];
  payments?: string[];
  documents?: string[];
}

export interface FolderContextEntity {
  FolderId: string;
  Summary: string;
  EntitiesJson: string;
  TasksJson: string;
  UpdatedOn: string;
  Version: number;
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
  version: 1,
  tasks: [],
  entities: [],
  structuredEntities: {
    organizations: [],
    people: [],
    dates: [],
    urls: [],
    shopping: [],
    tasks: [],
    payments: [],
    documents: [],
    amounts: [],
  },
  people: [],
  links: [],
  dates: [],
  apps: [],
  topics: [],
  timeline: [],
  shopping: [],
  payments: [],
  documents: [],
});

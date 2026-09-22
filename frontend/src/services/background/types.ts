export type QueuePriority = 'critical' | 'high' | 'medium' | 'low';

export type QueueState = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export const PRIORITY_WEIGHTS: Record<QueuePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export interface QueueItem {
  id: string;
  screenshotId: string;
  state: QueueState;
  retryCount: number;
  priority: QueuePriority;
  priorityOrder: number;
  queuedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  processingTimeMs: number;
  // Joined screenshot details for presentation
  fileName?: string;
  filePath?: string;
  localPath?: string;
  contentUri?: string;
  thumbnailUri?: string;
  categoryName?: string;
  fileSize?: number;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageProcessingTimeMs: number;
}

export type QueueEventType =
  | 'item_enqueued'
  | 'item_started'
  | 'item_progress'
  | 'item_completed'
  | 'item_failed'
  | 'queue_paused'
  | 'queue_resumed'
  | 'queue_cleared';

export interface QueueEvent {
  type: QueueEventType;
  item?: QueueItem;
  step?: string;
  error?: string;
  stats?: QueueStats;
  timestamp: string;
}

export type QueueEventListener = (event: QueueEvent) => void;

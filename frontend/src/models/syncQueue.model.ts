export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

export interface SyncQueueItemModel {
  id: string;
  endpoint: string;
  httpMethod: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: Record<string, any>;
  retryCount: number;
  status: SyncStatus;
  createdAt: string;
  lastError?: string;
}

import { apiClient } from '../api/apiClient';

export class SyncService {
  private isProcessing = false;

  async processPendingQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const isOnline = await apiClient.checkHealth();
      if (!isOnline) {
        this.isProcessing = false;
        return;
      }
      // Process offline queue items when connected
    } catch {
      // Ignore network errors during background sync
    } finally {
      this.isProcessing = false;
    }
  }
}

export const syncService = new SyncService();

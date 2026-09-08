import { databaseService } from '../database';
import { imageOptimizer } from '../utils/imageOptimizer';
import { loggerService } from './loggerService';

export interface StorageBreakdown {
  totalBytes: number;
  databaseSizeBytes: number;
  ocrCacheBytes: number;
  ocrCacheCount: number;
  searchCacheBytes: number;
  searchCacheCount: number;
  chatHistoryBytes: number;
  chatHistoryCount: number;
  screenshotRecordCount: number;
  pendingScreenshotCount: number;
  memoryThumbnailBytes: number;
}

class StorageManagerService {
  /**
   * Calculates comprehensive storage usage across ContextVault components.
   */
  async getStorageBreakdown(): Promise<StorageBreakdown> {
    try {
      // 1. Calculate database file size via SQLite PRAGMA
      let databaseSizeBytes = 0;
      try {
        const pageCountRows = await databaseService.executeQuery('PRAGMA page_count;');
        const pageSizeRows = await databaseService.executeQuery('PRAGMA page_size;');
        const pageCount = pageCountRows[0]?.page_count || 0;
        const pageSize = pageSizeRows[0]?.page_size || 4096;
        databaseSizeBytes = pageCount * pageSize;
      } catch (e) {
        // Fallback estimate if PRAGMA is restricted
        databaseSizeBytes = 1024 * 1024 * 2; // ~2MB baseline
      }

      // 2. OCR Cache metrics
      let ocrCacheBytes = 0;
      let ocrCacheCount = 0;
      try {
        const ocrRows = await databaseService.executeQuery(
          'SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(extracted_text) + LENGTH(COALESCE(blocks_json, ""))), 0) as bytes FROM ocr_cache;'
        );
        if (ocrRows.length > 0) {
          ocrCacheCount = ocrRows[0].count || 0;
          ocrCacheBytes = ocrRows[0].bytes || 0;
        }
      } catch (err) {
        loggerService.warn('Storage', 'Error calculating OCR cache size', err);
      }

      // 3. Search history metrics
      let searchCacheBytes = 0;
      let searchCacheCount = 0;
      try {
        const searchRows = await databaseService.executeQuery(
          'SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(query)), 0) as bytes FROM recent_searches;'
        );
        if (searchRows.length > 0) {
          searchCacheCount = searchRows[0].count || 0;
          searchCacheBytes = searchRows[0].bytes || 0;
        }
      } catch (err) {
        loggerService.warn('Storage', 'Error calculating search cache size', err);
      }

      // 4. Chat history metrics
      let chatHistoryBytes = 0;
      let chatHistoryCount = 0;
      try {
        const chatRows = await databaseService.executeQuery(
          'SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(COALESCE(message, "")) + LENGTH(COALESCE(answer, ""))), 0) as bytes FROM chat_history;'
        );
        if (chatRows.length > 0) {
          chatHistoryCount = chatRows[0].count || 0;
          chatHistoryBytes = chatRows[0].bytes || 0;
        }
      } catch (err) {
        loggerService.warn('Storage', 'Error calculating chat history size', err);
      }

      // 5. Screenshot table counts
      let screenshotRecordCount = 0;
      let pendingScreenshotCount = 0;
      try {
        const [scRows, pendRows] = await Promise.all([
          databaseService.executeQuery('SELECT COUNT(*) as count FROM screenshots;'),
          databaseService.executeQuery('SELECT COUNT(*) as count FROM pending_screenshots;'),
        ]);
        screenshotRecordCount = scRows[0]?.count || 0;
        pendingScreenshotCount = pendRows[0]?.count || 0;
      } catch (err) {
        loggerService.warn('Storage', 'Error calculating screenshot counts', err);
      }

      const memoryThumbnailBytes = imageOptimizer.getEstimatedMemoryBytes();

      const totalBytes =
        databaseSizeBytes > 0
          ? databaseSizeBytes + memoryThumbnailBytes
          : ocrCacheBytes + searchCacheBytes + chatHistoryBytes + memoryThumbnailBytes + 1024 * 512;

      return {
        totalBytes,
        databaseSizeBytes,
        ocrCacheBytes,
        ocrCacheCount,
        searchCacheBytes,
        searchCacheCount,
        chatHistoryBytes,
        chatHistoryCount,
        screenshotRecordCount,
        pendingScreenshotCount,
        memoryThumbnailBytes,
      };
    } catch (err: any) {
      loggerService.error('Storage', 'Failed to calculate storage breakdown', err);
      return {
        totalBytes: 0,
        databaseSizeBytes: 0,
        ocrCacheBytes: 0,
        ocrCacheCount: 0,
        searchCacheBytes: 0,
        searchCacheCount: 0,
        chatHistoryBytes: 0,
        chatHistoryCount: 0,
        screenshotRecordCount: 0,
        pendingScreenshotCount: 0,
        memoryThumbnailBytes: 0,
      };
    }
  }

  /**
   * Clears the OCR Cache table.
   */
  async clearOCRCache(): Promise<void> {
    try {
      await databaseService.executeCommand('DELETE FROM ocr_cache;');
      loggerService.info('Storage', 'OCR cache cleared successfully.');
    } catch (err: any) {
      loggerService.error('Storage', 'Failed to clear OCR cache', err);
      throw err;
    }
  }

  /**
   * Clears recent search queries and search history.
   */
  async clearSearchCache(): Promise<void> {
    try {
      await databaseService.executeCommand('DELETE FROM recent_searches;');
      loggerService.info('Storage', 'Search history cleared successfully.');
    } catch (err: any) {
      loggerService.error('Storage', 'Failed to clear search cache', err);
      throw err;
    }
  }

  /**
   * Clears all AI chat conversation history.
   */
  async clearChatHistory(): Promise<void> {
    try {
      await databaseService.executeCommand('DELETE FROM chat_history;');
      loggerService.info('Storage', 'Chat history cleared successfully.');
    } catch (err: any) {
      loggerService.error('Storage', 'Failed to clear chat history', err);
      throw err;
    }
  }

  /**
   * Clears completed pending screenshot records that have already been organized.
   */
  async clearCompletedPending(): Promise<void> {
    try {
      await databaseService.executeCommand(
        "DELETE FROM pending_screenshots WHERE status = 'Completed' AND id IN (SELECT id FROM screenshots);"
      );
      loggerService.info('Storage', 'Cleaned completed pending screenshots.');
    } catch (err: any) {
      loggerService.error('Storage', 'Failed to clear completed pending screenshots', err);
      throw err;
    }
  }

  /**
   * Clears memory thumbnail cache.
   */
  clearThumbnailMemoryCache(): void {
    imageOptimizer.clearMemoryCache();
    loggerService.info('Storage', 'Thumbnail memory cache cleared.');
  }

  /**
   * Performs SQLite VACUUM to reclaim free pages and defragment database on disk.
   */
  async vacuumDatabase(): Promise<void> {
    try {
      loggerService.info('Storage', 'Executing SQLite VACUUM...');
      await databaseService.executeCommand('VACUUM;');
      loggerService.info('Storage', 'SQLite VACUUM completed successfully.');
    } catch (err: any) {
      loggerService.warn('Storage', 'VACUUM command notice: ' + err?.message);
    }
  }

  /**
   * Cleans all caches and defragments storage.
   */
  async clearAllCaches(): Promise<void> {
    await this.clearOCRCache();
    await this.clearSearchCache();
    await this.clearCompletedPending();
    this.clearThumbnailMemoryCache();
    await this.vacuumDatabase();
    loggerService.info('Storage', 'All application caches purged and database defragmented.');
  }

  /**
   * Formats raw bytes into readable human format (KB, MB, GB).
   */
  formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }
}

export const storageManagerService = new StorageManagerService();

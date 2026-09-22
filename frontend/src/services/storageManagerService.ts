import { databaseService } from '../database';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { ScreenshotModel } from '../models';
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
  categorizedCount: number;
  unsortedCount: number;
  favoritesCount: number;
  needsReviewCount: number;
  pendingScreenshotCount: number;
  completedPendingCount: number;
  totalDeviceScreenshotBytes: number;
  memoryThumbnailBytes: number;
}

export interface DuplicateGroup {
  id: string;
  key: string;
  matchReason: 'Exact Dimensions & Size' | 'Identical File Name' | 'Matching OCR Content';
  original: ScreenshotModel;
  duplicates: ScreenshotModel[];
  reclaimableBytes: number;
}

export interface DuplicateDetectionResult {
  groups: DuplicateGroup[];
  totalDuplicates: number;
  reclaimableBytes: number;
}

export interface CleanupRecommendation {
  id: string;
  type: 'duplicates' | 'ocr_cache' | 'database_vacuum' | 'pending_queue' | 'search_cache';
  title: string;
  description: string;
  savingsLabel: string;
  potentialSavingsBytes: number;
  severity: 'high' | 'medium' | 'low';
  actionLabel: string;
}

class StorageManagerService {
  /**
   * Calculates comprehensive storage usage and screenshot counts across ContextVault components.
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

      // 5. Screenshot table counts and breakdown
      let screenshotRecordCount = 0;
      let categorizedCount = 0;
      let unsortedCount = 0;
      let favoritesCount = 0;
      let needsReviewCount = 0;
      let totalDeviceScreenshotBytes = 0;

      try {
        const scRows = await databaseService.executeQuery(`
          SELECT 
            COUNT(*) as total_count,
            COALESCE(SUM(CASE WHEN category_id != 'unsorted' AND category_id != '' AND category_id IS NOT NULL THEN 1 ELSE 0 END), 0) as categorized_count,
            COALESCE(SUM(CASE WHEN category_id = 'unsorted' OR category_id = '' OR category_id IS NULL THEN 1 ELSE 0 END), 0) as unsorted_count,
            COALESCE(SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END), 0) as favorites_count,
            COALESCE(SUM(CASE WHEN is_reviewed = 0 AND (confidence < 0.70 OR category_id = 'unsorted') THEN 1 ELSE 0 END), 0) as needs_review_count,
            COALESCE(SUM(file_size), 0) as total_file_size
          FROM screenshots;
        `);

        if (scRows.length > 0) {
          screenshotRecordCount = scRows[0].total_count || 0;
          categorizedCount = scRows[0].categorized_count || 0;
          unsortedCount = scRows[0].unsorted_count || 0;
          favoritesCount = scRows[0].favorites_count || 0;
          needsReviewCount = scRows[0].needs_review_count || 0;
          totalDeviceScreenshotBytes = scRows[0].total_file_size || 0;
        }
      } catch (err) {
        loggerService.warn('Storage', 'Error calculating screenshot counts', err);
      }

      // 6. Pending scanner queue counts
      let pendingScreenshotCount = 0;
      let completedPendingCount = 0;
      try {
        const pendRows = await databaseService.executeQuery(`
          SELECT 
            COUNT(*) as total_count,
            COALESCE(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) as completed_count
          FROM pending_screenshots;
        `);
        if (pendRows.length > 0) {
          pendingScreenshotCount = pendRows[0].total_count || 0;
          completedPendingCount = pendRows[0].completed_count || 0;
        }
      } catch (err) {
        loggerService.warn('Storage', 'Error calculating pending counts', err);
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
        categorizedCount,
        unsortedCount,
        favoritesCount,
        needsReviewCount,
        pendingScreenshotCount,
        completedPendingCount,
        totalDeviceScreenshotBytes,
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
        categorizedCount: 0,
        unsortedCount: 0,
        favoritesCount: 0,
        needsReviewCount: 0,
        pendingScreenshotCount: 0,
        completedPendingCount: 0,
        totalDeviceScreenshotBytes: 0,
        memoryThumbnailBytes: 0,
      };
    }
  }

  /**
   * Scans the database for duplicate screenshots using:
   * 1. Exact file size and dimensions match (where fileSize > 0)
   * 2. Identical file name match
   * 3. Substantial matching OCR text content
   */
  async findDuplicates(): Promise<DuplicateDetectionResult> {
    try {
      const rows = await databaseService.executeQuery(
        `SELECT id, device_asset_id, file_path, file_name, created_at, width, height,
                file_size, category_id, category_name, subcategory, confidence,
                source_app, detected_app, keywords_json, is_auto_categorized,
                is_favorite, is_reviewed, is_synced, ocr_status, ocr_text,
                last_scanned_at, is_mock
         FROM screenshots
         ORDER BY created_at ASC;`
      );

      const screenshots: ScreenshotModel[] = rows.map((row: any) => {
        let keywords: string[] = [];
        try {
          if (row.keywords_json) keywords = JSON.parse(row.keywords_json);
        } catch {}

        return {
          id: row.id,
          deviceAssetId: row.device_asset_id || '',
          filePath: row.file_path,
          fileName: row.file_name,
          createdAt: row.created_at,
          width: row.width || 1080,
          height: row.height || 2400,
          fileSize: row.file_size || 0,
          categoryId: row.category_id,
          categoryName: row.category_name,
          subcategory: row.subcategory || '',
          confidence: row.confidence || 0,
          sourceApp: row.source_app,
          detectedApp: row.detected_app,
          keywords,
          isAutoCategorized: Boolean(row.is_auto_categorized),
          isFavorite: Boolean(row.is_favorite),
          isReviewed: Boolean(row.is_reviewed),
          isSynced: Boolean(row.is_synced),
          ocrStatus: row.ocr_status || 'none',
          ocrText: row.ocr_text || undefined,
          lastScannedAt: row.last_scanned_at,
          isMock: Boolean(row.is_mock),
          tags: [],
        };
      });

      const groups: DuplicateGroup[] = [];
      const assignedIds = new Set<string>();

      // 1. Group by exact file_size & dimensions (when fileSize > 0)
      const sizeGroups = new Map<string, ScreenshotModel[]>();
      for (const sc of screenshots) {
        if (sc.fileSize > 0 && sc.width > 0 && sc.height > 0) {
          const key = `${sc.fileSize}_${sc.width}x${sc.height}`;
          if (!sizeGroups.has(key)) sizeGroups.set(key, []);
          sizeGroups.get(key)!.push(sc);
        }
      }

      for (const [key, items] of sizeGroups.entries()) {
        if (items.length > 1) {
          const original = items[0];
          const duplicates = items.slice(1);
          for (const item of items) assignedIds.add(item.id);
          const reclaimable = duplicates.reduce(
            (sum, d) => sum + (d.fileSize > 0 ? d.fileSize : 1024 * 1024 * 1.5),
            0
          );
          groups.push({
            id: `dup_dim_${key}`,
            key,
            matchReason: 'Exact Dimensions & Size',
            original,
            duplicates,
            reclaimableBytes: reclaimable,
          });
        }
      }

      // 2. Group by identical file_name (for remaining unassigned screenshots)
      const nameGroups = new Map<string, ScreenshotModel[]>();
      for (const sc of screenshots) {
        if (!assignedIds.has(sc.id) && sc.fileName && sc.fileName.trim().length > 3) {
          const key = sc.fileName.trim().toLowerCase();
          if (!nameGroups.has(key)) nameGroups.set(key, []);
          nameGroups.get(key)!.push(sc);
        }
      }

      for (const [key, items] of nameGroups.entries()) {
        if (items.length > 1) {
          const original = items[0];
          const duplicates = items.slice(1);
          for (const item of items) assignedIds.add(item.id);
          const reclaimable = duplicates.reduce(
            (sum, d) => sum + (d.fileSize > 0 ? d.fileSize : 1024 * 1024 * 1.5),
            0
          );
          groups.push({
            id: `dup_name_${key}`,
            key,
            matchReason: 'Identical File Name',
            original,
            duplicates,
            reclaimableBytes: reclaimable,
          });
        }
      }

      // 3. Group by substantial matching OCR text (for remaining unassigned)
      const ocrGroups = new Map<string, ScreenshotModel[]>();
      for (const sc of screenshots) {
        if (!assignedIds.has(sc.id) && sc.ocrText && sc.ocrText.trim().length >= 35) {
          const normalized = sc.ocrText.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
          if (!ocrGroups.has(normalized)) ocrGroups.set(normalized, []);
          ocrGroups.get(normalized)!.push(sc);
        }
      }

      for (const [key, items] of ocrGroups.entries()) {
        if (items.length > 1) {
          const original = items[0];
          const duplicates = items.slice(1);
          for (const item of items) assignedIds.add(item.id);
          const reclaimable = duplicates.reduce(
            (sum, d) => sum + (d.fileSize > 0 ? d.fileSize : 1024 * 1024 * 1.5),
            0
          );
          groups.push({
            id: `dup_ocr_${groups.length + 1}`,
            key,
            matchReason: 'Matching OCR Content',
            original,
            duplicates,
            reclaimableBytes: reclaimable,
          });
        }
      }

      const totalDuplicates = groups.reduce((acc, g) => acc + g.duplicates.length, 0);
      const reclaimableBytes = groups.reduce((acc, g) => acc + g.reclaimableBytes, 0);

      return {
        groups,
        totalDuplicates,
        reclaimableBytes,
      };
    } catch (err) {
      loggerService.error('Storage', 'Error scanning for duplicate screenshots', err);
      return { groups: [], totalDuplicates: 0, reclaimableBytes: 0 };
    }
  }

  /**
   * Cleans duplicate screenshots by unindexing them from ContextVault.
   * Note: Device files are never mutated; only local metadata records are purged.
   */
  async cleanDuplicates(duplicateIds: string[]): Promise<number> {
    if (!duplicateIds || duplicateIds.length === 0) return 0;
    let deletedCount = 0;
    for (const id of duplicateIds) {
      try {
        await databaseService.executeCommand('DELETE FROM screenshots WHERE id = ?;', [id]);
        await databaseService.executeCommand('DELETE FROM screenshot_tags WHERE screenshot_id = ?;', [id]);
        await databaseService.executeCommand('DELETE FROM ocr_cache WHERE screenshot_id = ?;', [id]);
        deletedCount++;
      } catch (err) {
        loggerService.warn('Storage', `Failed to remove duplicate record ${id}`, err);
      }
    }
    try {
      await categoryRepository.recalculateAllCounts();
    } catch {}
    loggerService.info('Storage', `Cleaned ${deletedCount} duplicate screenshot records.`);
    return deletedCount;
  }

  /**
   * Generates prioritized cleanup recommendations based on live storage metrics.
   */
  getCleanupRecommendations(
    breakdown: StorageBreakdown,
    duplicates?: DuplicateDetectionResult
  ): CleanupRecommendation[] {
    const recommendations: CleanupRecommendation[] = [];

    // 1. Duplicates
    if (duplicates && duplicates.totalDuplicates > 0) {
      recommendations.push({
        id: 'rec_duplicates',
        type: 'duplicates',
        title: `Clean ${duplicates.totalDuplicates} Duplicate Screenshots`,
        description: `Found ${duplicates.totalDuplicates} redundant duplicate screenshots. Unindexing them frees local database and cache storage.`,
        savingsLabel: `Save ~${this.formatBytes(duplicates.reclaimableBytes)}`,
        potentialSavingsBytes: duplicates.reclaimableBytes,
        severity: 'high',
        actionLabel: 'Clean Duplicates',
      });
    }

    // 2. OCR Cache
    if (breakdown.ocrCacheCount > 0) {
      recommendations.push({
        id: 'rec_ocr',
        type: 'ocr_cache',
        title: 'Purge OCR Text Recognition Cache',
        description: `${breakdown.ocrCacheCount} cached OCR text blocks (${this.formatBytes(breakdown.ocrCacheBytes)}). Safe to purge; original photos remain safe.`,
        savingsLabel: `Save ${this.formatBytes(breakdown.ocrCacheBytes)}`,
        potentialSavingsBytes: breakdown.ocrCacheBytes,
        severity: breakdown.ocrCacheBytes > 1024 * 512 ? 'high' : 'medium',
        actionLabel: 'Clear OCR Cache',
      });
    }

    // 3. Database Fragmentation (VACUUM)
    if (breakdown.databaseSizeBytes > 1024 * 256) {
      const estimatedVacuumSavings = Math.round(breakdown.databaseSizeBytes * 0.2);
      recommendations.push({
        id: 'rec_vacuum',
        type: 'database_vacuum',
        title: 'Defragment SQLite Database',
        description: 'Run SQLite VACUUM to reclaim free pages, rebuild B-trees, and accelerate search queries.',
        savingsLabel: 'Optimize Query Speed',
        potentialSavingsBytes: estimatedVacuumSavings,
        severity: breakdown.databaseSizeBytes > 1024 * 1024 ? 'medium' : 'low',
        actionLabel: 'Defragment (VACUUM)',
      });
    }

    // 4. Completed Scanner Temporary Queue
    if (breakdown.completedPendingCount > 0) {
      recommendations.push({
        id: 'rec_pending',
        type: 'pending_queue',
        title: 'Prune Completed Scanner Queue',
        description: `${breakdown.completedPendingCount} completed background scanning records can be safely removed.`,
        savingsLabel: `Prune ${breakdown.completedPendingCount} tasks`,
        potentialSavingsBytes: breakdown.completedPendingCount * 512,
        severity: 'low',
        actionLabel: 'Clean Queue',
      });
    }

    // 5. Search History
    if (breakdown.searchCacheCount > 5) {
      recommendations.push({
        id: 'rec_search',
        type: 'search_cache',
        title: 'Clear Recent Search Queries',
        description: `${breakdown.searchCacheCount} recent and saved search queries stored locally.`,
        savingsLabel: `Purge ${breakdown.searchCacheCount} queries`,
        potentialSavingsBytes: breakdown.searchCacheBytes,
        severity: 'low',
        actionLabel: 'Clear Searches',
      });
    }

    return recommendations;
  }

  /**
   * One-tap batch cleanup executing safe non-destructive optimizations.
   */
  async executeQuickClean(duplicateIds?: string[]): Promise<{
    duplicatesCleaned: number;
    ocrCleared: boolean;
    pendingCleaned: boolean;
    vacuumed: boolean;
  }> {
    let duplicatesCleaned = 0;
    if (duplicateIds && duplicateIds.length > 0) {
      duplicatesCleaned = await this.cleanDuplicates(duplicateIds);
    }
    await this.clearCompletedPending();
    await this.clearOCRCache();
    this.clearThumbnailMemoryCache();
    await this.vacuumDatabase();

    return {
      duplicatesCleaned,
      ocrCleared: true,
      pendingCleaned: true,
      vacuumed: true,
    };
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

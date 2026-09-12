import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { ScreenshotModel } from '../models';
import { loggerService } from './loggerService';

export class RecycleBinService {
  /**
   * Retrieves all soft-deleted screenshots currently in the Recycle Bin.
   */
  async getDeletedScreenshots(): Promise<ScreenshotModel[]> {
    try {
      return await screenshotRepository.getDeletedScreenshots();
    } catch (err) {
      loggerService.error('Storage', 'Failed to fetch deleted screenshots', err);
      return [];
    }
  }

  /**
   * Soft-deletes a screenshot by moving it to the Recycle Bin.
   * Original device photos are never deleted or modified.
   */
  async softDeleteScreenshot(id: string): Promise<void> {
    try {
      await screenshotRepository.softDeleteScreenshot(id);
      await categoryRepository.recalculateAllCounts();
      loggerService.info('Storage', `Screenshot ${id} moved to Recycle Bin.`);
    } catch (err) {
      loggerService.error('Storage', `Failed to soft-delete screenshot ${id}`, err);
      throw err;
    }
  }

  /**
   * Soft-deletes multiple screenshots in bulk by moving them to the Recycle Bin.
   */
  async bulkSoftDelete(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    try {
      const count = await screenshotRepository.bulkSoftDelete(ids);
      await categoryRepository.recalculateAllCounts();
      loggerService.info('Storage', `Moved ${count} screenshots to Recycle Bin.`);
      return count;
    } catch (err) {
      loggerService.error('Storage', 'Failed in bulkSoftDelete', err);
      throw err;
    }
  }

  /**
   * Restores a soft-deleted screenshot back to active status in its smart folder.
   */
  async restoreScreenshot(id: string): Promise<void> {
    try {
      await screenshotRepository.restoreScreenshot(id);
      await categoryRepository.recalculateAllCounts();
      loggerService.info('Storage', `Screenshot ${id} restored from Recycle Bin.`);
    } catch (err) {
      loggerService.error('Storage', `Failed to restore screenshot ${id}`, err);
      throw err;
    }
  }

  /**
   * Restores all soft-deleted screenshots currently in the Recycle Bin.
   */
  async restoreAll(): Promise<number> {
    try {
      const count = await screenshotRepository.restoreAllScreenshots();
      await categoryRepository.recalculateAllCounts();
      loggerService.info('Storage', `Restored all ${count} screenshots from Recycle Bin.`);
      return count;
    } catch (err) {
      loggerService.error('Storage', 'Failed to restore all screenshots', err);
      throw err;
    }
  }

  /**
   * Permanently hard-deletes a single screenshot record from SQLite, its tags, and OCR cache.
   * Device photo files in MediaStore / Camera Roll remain completely untouched.
   */
  async permanentDelete(id: string): Promise<void> {
    try {
      await screenshotRepository.permanentDeleteScreenshot(id);
      await categoryRepository.recalculateAllCounts();
      loggerService.info('Storage', `Screenshot ${id} permanently removed from ContextVault.`);
    } catch (err) {
      loggerService.error('Storage', `Failed to permanently delete screenshot ${id}`, err);
      throw err;
    }
  }

  /**
   * Permanently purges all soft-deleted screenshots in the Recycle Bin.
   */
  async emptyRecycleBin(): Promise<number> {
    try {
      const count = await screenshotRepository.emptyRecycleBin();
      await categoryRepository.recalculateAllCounts();
      loggerService.info('Storage', `Emptied Recycle Bin (${count} items purged).`);
      return count;
    } catch (err) {
      loggerService.error('Storage', 'Failed to empty Recycle Bin', err);
      throw err;
    }
  }

  /**
   * Returns count of screenshots currently in Recycle Bin.
   */
  async getRecycleBinCount(): Promise<number> {
    try {
      return await screenshotRepository.getRecycleBinCount();
    } catch (err) {
      loggerService.warn('Storage', 'Failed to get recycle bin count', err);
      return 0;
    }
  }

  /**
   * Formats relative deletion age into human readable text.
   */
  formatDeletedAge(deletedAt?: string): string {
    if (!deletedAt) return 'Deleted recently';
    try {
      const deletedDate = new Date(deletedAt);
      const now = new Date();
      const diffMs = now.getTime() - deletedDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) return 'Deleted just now';
      if (diffHours < 24) return `Deleted ${diffHours}h ago`;
      if (diffDays === 1) return 'Deleted yesterday';
      if (diffDays < 30) return `Deleted ${diffDays} days ago`;
      return `Deleted on ${deletedDate.toLocaleDateString()}`;
    } catch {
      return 'Deleted recently';
    }
  }

  /**
   * Computes days remaining in the 30-day retention window.
   */
  getRetentionDaysRemaining(deletedAt?: string, retentionDays = 30): number {
    if (!deletedAt) return retentionDays;
    try {
      const deletedTime = new Date(deletedAt).getTime();
      const elapsedDays = Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60 * 24));
      return Math.max(1, retentionDays - elapsedDays);
    } catch {
      return retentionDays;
    }
  }
}

export const recycleBinService = new RecycleBinService();

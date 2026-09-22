import { Result } from '../utils/result';
import { ScreenshotModel, ScreenshotFilter } from '../models';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { useScreenshotStore } from '../store/screenshot.store';
import { apiClient } from '../api/apiClient';

export class ScreenshotService {
  /**
   * Retrieves screenshots from the on-device SQLite database.
   * Preserves privacy-first architecture (no binaries ever sent to backend).
   */
  async getScreenshots(filter: ScreenshotFilter = {}): Promise<Result<ScreenshotModel[]>> {
    try {
      const items = await screenshotRepository.getAllScreenshots(filter);
      return Result.success(items);
    } catch (err: any) {
      console.warn('[ScreenshotService] Error reading screenshots from SQLite:', err);
      // Fallback to in-memory store
      const memoryItems = useScreenshotStore.getState().screenshots;
      if (memoryItems && memoryItems.length > 0) {
        return Result.success(memoryItems);
      }
      return Result.failure(err?.message || 'Failed to query local screenshots');
    }
  }

  async getScreenshotById(id: string): Promise<Result<ScreenshotModel | null>> {
    try {
      const item = await screenshotRepository.getScreenshotById(id);
      return Result.success(item);
    } catch (err: any) {
      return Result.failure(err?.message || 'Failed to get screenshot');
    }
  }

  async toggleFavorite(id: string, isFavorite?: boolean): Promise<Result<boolean>> {
    try {
      useScreenshotStore.getState().toggleFavoriteLocal(id);
      const target = await screenshotRepository.getScreenshotById(id);
      if (target) {
        const nextFav = isFavorite !== undefined ? isFavorite : !target.isFavorite;
        await screenshotRepository.updateScreenshot({
          ...target,
          isFavorite: nextFav,
        });
      }
      // Non-blocking background sync with backend metadata if available
      apiClient.toggleFavorite(id, isFavorite).catch(() => {});
      return Result.success(true);
    } catch (err: any) {
      return Result.failure(err?.message || 'Failed to toggle favorite');
    }
  }

  async markReviewed(id: string, isReviewed = true): Promise<Result<boolean>> {
    try {
      useScreenshotStore.getState().markReviewedLocal(id);
      const target = await screenshotRepository.getScreenshotById(id);
      if (target) {
        await screenshotRepository.updateScreenshot({
          ...target,
          isReviewed,
        });
      }
      apiClient.toggleReview(id, isReviewed).catch(() => {});
      return Result.success(true);
    } catch (err: any) {
      return Result.failure(err?.message || 'Failed to mark reviewed');
    }
  }

  async updateCategory(
    id: string,
    categoryId: string,
    categoryName: string,
    subcategory = ''
  ): Promise<Result<boolean>> {
    try {
      useScreenshotStore.getState().updateCategoryLocal(id, categoryId, categoryName, subcategory);
      await screenshotRepository.reclassifyScreenshot(id, categoryId, categoryName, subcategory);
      apiClient
        .updateScreenshot(id, {
          categoryId,
          categoryName,
          subcategory,
          isReviewed: true,
        })
        .catch(() => {});
      return Result.success(true);
    } catch (err: any) {
      return Result.failure(err?.message || 'Failed to update category');
    }
  }

  async deleteScreenshot(id: string): Promise<Result<boolean>> {
    try {
      await useScreenshotStore.getState().softDeleteScreenshot(id);
      apiClient.deleteScreenshot(id).catch(() => {});
      return Result.success(true);
    } catch (err: any) {
      return Result.failure(err?.message || 'Failed to delete screenshot');
    }
  }
}

export const screenshotService = new ScreenshotService();

import { Result } from '../utils/result';
import { ScreenshotModel, ScreenshotFilter } from '../models';
import { apiClient } from '../api/apiClient';

export class ScreenshotService {
  async getScreenshots(filter: ScreenshotFilter = {}): Promise<Result<ScreenshotModel[]>> {
    const res = await apiClient.fetchScreenshots(filter);
    if (res.isSuccess) {
      const models: ScreenshotModel[] = res.data.map((item: any) => ({
        id: item.id || item.screenshot_id,
        deviceAssetId: item.deviceAssetId || item.device_asset_id || '',
        filePath: item.filePath || item.file_path || '',
        fileName: item.fileName || item.file_name || '',
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
        width: item.width || 1080,
        height: item.height || 2400,
        fileSize: item.fileSize || item.file_size || 0,
        categoryId: item.categoryId || item.category_id || 'unsorted',
        categoryName: item.categoryName || item.category_name || 'Unsorted',
        subcategory: item.subcategory || item.sub_category_name || '',
        confidence: item.confidence || 0,
        sourceApp: item.sourceApp || item.source_app,
        detectedApp: item.detectedApp || item.detected_app,
        isFavorite: Boolean(item.isFavorite || item.is_favorite),
        isReviewed: Boolean(item.isReviewed || item.is_reviewed),
        isSynced: Boolean(item.isSynced || item.is_synced),
        ocrStatus: item.ocrStatus || item.ocr_status || 'completed',
        ocrText: item.ocrText || item.ocr_text,
        tags: Array.isArray(item.tags)
          ? item.tags.map((t: any) =>
              typeof t === 'string' ? { id: t, name: t, colorHex: '6366F1' } : t
            )
          : [],
      }));
      return Result.success(models);
    }
    return Result.failure(res.error || 'Failed to fetch screenshots');
  }

  async toggleFavorite(id: string, isFavorite?: boolean): Promise<Result<boolean>> {
    return apiClient.toggleFavorite(id, isFavorite);
  }

  async markReviewed(id: string, isReviewed = true): Promise<Result<boolean>> {
    return apiClient.toggleReview(id, isReviewed);
  }

  async updateCategory(
    id: string,
    categoryId: string,
    categoryName: string,
    subcategory = ''
  ): Promise<Result<boolean>> {
    return apiClient.updateScreenshot(id, {
      categoryId,
      categoryName,
      subcategory,
      isReviewed: true,
    });
  }

  async deleteScreenshot(id: string): Promise<Result<boolean>> {
    return apiClient.deleteScreenshot(id);
  }
}

export const screenshotService = new ScreenshotService();

import { Result } from '../utils/result';
import { ScreenshotModel } from '../models';
import { databaseService } from '../database';
import { useScreenshotStore } from '../store/screenshot.store';
import { categoryRepository } from '../database/repositories/categoryRepository';

export class SearchService {
  /**
   * Local offline multi-field search across screenshots and smart folder metadata.
   * Matches OCR text, folder name, subcategory, tags, and file name.
   */
  async searchScreenshots(
    query: string,
    categoryId?: string
  ): Promise<Result<ScreenshotModel[]>> {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      const all = useScreenshotStore.getState().screenshots;
      const filtered = categoryId && categoryId !== 'all'
        ? all.filter((s) => s.categoryId === categoryId)
        : all;
      return Result.success(filtered);
    }

    try {
      // 1. Check matching folder IDs by name or path
      let matchingCategoryIds: string[] = [];
      const allCats = await categoryRepository.getAllCategories();
      allCats.forEach((c) => {
        if (
          c.name.toLowerCase().includes(q) ||
          (c.path && c.path.toLowerCase().includes(q))
        ) {
          matchingCategoryIds.push(c.id);
        }
      });

      // 2. Query local SQLite database
      const conditions: string[] = [
        '(LOWER(file_name) LIKE ? OR LOWER(ocr_text) LIKE ? OR LOWER(category_name) LIKE ? OR LOWER(subcategory) LIKE ? OR LOWER(keywords_json) LIKE ?)',
      ];
      const wildcard = `%${q}%`;
      const params: any[] = [wildcard, wildcard, wildcard, wildcard, wildcard];

      if (matchingCategoryIds.length > 0) {
        const catPlaceholders = matchingCategoryIds.map(() => '?').join(',');
        conditions.push(`category_id IN (${catPlaceholders})`);
        params.push(...matchingCategoryIds);
      }

      if (categoryId && categoryId !== 'all') {
        conditions.push('category_id = ?');
        params.push(categoryId);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';
      const sql = `SELECT * FROM screenshots ${whereSql} ORDER BY created_at DESC LIMIT 100`;

      const rows = await databaseService.executeQuery(sql, params);

      const models: ScreenshotModel[] = rows.map((row: any) => {
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
          width: row.width,
          height: row.height,
          fileSize: row.file_size,
          categoryId: row.category_id,
          categoryName: row.category_name,
          subcategory: row.subcategory || '',
          confidence: row.confidence,
          isAutoCategorized: Boolean(row.is_auto_categorized),
          isFavorite: Boolean(row.is_favorite),
          isReviewed: Boolean(row.is_reviewed),
          isSynced: Boolean(row.is_synced),
          ocrStatus: row.ocr_status,
          ocrText: row.ocr_text,
          keywords,
          tags: keywords.slice(0, 4).map((kw) => ({
            id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
            name: kw,
            colorHex: '6366F1',
          })),
          lastScannedAt: row.last_scanned_at,
        };
      });

      return Result.success(models);
    } catch (err: any) {
      console.warn('[SearchService] Search query failed, using in-memory filter:', err);
      // In-memory fallback
      const inMemory = useScreenshotStore.getState().screenshots.filter((s) => {
        const matchesQuery =
          s.fileName.toLowerCase().includes(q) ||
          (s.ocrText && s.ocrText.toLowerCase().includes(q)) ||
          s.categoryName.toLowerCase().includes(q) ||
          (s.subcategory && s.subcategory.toLowerCase().includes(q)) ||
          (s.keywords && s.keywords.some((k) => k.toLowerCase().includes(q)));

        if (categoryId && categoryId !== 'all') {
          return matchesQuery && s.categoryId === categoryId;
        }
        return matchesQuery;
      });

      return Result.success(inMemory);
    }
  }
}

export const searchService = new SearchService();

import { Result } from '../utils/result';
import { ScreenshotModel } from '../models';
import { databaseService } from '../database';
import { useScreenshotStore } from '../store/screenshot.store';
import { categoryRepository } from '../database/repositories/categoryRepository';

export class SearchService {
  /**
   * Local offline multi-field search across screenshots, smart folder metadata,
   * AI classification cache (AI summary, AI tags, entities), and folder context summaries.
   * Matches: OCR text, AI summary, AI tags, folder summaries, entities, file name, category, and subcategory.
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
      const wildcard = `%${q}%`;

      // 1. Check matching folder IDs by name or path
      let matchingCategoryIds: string[] = [];
      try {
        const allCats = await categoryRepository.getAllCategories();
        allCats.forEach((c) => {
          if (
            c.name.toLowerCase().includes(q) ||
            (c.path && c.path.toLowerCase().includes(q))
          ) {
            matchingCategoryIds.push(c.id);
          }
        });
      } catch (err) {
        console.warn('[SearchService] Error searching categories:', err);
      }

      // 2. Search folder_context table for matching summaries, key insights, and entities
      try {
        const folderContextRows = await databaseService.executeQuery(
          `SELECT folder_id FROM folder_context 
           WHERE LOWER(summary) LIKE ? OR LOWER(entities_json) LIKE ? OR LOWER(key_insights_json) LIKE ?`,
          [wildcard, wildcard, wildcard]
        );
        folderContextRows.forEach((r: any) => {
          if (r.folder_id && !matchingCategoryIds.includes(r.folder_id)) {
            matchingCategoryIds.push(r.folder_id);
          }
        });
      } catch (err) {
        console.warn('[SearchService] Error searching folder_context:', err);
      }

      // 3. Search classification_cache table for matching AI summary, AI tags, and entities
      let matchingScreenshotIds: string[] = [];
      try {
        const cacheRows = await databaseService.executeQuery(
          `SELECT screenshot_id FROM classification_cache 
           WHERE LOWER(summary) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(entities_json) LIKE ?`,
          [wildcard, wildcard, wildcard]
        );
        cacheRows.forEach((r: any) => {
          if (r.screenshot_id) {
            matchingScreenshotIds.push(r.screenshot_id);
          }
        });
      } catch (err) {
        console.warn('[SearchService] Error searching classification_cache:', err);
      }

      // 4. Query local SQLite database combining direct screenshot match, folder matches, and AI cache matches
      const textConditions: string[] = [
        'LOWER(file_name) LIKE ?',
        'LOWER(ocr_text) LIKE ?',
        'LOWER(category_name) LIKE ?',
        'LOWER(subcategory) LIKE ?',
        'LOWER(keywords_json) LIKE ?',
      ];
      const params: any[] = [wildcard, wildcard, wildcard, wildcard, wildcard];

      if (matchingCategoryIds.length > 0) {
        const catPlaceholders = matchingCategoryIds.map(() => '?').join(',');
        textConditions.push(`category_id IN (${catPlaceholders})`);
        params.push(...matchingCategoryIds);
      }

      if (matchingScreenshotIds.length > 0) {
        const ssPlaceholders = matchingScreenshotIds.map(() => '?').join(',');
        textConditions.push(`id IN (${ssPlaceholders})`);
        params.push(...matchingScreenshotIds);
      }

      let whereClause = `(${textConditions.join(' OR ')})`;

      if (categoryId && categoryId !== 'all') {
        whereClause += ' AND category_id = ?';
        params.push(categoryId);
      }
      whereClause += ' AND (is_deleted = 0 OR is_deleted IS NULL)';

      const sql = `SELECT * FROM screenshots WHERE ${whereClause} ORDER BY created_at DESC LIMIT 100`;
      const rows = await databaseService.executeQuery(sql, params);

      const models: ScreenshotModel[] = rows.map((row: any) => {
        let keywords: string[] = [];
        try {
          if (row.keywords_json) keywords = JSON.parse(row.keywords_json);
        } catch {}

        let folderPath: string[] | undefined;
        try {
          if (row.folder_path) folderPath = JSON.parse(row.folder_path);
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
          folderPath,
          confidence: row.confidence,
          sourceApp: row.source_app,
          detectedApp: row.detected_app,
          keywords,
          isAutoCategorized: Boolean(row.is_auto_categorized),
          isFavorite: Boolean(row.is_favorite),
          isReviewed: Boolean(row.is_reviewed),
          isSynced: Boolean(row.is_synced),
          ocrStatus: row.ocr_status,
          ocrText: row.ocr_text,
          lastScannedAt: row.last_scanned_at,
          classificationSource: row.classification_source || (row.is_synced ? 'backend' : 'local'),
          tags: keywords.slice(0, 5).map((kw) => ({
            id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
            name: kw,
            colorHex: '#6366F1',
          })),
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
          (s.keywords && s.keywords.some((k) => k.toLowerCase().includes(q))) ||
          (s.folderPath && s.folderPath.some((p) => p.toLowerCase().includes(q)));

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

import { Result } from '../utils/result';
import { ScreenshotModel } from '../models';
import { databaseService } from '../database';
import { useScreenshotStore } from '../store/screenshot.store';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { semanticSearchService } from './search/SemanticSearchService';

export interface SearchFilters {
  query?: string;
  folderId?: string;
  categoryId?: string;
  merchant?: string;
  tags?: string[];
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  minConfidence?: number;
  maxConfidence?: number;
  ocrKeywords?: string[];
  visionCategory?: string;
  favorite?: boolean;
  appSource?: string;
  timelineFilter?: string;
  limit?: number;
  offset?: number;
}

export class SearchService {
  /**
   * Offline AI Semantic Search using 7-signal ranking engine.
   */
  async semanticSearch(query: string, filters?: SearchFilters): Promise<Result<ScreenshotModel[]>> {
    try {
      const results = await semanticSearchService.search(query, filters);
      return Result.success(results);
    } catch {
      return this.searchWithFilters({ query, ...filters });
    }
  }

  /**
   * Local offline multi-field search across screenshots, smart folder metadata,
   * AI classification cache (AI summary, AI tags, entities), and folder context summaries.
   * Matches: OCR text, AI summary, AI tags, folder summaries, entities, file name, category, and subcategory.
   */
  async searchScreenshots(
    query: string,
    categoryId?: string,
    filters?: Omit<SearchFilters, 'query' | 'categoryId'>
  ): Promise<Result<ScreenshotModel[]>> {
    return this.searchWithFilters({
      query,
      categoryId,
      ...filters,
    });
  }

  /**
   * Advanced Multi-Parameter Search:
   * Supports simultaneous filtering across folderId, merchant, tags, amount range,
   * date range, confidence threshold, OCR keywords, Vision category, and favorites.
   * Executes against indexed SQLite first with graceful in-memory fallback.
   */
  async searchWithFilters(filters: SearchFilters): Promise<Result<ScreenshotModel[]>> {
    const q = (filters.query || '').trim().toLowerCase();
    const catId = filters.categoryId || filters.folderId;
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    try {
      const conditions: string[] = ['(is_deleted = 0 OR is_deleted IS NULL)'];
      const params: any[] = [];

      // 1. Folder / Category Filter
      if (catId && catId !== 'all') {
        conditions.push('(category_id = ? OR folder_id = ?)');
        params.push(catId, catId);
      }

      // 2. Favorite Filter
      if (filters.favorite !== undefined) {
        conditions.push('is_favorite = ?');
        params.push(filters.favorite ? 1 : 0);
      }

      // 3. Confidence Threshold Filter
      if (filters.minConfidence !== undefined) {
        conditions.push('confidence >= ?');
        params.push(filters.minConfidence > 1 ? filters.minConfidence / 100 : filters.minConfidence);
      }
      if (filters.maxConfidence !== undefined) {
        conditions.push('confidence <= ?');
        params.push(filters.maxConfidence > 1 ? filters.maxConfidence / 100 : filters.maxConfidence);
      }

      // 4. Date Range Filter
      if (filters.dateFrom) {
        conditions.push('created_at >= ?');
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        conditions.push('created_at <= ?');
        params.push(filters.dateTo);
      }

      // 5. Merchant Filter
      if (filters.merchant) {
        const mWildcard = `%${filters.merchant.toLowerCase()}%`;
        conditions.push(
          '(LOWER(subcategory) LIKE ? OR id IN (SELECT screenshot_id FROM classification_cache WHERE LOWER(entities_json) LIKE ?))'
        );
        params.push(mWildcard, mWildcard);
      }

      // 6. Tags Filter
      if (filters.tags && filters.tags.length > 0) {
        for (const tag of filters.tags) {
          const tWildcard = `%${tag.toLowerCase()}%`;
          conditions.push(
            '(LOWER(keywords_json) LIKE ? OR id IN (SELECT screenshot_id FROM screenshot_tags st JOIN tags t ON t.id = st.tag_id WHERE LOWER(t.name) LIKE ?))'
          );
          params.push(tWildcard, tWildcard);
        }
      }

      // 7. App / Source Filter
      if (filters.appSource) {
        const appWildcard = `%${filters.appSource.toLowerCase()}%`;
        conditions.push('(LOWER(source_app) LIKE ? OR LOWER(detected_app) LIKE ?)');
        params.push(appWildcard, appWildcard);
      }

      // 8. Vision Category Filter
      if (filters.visionCategory) {
        const vWildcard = `%${filters.visionCategory.toLowerCase()}%`;
        conditions.push(
          '(LOWER(category_name) LIKE ? OR id IN (SELECT screenshot_id FROM vision_cache WHERE LOWER(screen_type) LIKE ?))'
        );
        params.push(vWildcard, vWildcard);
      }

      // 9. OCR Keywords Filter
      if (filters.ocrKeywords && filters.ocrKeywords.length > 0) {
        for (const kw of filters.ocrKeywords) {
          const kwWildcard = `%${kw.toLowerCase()}%`;
          conditions.push('LOWER(ocr_text) LIKE ?');
          params.push(kwWildcard);
        }
      }

      // 10. General Query String Filter
      if (q) {
        const wildcard = `%${q}%`;

        // Find matching category IDs
        let matchingCategoryIds: string[] = [];
        try {
          const allCats = await categoryRepository.getAllCategories();
          allCats.forEach((c) => {
            if (c.name.toLowerCase().includes(q) || (c.path && c.path.toLowerCase().includes(q))) {
              matchingCategoryIds.push(c.id);
            }
          });
        } catch {}

        // Find matching classification cache screenshot IDs
        let matchingScreenshotIds: string[] = [];
        try {
          const cacheRows = await databaseService.executeQuery(
            `SELECT screenshot_id FROM classification_cache 
             WHERE LOWER(summary) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(entities_json) LIKE ?`,
            [wildcard, wildcard, wildcard]
          );
          cacheRows.forEach((r: any) => {
            if (r.screenshot_id) matchingScreenshotIds.push(r.screenshot_id);
          });
        } catch {}

        const textConditions: string[] = [
          'LOWER(file_name) LIKE ?',
          'LOWER(ocr_text) LIKE ?',
          'LOWER(category_name) LIKE ?',
          'LOWER(subcategory) LIKE ?',
          'LOWER(keywords_json) LIKE ?',
        ];
        params.push(wildcard, wildcard, wildcard, wildcard, wildcard);

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

        conditions.push(`(${textConditions.join(' OR ')})`);
      }

      const whereClause = conditions.join(' AND ');
      const sql = `SELECT * FROM screenshots WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = await databaseService.executeQuery(sql, params);

      let models = rows.map(this.mapRowToModel);

      // In-memory amount range filtering if requested
      if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
        models = models.filter((item) => {
          const amt = this.extractAmountNumber(item);
          if (filters.minAmount !== undefined && amt < filters.minAmount) return false;
          if (filters.maxAmount !== undefined && amt > filters.maxAmount) return false;
          return true;
        });
      }

      return Result.success(models);
    } catch (err: any) {
      console.warn('[SearchService] SQLite search query failed, using in-memory filter:', err);

      // In-memory fallback
      let inMemory = useScreenshotStore.getState().screenshots.filter((s) => !s.isDeleted);

      if (q) {
        inMemory = inMemory.filter((s) => {
          return (
            s.fileName.toLowerCase().includes(q) ||
            (s.ocrText && s.ocrText.toLowerCase().includes(q)) ||
            s.categoryName.toLowerCase().includes(q) ||
            (s.subcategory && s.subcategory.toLowerCase().includes(q)) ||
            (s.keywords && s.keywords.some((k) => k.toLowerCase().includes(q))) ||
            (s.folderPath && s.folderPath.some((p) => p.toLowerCase().includes(q)))
          );
        });
      }

      if (catId && catId !== 'all') {
        inMemory = inMemory.filter((s) => s.categoryId === catId || (s as any).folderId === catId);
      }

      if (filters.favorite !== undefined) {
        inMemory = inMemory.filter((s) => s.isFavorite === filters.favorite);
      }

      if (filters.minConfidence !== undefined) {
        const threshold = filters.minConfidence > 1 ? filters.minConfidence / 100 : filters.minConfidence;
        inMemory = inMemory.filter((s) => (s.confidence || 0) >= threshold);
      }

      if (filters.merchant) {
        const m = filters.merchant.toLowerCase();
        inMemory = inMemory.filter((s) => {
          const sub = (s.subcategory || '').toLowerCase();
          const ent = s.entities?.merchant ? String(s.entities.merchant).toLowerCase() : '';
          return sub.includes(m) || ent.includes(m);
        });
      }

      if (filters.tags && filters.tags.length > 0) {
        inMemory = inMemory.filter((s) => {
          const kws = (s.keywords || []).map((k) => k.toLowerCase());
          return filters.tags!.some((t) => kws.includes(t.toLowerCase()));
        });
      }

      if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
        inMemory = inMemory.filter((s) => {
          const amt = this.extractAmountNumber(s);
          if (filters.minAmount !== undefined && amt < filters.minAmount) return false;
          if (filters.maxAmount !== undefined && amt > filters.maxAmount) return false;
          return true;
        });
      }

      return Result.success(inMemory.slice(offset, offset + limit));
    }
  }

  private mapRowToModel = (row: any): ScreenshotModel => {
    let keywords: string[] = [];
    try {
      if (row.keywords_json) keywords = JSON.parse(row.keywords_json);
    } catch {}

    let folderPath: string[] | undefined;
    try {
      if (row.folder_path) folderPath = JSON.parse(row.folder_path);
    } catch {}

    let entities: Record<string, any> | undefined;
    try {
      if (row.entities_json) entities = JSON.parse(row.entities_json);
    } catch {}

    return {
      id: row.id,
      deviceAssetId: row.device_asset_id || '',
      filePath: row.file_path,
      localPath: row.local_path || row.file_path,
      contentUri: row.content_uri,
      thumbnailUri: row.thumbnail_uri,
      fileName: row.file_name,
      createdAt: row.created_at,
      width: row.width,
      height: row.height,
      fileSize: row.file_size,
      categoryId: row.category_id,
      folderId: row.category_id,
      categoryName: row.category_name,
      subcategory: row.subcategory || '',
      folderPath,
      confidence: row.confidence,
      sourceApp: row.source_app,
      detectedApp: row.detected_app,
      keywords,
      entities: entities as any,
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
  };

  private extractAmountNumber = (s: ScreenshotModel): number => {
    if (s.entities?.amount) {
      const num = parseFloat(String(s.entities.amount).replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) return num;
    }
    const amtTag = s.tags?.find((t) => t.name.startsWith('₹') || t.name.startsWith('amt_'));
    if (amtTag) {
      const num = parseFloat(amtTag.name.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) return num;
    }
    if (s.ocrText) {
      const m = s.ocrText.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (m) {
        const num = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(num)) return num;
      }
    }
    return 0;
  };
}

export const searchService = new SearchService();

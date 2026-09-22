import { Result } from '../utils/result';
import { ScreenshotModel } from '../models';
import { databaseService } from '../database';
import { useScreenshotStore } from '../store/screenshot.store';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { semanticSearchService } from './search/SemanticSearchService';
import { contextRetrievalService } from './contextChat/ContextRetrievalService';

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

export interface ParsedTimeAndIntent {
  dateFrom?: string;
  dateTo?: string;
  period?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'specific_month';
  monthName?: string;
  detectedIntent?: {
    domain?: string;
    categoryId?: string;
    categoryName?: string;
    merchant?: string;
    tags?: string[];
  };
  cleanedQuery: string;
}

export class SearchService {
  /**
   * Parses natural language time phrases and query intent (e.g. 'today', 'yesterday',
   * 'this week', 'last week', 'September payments', 'Amazon shopping', 'Swiggy food', 'salary').
   */
  parseNaturalLanguageTimeFilters(query: string): ParsedTimeAndIntent {
    const raw = (query || '').trim();
    const lower = raw.toLowerCase();
    let cleaned = lower;

    const now = new Date();
    const formatLocalDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let dateFrom: string | undefined;
    let dateTo: string | undefined;
    let period: ParsedTimeAndIntent['period'];
    let monthName: string | undefined;

    // Time detection
    if (/\btoday\b/i.test(lower)) {
      dateFrom = formatLocalDate(now);
      dateTo = dateFrom;
      period = 'today';
      cleaned = cleaned.replace(/\btoday(?:'s)?\b/gi, ' ');
    } else if (/\byesterday\b/i.test(lower)) {
      const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      dateFrom = formatLocalDate(yest);
      dateTo = dateFrom;
      period = 'yesterday';
      cleaned = cleaned.replace(/\byesterday(?:'s)?\b/gi, ' ');
    } else if (/\b(this week|current week)\b/i.test(lower)) {
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      dateFrom = formatLocalDate(weekAgo);
      dateTo = formatLocalDate(now);
      period = 'this_week';
      cleaned = cleaned.replace(/\b(this week|current week)\b/gi, ' ');
    } else if (/\b(last week|past week)\b/i.test(lower)) {
      const twoWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
      const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      dateFrom = formatLocalDate(twoWeeksAgo);
      dateTo = formatLocalDate(oneWeekAgo);
      period = 'last_week';
      cleaned = cleaned.replace(/\b(last week|past week)\b/gi, ' ');
    } else if (/\bthis month\b/i.test(lower)) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFrom = formatLocalDate(monthStart);
      dateTo = formatLocalDate(now);
      period = 'this_month';
      cleaned = cleaned.replace(/\bthis month\b/gi, ' ');
    } else if (/\blast month\b/i.test(lower)) {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      dateFrom = formatLocalDate(lastMonthStart);
      dateTo = formatLocalDate(lastMonthEnd);
      period = 'last_month';
      cleaned = cleaned.replace(/\blast month\b/gi, ' ');
    } else {
      const monthMap: Record<string, number> = {
        january: 0, jan: 0,
        february: 1, feb: 1,
        march: 2, mar: 2,
        april: 3, apr: 3,
        may: 4,
        june: 5, jun: 5,
        july: 6, jul: 6,
        august: 7, aug: 7,
        september: 8, sep: 8, sept: 8,
        october: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, dec: 11,
      };
      for (const [mName, mIdx] of Object.entries(monthMap)) {
        const regex = new RegExp(`\\b${mName}\\b`, 'i');
        if (regex.test(lower)) {
          const year = now.getFullYear();
          const start = new Date(year, mIdx, 1);
          const end = new Date(year, mIdx + 1, 0);
          dateFrom = formatLocalDate(start);
          dateTo = formatLocalDate(end);
          period = 'specific_month';
          monthName = mName;
          cleaned = cleaned.replace(new RegExp(`\\b${mName}(?:'s)?\\b`, 'gi'), ' ');
          break;
        }
      }
    }

    // Intent detection
    let detectedIntent: ParsedTimeAndIntent['detectedIntent'];
    if (/\b(salary|credited|payroll)\b/i.test(lower)) {
      detectedIntent = {
        domain: 'finance',
        categoryId: 'finance_bills',
        categoryName: 'Finance & Bills',
        tags: ['salary', 'credited'],
      };
      cleaned = cleaned.replace(/\b(salary|credited|payroll)\b/gi, ' ');
    } else if (/\b(payments?|upi|paid|transfers?|transactions?|recharges?|bills?)\b/i.test(lower)) {
      detectedIntent = {
        domain: 'finance',
        categoryId: 'finance_bills',
        categoryName: 'Finance & Bills',
        tags: ['payment', 'upi'],
      };
      cleaned = cleaned.replace(/\b(payments?|upi|paid|transfers?|transactions?|recharges?|bills?)\b/gi, ' ');
    } else if (/\b(amazon)\b/i.test(lower)) {
      detectedIntent = {
        domain: 'shopping',
        categoryId: 'shopping_orders',
        categoryName: 'Shopping & Orders',
        merchant: 'Amazon',
        tags: ['amazon', 'shopping'],
      };
      cleaned = cleaned.replace(/\b(amazon|orders?|shopping)\b/gi, ' ');
    } else if (/\b(swiggy)\b/i.test(lower)) {
      detectedIntent = {
        domain: 'food',
        categoryId: 'food_dining',
        categoryName: 'Food & Dining',
        merchant: 'Swiggy',
        tags: ['swiggy', 'food'],
      };
      cleaned = cleaned.replace(/\b(swiggy|food|dining|orders?)\b/gi, ' ');
    } else if (/\b(flight tickets?|flights?|boarding pass(?:es)?|airports?|tickets?|trains?|irctc)\b/i.test(lower)) {
      detectedIntent = {
        domain: 'travel',
        categoryId: 'travel_transit',
        categoryName: 'Travel & Transit',
        tags: ['travel', 'ticket'],
      };
      cleaned = cleaned.replace(/\b(flight tickets?|flights?|boarding pass(?:es)?|airports?|tickets?|trains?|irctc)\b/gi, ' ');
    }

    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    return {
      dateFrom,
      dateTo,
      period,
      monthName,
      detectedIntent,
      cleanedQuery: cleaned,
    };
  }

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
    const rawQ = (filters.query || '').trim();
    const nl = this.parseNaturalLanguageTimeFilters(rawQ);
    const hasNlFilter = Boolean(nl.period || nl.detectedIntent);
    const q = (nl.cleanedQuery || (hasNlFilter ? '' : rawQ)).toLowerCase();
    const catId = filters.categoryId || filters.folderId || nl.detectedIntent?.categoryId;
    const merchant = filters.merchant || nl.detectedIntent?.merchant;
    const dateFrom = filters.dateFrom || nl.dateFrom;
    const dateTo = filters.dateTo || nl.dateTo;
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

      // 4. Date Range Filter (including natural language parsed dates)
      if (dateFrom) {
        conditions.push('created_at >= ?');
        params.push(dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        conditions.push('created_at <= ?');
        params.push(dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`);
      }

      // 5. Merchant Filter
      if (merchant) {
        const mWildcard = `%${merchant.toLowerCase()}%`;
        conditions.push(
          '(LOWER(subcategory) LIKE ? OR id IN (SELECT screenshot_id FROM classification_cache WHERE LOWER(entities_json) LIKE ?))'
        );
        params.push(mWildcard, mWildcard);
      }

      // 6. Tags Filter
      const effectiveTags = [...(filters.tags || []), ...(nl.detectedIntent?.tags || [])];
      if (effectiveTags.length > 0) {
        for (const tag of effectiveTags) {
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
      const searchTerms = [q, rawQ.toLowerCase()].filter((t, idx, arr) => t && arr.indexOf(t) === idx);
      if (searchTerms.length > 0) {
        const matchingCategoryIds: string[] = [];
        const matchingScreenshotIds: string[] = [];

        for (const term of searchTerms) {
          const wildcard = `%${term}%`;

          // Find matching category IDs
          try {
            const allCats = await categoryRepository.getAllCategories();
            allCats.forEach((c) => {
              if (c.name.toLowerCase().includes(term) || (c.path && c.path.toLowerCase().includes(term))) {
                if (!matchingCategoryIds.includes(c.id)) matchingCategoryIds.push(c.id);
              }
            });
          } catch {}

          // Find matching classification cache screenshot IDs
          try {
            const cacheRows = await databaseService.executeQuery(
              `SELECT screenshot_id FROM classification_cache 
               WHERE LOWER(summary) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(entities_json) LIKE ?`,
              [wildcard, wildcard, wildcard]
            );
            cacheRows.forEach((r: any) => {
              if (r.screenshot_id && !matchingScreenshotIds.includes(r.screenshot_id)) {
                matchingScreenshotIds.push(r.screenshot_id);
              }
            });
          } catch {}

          // Find matching Memory Timeline events
          try {
            const timelineRows = await databaseService.executeQuery(
              `SELECT screenshot_ids_json FROM memory_timeline 
               WHERE LOWER(summary) LIKE ? OR LOWER(event_type) LIKE ?`,
              [wildcard, wildcard]
            );
            for (const row of timelineRows) {
              if (row.screenshot_ids_json) {
                try {
                  const ids = JSON.parse(row.screenshot_ids_json);
                  if (Array.isArray(ids)) {
                    ids.forEach((id) => {
                      if (id && !matchingScreenshotIds.includes(id)) matchingScreenshotIds.push(id);
                    });
                  }
                } catch {}
              }
            }
          } catch {}

          // Find matching Daily Digests
          try {
            const digestRows = await databaseService.executeQuery(
              `SELECT digest_date FROM daily_digest 
               WHERE LOWER(ai_summary) LIKE ? OR LOWER(merchant_summary_json) LIKE ? OR LOWER(category_summary_json) LIKE ?`,
              [wildcard, wildcard, wildcard]
            );
            for (const row of digestRows) {
              if (row.digest_date) {
                const dtTimelineRows = await databaseService.executeQuery(
                  `SELECT screenshot_ids_json FROM memory_timeline WHERE event_date = ?`,
                  [row.digest_date]
                );
                for (const tr of dtTimelineRows) {
                  if (tr.screenshot_ids_json) {
                    try {
                      const ids = JSON.parse(tr.screenshot_ids_json);
                      if (Array.isArray(ids)) {
                        ids.forEach((id) => {
                          if (id && !matchingScreenshotIds.includes(id)) matchingScreenshotIds.push(id);
                        });
                      }
                    } catch {}
                  }
                }
              }
            }
          } catch {}

          // Conversational Retrieval Integration (Sprint P3-B)
          try {
            const hybrid = await contextRetrievalService.retrieveHybridContext(rawQ, {
              folderId: catId,
            });
            hybrid.screenshots.forEach((ctx) => {
              if (ctx.screenshot.id && !matchingScreenshotIds.includes(ctx.screenshot.id)) {
                matchingScreenshotIds.push(ctx.screenshot.id);
              }
            });
          } catch {}
        }

        const textConditions: string[] = [
          'LOWER(file_name) LIKE ?',
          'LOWER(ocr_text) LIKE ?',
          'LOWER(category_name) LIKE ?',
          'LOWER(subcategory) LIKE ?',
          'LOWER(keywords_json) LIKE ?',
        ];
        const primaryWildcard = `%${searchTerms[0]}%`;
        params.push(primaryWildcard, primaryWildcard, primaryWildcard, primaryWildcard, primaryWildcard);

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

      if (dateFrom) {
        const fromMs = new Date(dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`).getTime();
        inMemory = inMemory.filter((s) => new Date(s.createdAt).getTime() >= fromMs);
      }

      if (dateTo) {
        const toMs = new Date(dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`).getTime();
        inMemory = inMemory.filter((s) => new Date(s.createdAt).getTime() <= toMs);
      }

      if (merchant) {
        const m = merchant.toLowerCase();
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

      if (inMemory.length === 0 && rawQ) {
        try {
          const contexts = await contextRetrievalService.retrieveContext(rawQ, catId);
          if (contexts.length > 0) {
            inMemory = contexts.map((c) => c.screenshot);
          }
        } catch {}
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

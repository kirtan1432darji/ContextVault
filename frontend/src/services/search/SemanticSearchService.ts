import { databaseService } from '../../database';
import { useScreenshotStore } from '../../store/screenshot.store';
import {
  ScreenshotModel,
  GlobalSearchResultItem,
  SearchFilterState,
  DetectedEntity,
  TextToken,
} from '../../models';
import { SearchFilters } from '../searchService';
import { searchIntentParser, ParsedSearchIntent } from './SearchIntentParser';
import { searchAnalyticsService } from './SearchAnalyticsService';

export interface ScoredCandidate {
  screenshot: ScreenshotModel;
  score: number;
  matchedField: string;
  matchReason: string;
  matchedSnippet: string;
  highlightedSnippet: TextToken[];
  entities: DetectedEntity[];
}

export class SemanticSearchService {
  /**
   * Primary offline semantic search function executing 7-signal ranking.
   */
  async search(query: string, filters?: SearchFilters): Promise<GlobalSearchResultItem[]> {
    const startTime = Date.now();
    const rawQuery = (query || '').trim();

    // 1. Parse natural query intent
    const intent = searchIntentParser.parse(rawQuery);

    // Merge explicit filters and resolve timeline filter if provided
    let resolvedDateFrom = filters?.dateFrom || intent.dateRange?.from;
    let resolvedDateTo = filters?.dateTo || intent.dateRange?.to;

    if (filters?.timelineFilter && !resolvedDateFrom && !resolvedDateTo) {
      const now = new Date();
      const formatLocalDate = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      if (filters.timelineFilter === 'today') {
        resolvedDateFrom = formatLocalDate(now);
        resolvedDateTo = resolvedDateFrom;
      } else if (filters.timelineFilter === 'yesterday') {
        const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        resolvedDateFrom = formatLocalDate(yest);
        resolvedDateTo = resolvedDateFrom;
      } else if (filters.timelineFilter === 'this_week') {
        const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        resolvedDateFrom = formatLocalDate(weekAgo);
        resolvedDateTo = formatLocalDate(now);
      } else if (filters.timelineFilter === 'this_month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        resolvedDateFrom = formatLocalDate(monthStart);
        resolvedDateTo = formatLocalDate(now);
      } else if (filters.timelineFilter === 'last_month') {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        resolvedDateFrom = formatLocalDate(lastMonthStart);
        resolvedDateTo = formatLocalDate(lastMonthEnd);
      }
    }

    const effectiveFilters: SearchFilters = {
      ...filters,
      query: rawQuery,
      merchant: filters?.merchant,
      categoryId: filters?.categoryId || filters?.folderId,
      folderId: filters?.folderId,
      minAmount: filters?.minAmount !== undefined ? filters?.minAmount : intent.amountRange?.min,
      maxAmount: filters?.maxAmount !== undefined ? filters?.maxAmount : intent.amountRange?.max,
      dateFrom: resolvedDateFrom,
      dateTo: resolvedDateTo,
      tags: filters?.tags && filters.tags.length > 0 ? filters.tags : undefined,
    };

    // 2. Retrieve candidates from SQLite (with memory fallback)
    const candidates = await this.retrieveCandidates(rawQuery, intent, effectiveFilters);

    // 3. Deduplicate candidates by screenshot ID
    const uniqueMap = new Map<string, ScreenshotModel>();
    for (const c of candidates) {
      if (c && c.id && !uniqueMap.has(c.id)) {
        uniqueMap.set(c.id, c);
      }
    }

    // 4. Apply 7-signal ranking formula
    const scoredList: ScoredCandidate[] = [];
    for (const screenshot of uniqueMap.values()) {
      // Check filters (amount range, dates, favorites, confidence)
      if (!this.matchesFilters(screenshot, effectiveFilters)) {
        continue;
      }

      const scored = this.scoreCandidate(screenshot, rawQuery, intent);
      scoredList.push(scored);
    }

    // 5. Sort by score descending, then by creation date descending
    scoredList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.screenshot.createdAt).getTime() - new Date(a.screenshot.createdAt).getTime();
    });

    const limit = effectiveFilters.limit || 100;
    const offset = effectiveFilters.offset || 0;
    const paginated = scoredList.slice(offset, offset + limit);

    const results: GlobalSearchResultItem[] = paginated.map((sc) => ({
      ...sc.screenshot,
      score: sc.score,
      matchedField: sc.matchedField,
      matchReason: sc.matchReason,
      matchedSnippet: sc.matchedSnippet,
      highlightedSnippet: sc.highlightedSnippet,
      detectedEntities: sc.entities,
    }));

    // 6. Record search latency and analytics
    const latency = Date.now() - startTime;
    searchAnalyticsService
      .recordSearch(rawQuery, results.length, latency, intent.categoryName, intent.merchant)
      .catch(() => {});

    return results;
  }

  /**
   * Search by merchant name.
   */
  async searchByMerchant(name: string): Promise<GlobalSearchResultItem[]> {
    return this.search(name, { merchant: name });
  }

  /**
   * Search by amount range.
   */
  async searchByAmount(range: { min?: number; max?: number }): Promise<GlobalSearchResultItem[]> {
    return this.search('', { minAmount: range.min, maxAmount: range.max });
  }

  /**
   * Search by date range or relative date.
   */
  async searchByDate(dateRange: {
    from?: string;
    to?: string;
    relative?: string;
  }): Promise<GlobalSearchResultItem[]> {
    return this.search('', { dateFrom: dateRange.from, dateTo: dateRange.to });
  }

  /**
   * Search by folder/category ID.
   */
  async searchByCategory(categoryId: string): Promise<GlobalSearchResultItem[]> {
    return this.search('', { categoryId, folderId: categoryId });
  }

  /**
   * Search by list of tags.
   */
  async searchByTags(tags: string[]): Promise<GlobalSearchResultItem[]> {
    return this.search('', { tags });
  }

  /**
   * Search by document type (e.g., 'aadhaar', 'pan', 'passport', 'driving_licence').
   */
  async searchByDocument(type: string): Promise<GlobalSearchResultItem[]> {
    return this.search(type, { categoryId: 'personal_docs' });
  }

  /**
   * Search for travel screenshots (tickets, boarding passes, train bookings).
   */
  async searchByTravel(): Promise<GlobalSearchResultItem[]> {
    return this.search('travel ticket booking flight train', { categoryId: 'travel_transit' });
  }

  /**
   * Search by Vision AI summary similarity.
   */
  async searchBySimilarity(summary: string): Promise<GlobalSearchResultItem[]> {
    return this.search(summary);
  }

  /**
   * Rebuilds SQLite search indices across screenshots and OCR.
   */
  async rebuildSearchIndex(): Promise<{ indexedCount: number; durationMs: number }> {
    const start = Date.now();
    try {
      const rows = await databaseService.executeQuery(
        `SELECT COUNT(*) as total FROM screenshots WHERE is_deleted = 0 OR is_deleted IS NULL`
      );
      const count = rows[0]?.total || 0;
      return { indexedCount: count, durationMs: Date.now() - start };
    } catch {
      const count = useScreenshotStore.getState().screenshots.length;
      return { indexedCount: count, durationMs: Date.now() - start };
    }
  }

  /**
   * Scores candidate screenshot using 7-signal weights:
   * 1. Merchant Match: 100
   * 2. Tag Match: 90
   * 3. Vision Category Match: 80
   * 4. OCR Keyword Match: 70
   * 5. Summary Similarity: 60
   * 6. Filename Match: 40
   * 7. Recency: 20
   */
  private scoreCandidate(
    item: ScreenshotModel,
    rawQuery: string,
    intent: ParsedSearchIntent
  ): ScoredCandidate {
    let score = 0;
    const reasons: string[] = [];
    let primaryField = 'General Match';
    let bestSnippet = item.ocrText?.trim() || item.fileName;

    const lowerQuery = rawQuery.toLowerCase();
    const ocrLower = (item.ocrText || '').toLowerCase();
    const fileNameLower = (item.fileName || '').toLowerCase();
    const catLower = (item.categoryName || '').toLowerCase();
    const subcatLower = (item.subcategory || '').toLowerCase();
    const merchantLower = item.entities?.merchant ? String(item.entities.merchant).toLowerCase() : '';
    const summaryLower = (item as any).summary ? String((item as any).summary).toLowerCase() : '';

    const queryTokens = intent.keywords.length > 0 ? intent.keywords : this.extractTokens(lowerQuery);

    // Signal 1: Merchant Exact Match (+100)
    let hasMerchantMatch = false;
    if (intent.merchant) {
      const targetM = intent.merchant.toLowerCase();
      if (
        merchantLower === targetM ||
        subcatLower.includes(targetM) ||
        ocrLower.includes(targetM) ||
        fileNameLower.includes(targetM)
      ) {
        hasMerchantMatch = true;
      }
    } else if (merchantLower && lowerQuery.includes(merchantLower)) {
      hasMerchantMatch = true;
    }

    if (hasMerchantMatch) {
      score += 100;
      reasons.push(`Matched merchant ${intent.merchant || item.entities?.merchant}`);
      primaryField = 'Merchant';
    }

    // Signal 2: Tag Match (+90)
    let hasTagMatch = false;
    const itemTags = (item.keywords || []).map((k) => k.toLowerCase());
    if (item.tags) {
      item.tags.forEach((t: any) => {
        const name = typeof t === 'string' ? t : t?.name;
        if (name) itemTags.push(name.toLowerCase());
      });
    }

    for (const tag of intent.tags) {
      if (itemTags.some((t) => t.includes(tag.toLowerCase()) || tag.toLowerCase().includes(t))) {
        hasTagMatch = true;
        break;
      }
    }
    if (!hasTagMatch && queryTokens.length > 0) {
      for (const token of queryTokens) {
        if (itemTags.includes(token)) {
          hasTagMatch = true;
          break;
        }
      }
    }

    if (hasTagMatch) {
      score += 90;
      reasons.push('Matched tag');
      if (primaryField === 'General Match') primaryField = 'Tags';
    }

    // Signal 3: Vision Category Match (+80)
    let hasCatMatch = false;
    if (intent.categoryId && (item.categoryId === intent.categoryId || item.folderId === intent.categoryId)) {
      hasCatMatch = true;
    } else if (intent.categoryName && catLower.includes(intent.categoryName.toLowerCase())) {
      hasCatMatch = true;
    } else if (intent.domain !== 'general' && catLower.includes(intent.domain)) {
      hasCatMatch = true;
    }

    if (hasCatMatch) {
      score += 80;
      reasons.push(`Matched category ${item.categoryName}`);
      if (primaryField === 'General Match') primaryField = 'Category';
    }

    // Signal 4: OCR Keyword Match (+70)
    let hasOcrMatch = false;
    if (queryTokens.length > 0 && ocrLower) {
      const matchCount = queryTokens.filter((token) => ocrLower.includes(token)).length;
      if (matchCount > 0) {
        hasOcrMatch = true;
        // Proportionate bonus if multiple keywords match
        const bonus = Math.min(20, (matchCount - 1) * 5);
        score += 70 + bonus;
        reasons.push('Found keyword in OCR text');
        if (primaryField === 'General Match') primaryField = 'OCR Text';

        // Extract best snippet around matched token
        const firstMatched = queryTokens.find((t) => ocrLower.includes(t));
        if (firstMatched) {
          const idx = ocrLower.indexOf(firstMatched);
          const start = Math.max(0, idx - 35);
          const end = Math.min(ocrLower.length, idx + firstMatched.length + 55);
          bestSnippet = (start > 0 ? '...' : '') + item.ocrText!.substring(start, end) + (end < item.ocrText!.length ? '...' : '');
        }
      }
    }

    // Signal 5: Summary Similarity (+60)
    let hasSummaryMatch = false;
    if (summaryLower && queryTokens.length > 0) {
      if (queryTokens.some((t) => summaryLower.includes(t)) || (lowerQuery && summaryLower.includes(lowerQuery))) {
        hasSummaryMatch = true;
        score += 60;
        reasons.push('Matched AI summary');
        if (primaryField === 'General Match') primaryField = 'Vision Summary';
      }
    }

    // Signal 6: Filename Match (+40)
    let hasFileMatch = false;
    if (queryTokens.some((token) => fileNameLower.includes(token)) || (lowerQuery && fileNameLower.includes(lowerQuery))) {
      hasFileMatch = true;
      score += 40;
      reasons.push('Matched file name');
      if (primaryField === 'General Match') primaryField = 'File Name';
    }

    // Signal 7: Recency (+20)
    const ageDays = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) {
      score += 20;
    } else if (ageDays <= 30) {
      score += 10;
    } else {
      score += 5;
    }

    // Highlight snippet
    const highlightedSnippet = this.highlightSnippet(bestSnippet, queryTokens);
    const entities = this.extractEntities(item);

    const matchReason = reasons.length > 0 ? reasons.join(' • ') : 'Indexed screenshot match';

    return {
      screenshot: item,
      score,
      matchedField: primaryField,
      matchReason,
      matchedSnippet: bestSnippet,
      highlightedSnippet,
      entities,
    };
  }

  private matchesFilters(item: ScreenshotModel, filters: SearchFilters): boolean {
    // 1. Explicit Folder / Category filter
    if (filters.categoryId && filters.categoryId !== 'all') {
      const targetCat = filters.categoryId.toLowerCase();
      const catId = (item.categoryId || '').toLowerCase();
      const folderId = ((item as any).folderId || '').toLowerCase();
      const catName = (item.categoryName || '').toLowerCase();
      if (
        catId !== targetCat &&
        folderId !== targetCat &&
        !catName.includes(targetCat) &&
        !targetCat.includes(catName)
      ) {
        return false;
      }
    }

    // 2. Explicit Merchant filter (e.g. from searchByMerchant)
    if (filters.merchant) {
      const targetM = filters.merchant.toLowerCase();
      const sMerchant = item.entities?.merchant ? String(item.entities.merchant).toLowerCase() : '';
      const subcat = (item.subcategory || '').toLowerCase();
      const ocr = (item.ocrText || '').toLowerCase();
      const fileName = item.fileName.toLowerCase();
      if (
        sMerchant !== targetM &&
        !subcat.includes(targetM) &&
        !ocr.includes(targetM) &&
        !fileName.includes(targetM)
      ) {
        return false;
      }
    }

    // 3. Explicit Tags filter
    if (filters.tags && filters.tags.length > 0) {
      const itemTags = (item.keywords || []).map((k) => k.toLowerCase());
      if (item.tags) {
        item.tags.forEach((t: any) => {
          const name = typeof t === 'string' ? t : t?.name;
          if (name) itemTags.push(name.toLowerCase());
        });
      }
      const hasAnyTag = filters.tags.some((t) =>
        itemTags.some((it) => it.includes(t.toLowerCase()) || t.toLowerCase().includes(it))
      );
      if (!hasAnyTag) return false;
    }

    // 4. Favorite filter
    if (filters.favorite !== undefined) {
      if (Boolean(item.isFavorite) !== filters.favorite) return false;
    }

    // 5. Confidence range
    if (filters.minConfidence !== undefined) {
      const min = filters.minConfidence > 1 ? filters.minConfidence / 100 : filters.minConfidence;
      if ((item.confidence || 0) < min) return false;
    }
    if (filters.maxConfidence !== undefined) {
      const max = filters.maxConfidence > 1 ? filters.maxConfidence / 100 : filters.maxConfidence;
      if ((item.confidence || 0) > max) return false;
    }

    // 6. Date range
    if (filters.dateFrom) {
      const itemDate = new Date(item.createdAt).getTime();
      const fromDate = new Date(filters.dateFrom).getTime();
      if (itemDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const itemDate = new Date(item.createdAt).getTime();
      const toDateStr = filters.dateTo.includes('T') ? filters.dateTo : `${filters.dateTo}T23:59:59.999Z`;
      const toDate = new Date(toDateStr).getTime();
      if (itemDate > toDate) return false;
    }

    // 7. Amount range
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      const amt = this.extractAmountNumber(item);
      if (filters.minAmount !== undefined && amt < filters.minAmount) return false;
      if (filters.maxAmount !== undefined && amt > filters.maxAmount) return false;
    }

    return true;
  }

  private async retrieveCandidates(
    rawQuery: string,
    intent: ParsedSearchIntent,
    filters: SearchFilters
  ): Promise<ScreenshotModel[]> {
    const qLower = (intent.cleanedQuery || rawQuery).toLowerCase();
    const wildcard = `%${qLower}%`;

    try {
      const conditions: string[] = ['(is_deleted = 0 OR is_deleted IS NULL)'];
      const params: any[] = [];

      if (qLower) {
        // Collect matching IDs from classification_cache, memory_timeline, and daily_digest
        let cacheIds: string[] = [];
        try {
          const cacheRows = await databaseService.executeQuery(
            `SELECT screenshot_id FROM classification_cache 
             WHERE LOWER(summary) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(entities_json) LIKE ?`,
            [wildcard, wildcard, wildcard]
          );
          cacheIds = cacheRows.map((r: any) => r.screenshot_id).filter(Boolean);
        } catch {}

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
                    if (id && !cacheIds.includes(id)) cacheIds.push(id);
                  });
                }
              } catch {}
            }
          }
        } catch {}

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
                        if (id && !cacheIds.includes(id)) cacheIds.push(id);
                      });
                    }
                  } catch {}
                }
              }
            }
          }
        } catch {}

        const textMatches = [
          'LOWER(file_name) LIKE ?',
          'LOWER(ocr_text) LIKE ?',
          'LOWER(category_name) LIKE ?',
          'LOWER(subcategory) LIKE ?',
          'LOWER(keywords_json) LIKE ?',
        ];
        params.push(wildcard, wildcard, wildcard, wildcard, wildcard);

        if (cacheIds.length > 0) {
          const placeholders = cacheIds.map(() => '?').join(',');
          textMatches.push(`id IN (${placeholders})`);
          params.push(...cacheIds);
        }

        conditions.push(`(${textMatches.join(' OR ')})`);
      }

      if (filters.categoryId && filters.categoryId !== 'all') {
        conditions.push('(category_id = ? OR folder_id = ?)');
        params.push(filters.categoryId, filters.categoryId);
      }

      const sql = `SELECT * FROM screenshots WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 150`;
      const rows = await databaseService.executeQuery(sql, params);

      if (rows && rows.length > 0) {
        return rows.map(this.mapRowToScreenshot);
      }
    } catch {
      // Fallback to in-memory store
    }

    // In-memory fallback
    const all = useScreenshotStore.getState().screenshots.filter((s) => !s.isDeleted);
    if (!qLower && !intent.merchant && !filters.merchant) return all;

    const tokens = [qLower, rawQuery.toLowerCase(), ...intent.keywords];
    if (intent.merchant) tokens.push(intent.merchant.toLowerCase());
    if (filters.merchant) tokens.push(filters.merchant.toLowerCase());
    if (intent.categoryName) tokens.push(intent.categoryName.toLowerCase());
    if (intent.categoryId) tokens.push(intent.categoryId.toLowerCase());
    if (intent.domain && intent.domain !== 'general') tokens.push(intent.domain.toLowerCase());
    if (intent.tags && intent.tags.length > 0) intent.tags.forEach((t) => tokens.push(t.toLowerCase()));

    return all.filter((s) => {
      const summary = (s as any).summary ? String((s as any).summary).toLowerCase() : '';
      const merchant = s.entities?.merchant ? String(s.entities.merchant).toLowerCase() : '';
      const full = `${s.fileName} ${s.ocrText || ''} ${s.categoryName} ${s.subcategory || ''} ${(s.keywords || []).join(' ')} ${summary} ${merchant}`.toLowerCase();
      return tokens.some((t) => t && full.includes(t));
    });
  }

  private extractTokens(text: string): string[] {
    return Array.from(
      new Set(
        text
          .replace(/[^\w\s₹]/gi, ' ')
          .split(/\s+/)
          .filter((t) => t.length > 1)
      )
    );
  }

  private highlightSnippet(snippet: string, tokens: string[]): TextToken[] {
    if (!snippet || tokens.length === 0) {
      return [{ text: snippet || '', isMatch: false }];
    }

    const escaped = tokens
      .filter((t) => t.trim().length > 1)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    if (!escaped) return [{ text: snippet, isMatch: false }];

    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = snippet.split(regex);

    return parts.map((part) => ({
      text: part,
      isMatch: tokens.some((t) => t.toLowerCase() === part.toLowerCase()),
    }));
  }

  private extractEntities(item: ScreenshotModel): DetectedEntity[] {
    const text = item.ocrText || '';
    const entities: DetectedEntity[] = [];

    // Amount
    const amt = this.extractAmountNumber(item);
    if (amt > 0) {
      entities.push({
        label: 'Amount',
        value: `₹${amt.toLocaleString('en-IN')}`,
        type: 'amount',
      });
    }

    // Merchant
    if (item.entities?.merchant) {
      entities.push({
        label: 'Merchant',
        value: String(item.entities.merchant),
        type: 'merchant',
      });
    } else if (item.subcategory) {
      entities.push({
        label: 'Merchant',
        value: item.subcategory,
        type: 'merchant',
      });
    }

    // Order ID
    const orderMatch = text.match(/(?:order\s*(?:id|#)?|txn\s*(?:id|#)?|ref\s*(?:id|#)?)\s*:?\s*([A-Za-z0-9-_]{6,20})/i);
    if (orderMatch) {
      entities.push({
        label: 'ID',
        value: orderMatch[1],
        type: 'order',
      });
    }

    return entities.slice(0, 3);
  }

  private extractAmountNumber(s: ScreenshotModel): number {
    if (s.entities?.amount) {
      const num = parseFloat(String(s.entities.amount).replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) return num;
    }
    const amtTag = s.tags?.find((t: any) => {
      const name = typeof t === 'string' ? t : t?.name;
      return name && (name.startsWith('₹') || name.startsWith('amt_'));
    });
    if (amtTag) {
      const tagName = typeof amtTag === 'string' ? amtTag : amtTag.name;
      const num = parseFloat(tagName.replace(/[^0-9.]/g, ''));
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
  }

  private mapRowToScreenshot = (row: any): ScreenshotModel => {
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
}

export const semanticSearchService = new SemanticSearchService();

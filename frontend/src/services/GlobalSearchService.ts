import { databaseService } from '../database';
import { apiClient } from '../api/apiClient';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { searchRepository } from '../database/repositories/searchRepository';
import {
  ScreenshotModel,
  GlobalSearchResultItem,
  SearchFilterState,
  AIAnswerCardData,
  DetectedEntity,
  TextToken,
} from '../models';

export interface ParsedNaturalQuery {
  rawQuery: string;
  cleanedQuery: string;
  extractedCategory?: string;
  detectedApp?: string;
  maxAmount?: number;
  minAmount?: number;
  exactAmount?: number;
  dateFilter?: 'today' | 'last_week' | 'this_month' | 'older';
  intentType: 'payment' | 'shopping' | 'code' | 'work' | 'travel' | 'general';
}

export class GlobalSearchService {
  /**
   * Parses natural language search strings for intelligent intent matching.
   * Examples:
   *  - "Show all UPI payments"
   *  - "Show shopping items under ₹500"
   *  - "Find Flutter screenshots from last week"
   *  - "Show invoices from Amazon"
   */
  parseNaturalQuery(query: string): ParsedNaturalQuery {
    const raw = (query || '').trim();
    const lower = raw.toLowerCase();

    let cleaned = lower;
    let intentType: ParsedNaturalQuery['intentType'] = 'general';
    let detectedApp: string | undefined;
    let maxAmount: number | undefined;
    let minAmount: number | undefined;
    let exactAmount: number | undefined;
    let dateFilter: ParsedNaturalQuery['dateFilter'] = undefined;
    let extractedCategory: string | undefined;

    // 1. App / Merchant Detection
    const knownApps: Record<string, string> = {
      amazon: 'Amazon',
      flipkart: 'Flipkart',
      myntra: 'Myntra',
      swiggy: 'Swiggy',
      zomato: 'Zomato',
      gpay: 'Google Pay',
      'google pay': 'Google Pay',
      phonepe: 'PhonePe',
      paytm: 'Paytm',
      whatsapp: 'WhatsApp',
      telegram: 'Telegram',
      twitter: 'Twitter',
      github: 'GitHub',
      nhdc: 'NHDC',
      uber: 'Uber',
      ola: 'Ola',
    };

    for (const [key, val] of Object.entries(knownApps)) {
      if (lower.includes(key)) {
        detectedApp = val;
        break;
      }
    }

    // 2. Intent Detection
    if (
      lower.includes('upi') ||
      lower.includes('payment') ||
      lower.includes('paid') ||
      lower.includes('transferred') ||
      lower.includes('transaction')
    ) {
      intentType = 'payment';
      extractedCategory = 'Finances & Bills';
    } else if (
      lower.includes('shop') ||
      lower.includes('invoice') ||
      lower.includes('receipt') ||
      lower.includes('order') ||
      lower.includes('cart')
    ) {
      intentType = 'shopping';
      extractedCategory = 'Shopping & Orders';
    } else if (
      lower.includes('flutter') ||
      lower.includes('code') ||
      lower.includes('react') ||
      lower.includes('github') ||
      lower.includes('git') ||
      lower.includes('bug')
    ) {
      intentType = 'code';
      extractedCategory = 'Development & Code';
    } else if (
      lower.includes('flight') ||
      lower.includes('hotel') ||
      lower.includes('ticket') ||
      lower.includes('boarding') ||
      lower.includes('train') ||
      lower.includes('irctc')
    ) {
      intentType = 'travel';
      extractedCategory = 'Travel & Bookings';
    } else if (
      lower.includes('meeting') ||
      lower.includes('nhdc') ||
      lower.includes('payroll') ||
      lower.includes('task')
    ) {
      intentType = 'work';
      extractedCategory = 'Work & Projects';
    }

    // 3. Amount Detection (under 500, < 500, under ₹500, ₹ 500)
    const underMatch = lower.match(/(?:under|less than|<|below)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (underMatch) {
      maxAmount = parseFloat(underMatch[1]);
      cleaned = cleaned.replace(underMatch[0], ' ');
    }

    const overMatch = lower.match(/(?:over|more than|>|above)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (overMatch) {
      minAmount = parseFloat(overMatch[1]);
      cleaned = cleaned.replace(overMatch[0], ' ');
    }

    const exactMatch = lower.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
    if (exactMatch && !maxAmount && !minAmount) {
      exactAmount = parseFloat(exactMatch[1]);
    }

    // 4. Temporal Detection
    if (lower.includes('last week') || lower.includes('past week')) {
      dateFilter = 'last_week';
      cleaned = cleaned.replace(/last week|past week/g, ' ');
    } else if (lower.includes('today')) {
      dateFilter = 'today';
      cleaned = cleaned.replace(/\btoday\b/g, ' ');
    } else if (lower.includes('this month')) {
      dateFilter = 'this_month';
      cleaned = cleaned.replace(/this month/g, ' ');
    }

    // Clean conversational phrases
    cleaned = cleaned
      .replace(/\b(show|find|search|get|list|display|all|screenshots|mentioning|from|with|items|item)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      rawQuery: raw,
      cleanedQuery: cleaned || raw,
      extractedCategory,
      detectedApp,
      maxAmount,
      minAmount,
      exactAmount,
      dateFilter,
      intentType,
    };
  }

  /**
   * Executes Global AI Search across entire screenshot library.
   * Coordinates online backend search & local SQLite knowledge base.
   */
  async searchGlobal({
    query,
    filters = {},
  }: {
    query: string;
    filters?: SearchFilterState;
  }): Promise<{
    results: GlobalSearchResultItem[];
    groupedResults: Record<string, GlobalSearchResultItem[]>;
    aiAnswer: AIAnswerCardData;
    isOffline: boolean;
  }> {
    const raw = (query || '').trim();
    if (!raw) {
      return {
        results: [],
        groupedResults: {},
        aiAnswer: {
          summary: 'Type a question or query to search across all screenshots.',
          matchCount: 0,
          entities: [],
          suggestedFollowUps: [],
          isOffline: false,
          query: '',
        },
        isOffline: false,
      };
    }

    const parsed = this.parseNaturalQuery(raw);
    let isOffline = false;
    const matchedBackendIds = new Set<string>();

    // 1. Try backend knowledge search
    try {
      const backendRes = await apiClient.searchContextKnowledge(parsed.cleanedQuery || raw);
      if (backendRes.isSuccess && backendRes.data && backendRes.data.length > 0) {
        backendRes.data.forEach((match) => {
          if (match.contextId) matchedBackendIds.add(match.contextId);
        });
      }
    } catch {
      isOffline = true;
    }

    // 2. Query SQLite locally across multiple indices
    const localItems = await this.queryLocalDatabase(raw, parsed, filters);

    // 3. Highlight matched keywords & rank results
    const queryTokens = this.extractQueryTokens(raw, parsed);
    const enrichedResults: GlobalSearchResultItem[] = localItems.map((item) => {
      const { snippet, matchReason, score, matchedField } = this.calculateMatchDetails(
        item,
        queryTokens,
        parsed
      );
      const highlightedSnippet = this.highlightSnippet(snippet, queryTokens);
      const entities = this.extractEntitiesFromItem(item);

      return {
        ...item,
        matchedSnippet: snippet,
        matchedField,
        matchReason,
        score,
        highlightedSnippet,
        detectedEntities: entities,
      };
    });

    // 4. Sort by score descending, then by date descending
    enrichedResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 5. Save recent search entry in SQLite asynchronously
    searchRepository.saveRecentSearch(raw, enrichedResults.length).catch(() => {});

    // 6. Group results by category
    const grouped: Record<string, GlobalSearchResultItem[]> = {};
    for (const res of enrichedResults) {
      const cat = res.categoryName || 'Smart Folder';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(res);
    }

    // 7. Synthesize AI Answer Card Data
    const aiAnswer = this.synthesizeAIAnswer(raw, parsed, enrichedResults, isOffline);

    return {
      results: enrichedResults,
      groupedResults: grouped,
      aiAnswer,
      isOffline,
    };
  }

  /**
   * Queries SQLite database with multi-field matching & filter applications.
   */
  private async queryLocalDatabase(
    rawQuery: string,
    parsed: ParsedNaturalQuery,
    filters: SearchFilterState
  ): Promise<ScreenshotModel[]> {
    const qLower = (parsed.cleanedQuery || rawQuery).toLowerCase();
    const wildcard = `%${qLower}%`;

    // Base conditions
    const conditions: string[] = [];
    const params: any[] = [];

    // Search fields: file_name, ocr_text, category_name, subcategory, keywords_json, detected_app, source_app
    const textConditions: string[] = [
      'LOWER(file_name) LIKE ?',
      'LOWER(ocr_text) LIKE ?',
      'LOWER(category_name) LIKE ?',
      'LOWER(subcategory) LIKE ?',
      'LOWER(keywords_json) LIKE ?',
      'LOWER(coalesce(detected_app, "")) LIKE ?',
      'LOWER(coalesce(source_app, "")) LIKE ?',
    ];
    params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);

    // Check classification cache and folder context for matching screenshot or folder IDs
    try {
      const cacheRows = await databaseService.executeQuery(
        `SELECT screenshot_id FROM classification_cache 
         WHERE LOWER(summary) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(entities_json) LIKE ?`,
        [wildcard, wildcard, wildcard]
      );
      const cacheIds = cacheRows.map((r: any) => r.screenshot_id).filter(Boolean);
      if (cacheIds.length > 0) {
        const placeholders = cacheIds.map(() => '?').join(',');
        textConditions.push(`id IN (${placeholders})`);
        params.push(...cacheIds);
      }
    } catch {}

    // Combine text matches
    conditions.push(`(${textConditions.join(' OR ')})`);

    // Natural Language Category match
    if (parsed.extractedCategory && (!filters.folderId || filters.folderId === 'all')) {
      conditions.push('LOWER(category_name) LIKE ?');
      params.push(`%${parsed.extractedCategory.toLowerCase()}%`);
    }

    // Natural Language App Detection
    if (parsed.detectedApp && !filters.sourceApp) {
      conditions.push('(LOWER(coalesce(detected_app, "")) LIKE ? OR LOWER(coalesce(source_app, "")) LIKE ? OR LOWER(ocr_text) LIKE ?)');
      params.push(
        `%${parsed.detectedApp.toLowerCase()}%`,
        `%${parsed.detectedApp.toLowerCase()}%`,
        `%${parsed.detectedApp.toLowerCase()}%`
      );
    }

    // Natural Language Date Filter
    if (parsed.dateFilter) {
      const now = new Date();
      if (parsed.dateFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        conditions.push('created_at >= ?');
        params.push(todayStr);
      } else if (parsed.dateFilter === 'last_week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        conditions.push('created_at >= ?');
        params.push(sevenDaysAgo);
      } else if (parsed.dateFilter === 'this_month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        conditions.push('created_at >= ?');
        params.push(monthStart);
      }
    }

    // Manual Filters: Folder ID
    if (filters.folderId && filters.folderId !== 'all') {
      conditions.push('category_id = ?');
      params.push(filters.folderId);
    }

    // Manual Filters: Date Range
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      if (filters.dateRange === 'today') {
        conditions.push('created_at >= ?');
        params.push(now.toISOString().split('T')[0]);
      } else if (filters.dateRange === '7days') {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        conditions.push('created_at >= ?');
        params.push(d.toISOString());
      } else if (filters.dateRange === '30days') {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        conditions.push('created_at >= ?');
        params.push(d.toISOString());
      }
    }

    // Manual Filters: App Source
    if (filters.sourceApp && filters.sourceApp !== 'all') {
      conditions.push('(LOWER(coalesce(detected_app, "")) LIKE ? OR LOWER(coalesce(source_app, "")) LIKE ?)');
      params.push(`%${filters.sourceApp.toLowerCase()}%`, `%${filters.sourceApp.toLowerCase()}%`);
    }

    // Manual Filters: Only Favorites
    if (filters.onlyFavorites) {
      conditions.push('is_favorite = 1');
    }

    // Manual Filters: Only Needs Review
    if (filters.onlyNeedsReview) {
      conditions.push('confidence < 0.65');
    }

    // Exclude soft-deleted screenshots
    conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM screenshots ${whereClause} ORDER BY created_at DESC LIMIT 150`;

    try {
      const rows = await databaseService.executeQuery(sql, params);
      return rows.map((row: any) => this.mapRowToScreenshot(row));
    } catch (err) {
      console.warn('[GlobalSearchService] SQLite query error, using in-memory search:', err);
      // Fallback in-memory
      return (await screenshotRepository.getAllScreenshots()).filter((s) => {
        const full = `${s.fileName} ${s.ocrText || ''} ${s.categoryName} ${s.subcategory || ''}`.toLowerCase();
        return full.includes(qLower);
      });
    }
  }

  /**
   * Tokenizes search input for keyword highlighting and scoring.
   */
  private extractQueryTokens(raw: string, parsed: ParsedNaturalQuery): string[] {
    const combined = `${raw} ${parsed.cleanedQuery}`.toLowerCase();
    return Array.from(
      new Set(
        combined
          .replace(/[^\w\s₹]/gi, ' ')
          .split(/\s+/)
          .filter((t) => t.length > 1 && !['all', 'the', 'and', 'for', 'with', 'from'].includes(t))
      )
    );
  }

  /**
   * Calculates relevance score, matched field, and excerpt snippet.
   */
  private calculateMatchDetails(
    item: ScreenshotModel,
    queryTokens: string[],
    parsed: ParsedNaturalQuery
  ): {
    snippet: string;
    matchReason: string;
    score: number;
    matchedField: string;
  } {
    let score = 10;
    let matchedField = 'OCR Text';
    let matchReason = 'Matched OCR Text';
    let bestSnippet = item.ocrText?.trim() || '';

    const textLower = (item.ocrText || '').toLowerCase();
    const titleLower = item.fileName.toLowerCase();
    const catLower = item.categoryName.toLowerCase();
    const subcatLower = (item.subcategory || '').toLowerCase();

    // 1. Exact phrase match in title
    if (parsed.cleanedQuery && titleLower.includes(parsed.cleanedQuery)) {
      score += 40;
      matchedField = 'File Name';
      matchReason = `File name matches "${parsed.cleanedQuery}"`;
      bestSnippet = item.fileName;
    }

    // 2. Exact phrase in OCR
    if (parsed.cleanedQuery && textLower.includes(parsed.cleanedQuery)) {
      score += 35;
      matchedField = 'OCR Text';
      matchReason = `Found "${parsed.cleanedQuery}" in screenshot text`;
      const idx = textLower.indexOf(parsed.cleanedQuery);
      const start = Math.max(0, idx - 40);
      const end = Math.min(item.ocrText!.length, idx + parsed.cleanedQuery.length + 60);
      bestSnippet = (start > 0 ? '...' : '') + item.ocrText!.substring(start, end) + (end < item.ocrText!.length ? '...' : '');
    }

    // 3. Category match
    if (parsed.extractedCategory && catLower.includes(parsed.extractedCategory.toLowerCase())) {
      score += 25;
      matchReason = `Folder match: ${item.categoryName}`;
    }

    // 4. App / Merchant match
    if (parsed.detectedApp) {
      const appLower = parsed.detectedApp.toLowerCase();
      if (
        (item.detectedApp && item.detectedApp.toLowerCase().includes(appLower)) ||
        (item.sourceApp && item.sourceApp.toLowerCase().includes(appLower)) ||
        textLower.includes(appLower)
      ) {
        score += 25;
        matchReason = `Source match: ${parsed.detectedApp}`;
      }
    }

    // 5. Amount Filter matching
    if (parsed.maxAmount !== undefined || parsed.exactAmount !== undefined) {
      const amountRegex = /(?:₹|rs\.?|inr)\s?(\d+(?:\.\d+)?)/gi;
      let match: RegExpExecArray | null;
      while ((match = amountRegex.exec(textLower)) !== null) {
        const val = parseFloat(match[1]);
        if (parsed.maxAmount && val <= parsed.maxAmount) {
          score += 30;
          matchReason = `Amount ₹${val} is under ₹${parsed.maxAmount}`;
          break;
        }
        if (parsed.exactAmount && Math.abs(val - parsed.exactAmount) < 1) {
          score += 35;
          matchReason = `Exact amount match: ₹${val}`;
          break;
        }
      }
    }

    // Fallback snippet truncate
    if (bestSnippet.length > 130) {
      bestSnippet = bestSnippet.substring(0, 130) + '...';
    }

    return {
      snippet: bestSnippet || 'No text extracted',
      matchReason,
      score,
      matchedField,
    };
  }

  /**
   * Splits a snippet into text tokens with match flags for visual highlighting.
   */
  highlightSnippet(snippet: string, tokens: string[]): TextToken[] {
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

  /**
   * Extracts entities (amounts, order IDs, merchants, dates) from screenshot OCR.
   */
  private extractEntitiesFromItem(item: ScreenshotModel): DetectedEntity[] {
    const text = item.ocrText || '';
    const entities: DetectedEntity[] = [];

    // Amount match
    const amountMatch = text.match(/(?:₹|INR|Rs\.?)\s?(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (amountMatch) {
      entities.push({
        label: 'Amount',
        value: `₹${amountMatch[1]}`,
        type: 'amount',
      });
    }

    // Order ID match
    const orderMatch = text.match(/(?:order\s*(?:id|#)?|txn\s*(?:id|#)?|ref\s*(?:id|#)?)\s*:?\s*([A-Za-z0-9-_]{6,20})/i);
    if (orderMatch) {
      entities.push({
        label: 'Ref / ID',
        value: orderMatch[1],
        type: 'order',
      });
    }

    // Merchant / App
    if (item.detectedApp || item.sourceApp) {
      entities.push({
        label: 'App',
        value: item.detectedApp || item.sourceApp || '',
        type: 'merchant',
      });
    }

    return entities.slice(0, 3);
  }

  /**
   * Synthesizes the AI Answer Card data and suggested follow-ups.
   */
  private synthesizeAIAnswer(
    query: string,
    parsed: ParsedNaturalQuery,
    results: GlobalSearchResultItem[],
    isOffline: boolean
  ): AIAnswerCardData {
    const count = results.length;
    let summary = '';
    const entities: DetectedEntity[] = [];
    const followUps: string[] = [];

    // Collect distinct detected entities from top 5 results
    const seenEntities = new Set<string>();
    for (const r of results.slice(0, 5)) {
      if (r.detectedEntities) {
        for (const e of r.detectedEntities) {
          const key = `${e.label}:${e.value}`;
          if (!seenEntities.has(key)) {
            seenEntities.add(key);
            entities.push(e);
          }
        }
      }
    }

    if (count === 0) {
      summary = `No screenshots found matching **"${query}"**. Try searching for alternate keywords or check your filters.`;
      followUps.push('Show all recent screenshots', 'View Unsorted screenshots', 'Check pending reviews');
    } else {
      if (parsed.intentType === 'payment') {
        const totalAmount = entities
          .filter((e) => e.type === 'amount')
          .map((e) => parseFloat(e.value.replace(/[^0-9.]/g, '')))
          .filter((n) => !isNaN(n))
          .reduce((acc, curr) => acc + curr, 0);

        summary = `Found **${count}** payment screenshot${count > 1 ? 's' : ''}.`;
        if (totalAmount > 0) {
          summary += ` Total identified: **₹${totalAmount.toLocaleString('en-IN')}**.`;
        }
        if (results[0]) {
          summary += ` Latest transaction is in **${results[0].categoryName}**.`;
        }

        followUps.push('Show payments this month', 'Find Swiggy payments', 'Show receipts over ₹1000');
      } else if (parsed.intentType === 'shopping') {
        summary = `Identified **${count}** shopping screenshot${count > 1 ? 's' : ''} across your orders and receipts.`;
        followUps.push('Show Amazon orders', 'Find invoices under ₹500', 'Show delivered items');
      } else if (parsed.intentType === 'code') {
        summary = `Found **${count}** technical screenshot${count > 1 ? 's' : ''} containing code snippets, terminals, and repos.`;
        followUps.push('Show Flutter bugs', 'Find GitHub links', 'Show React errors');
      } else {
        const topCat = results[0]?.categoryName || 'Smart Folders';
        summary = `Found **${count}** screenshot${count > 1 ? 's' : ''} matching **"${query}"**, primarily organized in **${topCat}**.`;
        followUps.push(`Show only in ${topCat}`, 'Filter by last week', 'Show favorites only');
      }
    }

    return {
      summary,
      matchCount: count,
      entities: entities.slice(0, 4),
      suggestedFollowUps: followUps,
      isOffline,
      query,
    };
  }

  private mapRowToScreenshot(row: any): ScreenshotModel {
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
  }
}

export const globalSearchService = new GlobalSearchService();

/**
 * ContextRetrievalService.ts
 * Hybrid Offline Context Retrieval Engine for ContextVault Context Chat AI (Sprint P3-B).
 * Searches SQLite metadata across:
 * 1. Screenshots (Vision cache, tags, entities, OCR text)
 * 2. Memory Timeline Events (via memoryTimelineService / memoryTimelineRepository)
 * 3. Daily & Weekly Digests (via dailyDigestService / digestAggregationService / digestRepository)
 * 4. Folder Context (via folderContextRepository / categoryRepository)
 * 5. Session Long-Term Conversation Summary (via chatSessionRepository)
 * 
 * Maximum Context Caps:
 * - Top 10 Screenshots
 * - Top 5 Timeline Events
 * - Top 3 Digest Summaries
 * - Top 2 Folder Contexts
 * 
 * Includes 30-second TTL performance caching for rapid multi-turn chat turns.
 */

import { databaseService } from '../../database';
import { ScreenshotModel } from '../../models';
import { useScreenshotStore } from '../../store/screenshot.store';
import { QueryIntentParser, ParsedQueryIntent } from './QueryIntentParser';
import { MemoryTimelineEvent } from '../memory/types';
import { memoryTimelineService } from '../memory/MemoryTimelineService';
import { dailyDigestService } from '../memory/DailyDigestService';
import { digestAggregationService } from '../memory/DigestAggregationService';
import { folderContextRepository } from '../../database/repositories/folderContextRepository';
import { categoryRepository } from '../../database/repositories/categoryRepository';
import { chatSessionRepository } from '../../database/repositories/ChatSessionRepository';

export interface RetrievedScreenshotContext {
  screenshot: ScreenshotModel;
  ocrText: string;
  visionSummary: string;
  tags: string[];
  merchants: string[];
  amounts: string[];
  category: string;
  subcategory: string;
  date: string;
  score: number;
  matchReasons: string[];
}

export interface DigestSummaryItem {
  type: 'daily' | 'weekly' | 'monthly';
  key: string; // e.g. "2026-09-22" or "2026-W38"
  title: string;
  summary: string;
  screenshotCount: number;
  spendingTotal?: number;
  topMerchants?: string[];
  score: number;
}

export interface FolderContextSummary {
  folderId: string;
  folderName: string;
  summary: string;
  entities?: Record<string, any>;
  score: number;
}

export interface RankedRetrievalContext {
  screenshots: RetrievedScreenshotContext[]; // Top 10
  timelineEvents: MemoryTimelineEvent[];     // Top 5
  digestSummaries: DigestSummaryItem[];      // Top 3
  folderContexts: FolderContextSummary[];    // Up to 2
  sessionSummary?: string;
  query: string;
}

interface CacheEntry {
  timestamp: number;
  data: RankedRetrievalContext;
}

export class ContextRetrievalService {
  private static instance: ContextRetrievalService | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  static getInstance(): ContextRetrievalService {
    if (!ContextRetrievalService.instance) {
      ContextRetrievalService.instance = new ContextRetrievalService();
    }
    return ContextRetrievalService.instance;
  }

  /**
   * Clears the in-memory retrieval cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retrieves and ranks up to 10 relevant screenshots from local SQLite metadata.
   * Maintains backward compatibility with legacy ContextChatService callers.
   */
  async retrieveContext(
    query: string,
    folderId?: string,
    customIntent?: ParsedQueryIntent
  ): Promise<RetrievedScreenshotContext[]> {
    const hybrid = await this.retrieveHybridContext(query, { folderId, customIntent });
    return hybrid.screenshots;
  }

  /**
   * Flagship Hybrid Context Retrieval:
   * Aggregates screenshots, memory timeline, digests, and folder context into a ranked context object.
   */
  async retrieveHybridContext(
    query: string,
    options?: {
      folderId?: string;
      sessionId?: string;
      customIntent?: ParsedQueryIntent;
      forceRefresh?: boolean;
    }
  ): Promise<RankedRetrievalContext> {
    const rawQuery = (query || '').trim();
    const cacheKey = `${rawQuery.toLowerCase()}_${options?.folderId || 'all'}_${options?.sessionId || 'all'}`;

    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const intent = options?.customIntent || QueryIntentParser.parse(rawQuery);

    // 1. Concurrently fetch all retrieval sources
    const [screenshots, timelineEvents, digestSummaries, folderContexts, sessionSummary] =
      await Promise.all([
        this.fetchAndRankScreenshots(intent, options?.folderId),
        this.fetchAndRankTimelineEvents(rawQuery, intent),
        this.fetchAndRankDigests(rawQuery, intent),
        this.fetchFolderContexts(rawQuery, intent, options?.folderId),
        this.fetchSessionSummary(options?.sessionId),
      ]);

    const result: RankedRetrievalContext = {
      screenshots: screenshots.slice(0, 10),
      timelineEvents: timelineEvents.slice(0, 5),
      digestSummaries: digestSummaries.slice(0, 3),
      folderContexts: folderContexts.slice(0, 2),
      sessionSummary,
      query: rawQuery,
    };

    // Store in cache
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });

    return result;
  }

  // ===========================================================================
  // 1. Screenshot Retrieval & 5-Tier Scoring
  // ===========================================================================

  private async fetchAndRankScreenshots(
    intent: ParsedQueryIntent,
    folderId?: string
  ): Promise<RetrievedScreenshotContext[]> {
    try {
      let candidates = await this.fetchCandidatesFromDatabase(intent, folderId);

      if (candidates.length === 0) {
        candidates = this.retrieveFromMemory(intent, folderId);
      }

      const scored = candidates.map((item) => this.scoreCandidate(item, intent));
      const filtered = folderId ? scored : scored.filter((s) => s.score > 0);

      filtered.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return timeB - timeA;
      });

      return filtered.slice(0, 10);
    } catch (err) {
      console.warn('[ContextRetrievalService] Screenshot retrieval fallback to memory:', err);
      return this.retrieveFromMemory(intent, folderId).slice(0, 10);
    }
  }

  private async fetchCandidatesFromDatabase(
    intent: ParsedQueryIntent,
    folderId?: string
  ): Promise<RetrievedScreenshotContext[]> {
    const conditions: string[] = ['(s.is_deleted = 0 OR s.is_deleted IS NULL)'];
    const params: any[] = [];

    if (folderId && folderId !== 'root' && folderId !== 'all') {
      conditions.push('(s.category_id = ? OR s.folder_id = ?)');
      params.push(folderId, folderId);
    }

    if (intent.categoryFilter) {
      conditions.push('LOWER(s.category_id) = ?');
      params.push(intent.categoryFilter.toLowerCase());
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT 
        s.*,
        coalesce(ocr.extracted_text, s.ocr_text, '') as full_ocr_text,
        coalesce(vc.summary, cc.summary, '') as vision_summary,
        coalesce(vc.detected_entities, cc.entities_json, '{}') as full_entities_json,
        coalesce(vc.detected_objects, cc.tags_json, '[]') as vision_tags_json
      FROM screenshots s
      LEFT JOIN ocr_cache ocr ON s.id = ocr.screenshot_id
      LEFT JOIN vision_cache vc ON s.id = vc.screenshot_id
      LEFT JOIN classification_cache cc ON s.id = cc.screenshot_id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT 100
    `;

    const rows = await databaseService.executeQuery(sql, params);

    return rows.map((row) => {
      let keywords: string[] = [];
      try {
        if (row.keywords_json) keywords = JSON.parse(row.keywords_json);
      } catch {}

      let visionTags: string[] = [];
      try {
        if (row.vision_tags_json) visionTags = JSON.parse(row.vision_tags_json);
      } catch {}

      let entities: Record<string, any> = {};
      try {
        if (row.full_entities_json) entities = JSON.parse(row.full_entities_json);
      } catch {}

      const allTags = Array.from(new Set([...keywords, ...visionTags]));

      const merchants: string[] = [];
      if (entities.merchant) merchants.push(String(entities.merchant));
      if (entities.merchants && Array.isArray(entities.merchants)) {
        merchants.push(...entities.merchants);
      }
      if (row.subcategory && !merchants.includes(row.subcategory)) {
        merchants.push(row.subcategory);
      }

      const amounts: string[] = [];
      if (entities.amount) amounts.push(String(entities.amount));
      if (entities.amounts && Array.isArray(entities.amounts)) {
        amounts.push(...entities.amounts);
      }
      const ocr = row.full_ocr_text || '';
      const amtMatch = ocr.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi);
      if (amtMatch) {
        amtMatch.forEach((m: string) => {
          const cleaned = m.replace(/(?:₹|rs\.?|inr|\s)/gi, '').replace(/,/g, '');
          if (cleaned && !amounts.includes(cleaned)) {
            amounts.push(cleaned);
          }
        });
      }

      const screenshotModel: ScreenshotModel = {
        id: row.id,
        deviceAssetId: row.device_asset_id || '',
        filePath: row.file_path,
        localPath: row.local_path || row.file_path,
        contentUri: row.content_uri,
        thumbnailUri: row.thumbnail_uri,
        fileName: row.file_name,
        createdAt: row.created_at,
        createdOn: row.created_on || row.created_at,
        width: row.width || 1080,
        height: row.height || 2400,
        fileSize: row.file_size || 0,
        categoryId: row.category_id,
        folderId: row.category_id,
        categoryName: row.category_name,
        subcategory: row.subcategory || 'General',
        confidence: row.confidence || 0.5,
        isAutoCategorized: Boolean(row.is_auto_categorized),
        isFavorite: Boolean(row.is_favorite),
        isReviewed: Boolean(row.is_reviewed),
        isSynced: Boolean(row.is_synced),
        ocrStatus: row.ocr_status || 'none',
        ocrText: row.full_ocr_text,
        keywords: allTags,
        tags: allTags.slice(0, 5).map((t) => ({
          id: `tag_${t.toLowerCase().replace(/\s+/g, '_')}`,
          name: t,
          colorHex: '#6366F1',
        })),
        classificationSource: row.classification_source || 'local',
        entities: entities as any,
      };

      return {
        screenshot: screenshotModel,
        ocrText: row.full_ocr_text || '',
        visionSummary: row.vision_summary || '',
        tags: allTags,
        merchants,
        amounts,
        category: row.category_id || '',
        subcategory: row.subcategory || '',
        date: row.created_at || '',
        score: 0,
        matchReasons: [],
      };
    });
  }

  private scoreCandidate(
    item: RetrievedScreenshotContext,
    intent: ParsedQueryIntent
  ): RetrievedScreenshotContext {
    let score = 0;
    const reasons: string[] = [];

    const ocrLower = item.ocrText.toLowerCase();
    const summaryLower = item.visionSummary.toLowerCase();
    const catLower = item.category.toLowerCase();
    const subcatLower = item.subcategory.toLowerCase();
    const tagsLower = item.tags.map((t) => t.toLowerCase());

    // 1. Exact Merchant Match (+50 points)
    if (intent.merchant) {
      const mTarget = intent.merchant.toLowerCase();
      const matchMerchant =
        item.merchants.some((m) => m.toLowerCase().includes(mTarget)) ||
        subcatLower.includes(mTarget) ||
        ocrLower.includes(mTarget) ||
        summaryLower.includes(mTarget);

      if (matchMerchant) {
        score += 50;
        reasons.push(`Merchant match: ${intent.merchant}`);
      }
    }

    // Document type match (+60 points)
    if (intent.documentType) {
      const dt = intent.documentType.toLowerCase();
      const matchDoc =
        ocrLower.includes(dt) ||
        tagsLower.includes(dt) ||
        subcatLower.includes(dt) ||
        item.screenshot.fileName.toLowerCase().includes(dt) ||
        String((item.screenshot.entities as any)?.documentType || '').toLowerCase().includes(dt);

      if (matchDoc) {
        score += 60;
        reasons.push(`Document match: ${intent.documentType}`);
      }
    }

    // PNR match (+60 points)
    if (intent.pnr) {
      if (ocrLower.includes(intent.pnr) || tagsLower.some((t) => t.includes(intent.pnr!))) {
        score += 60;
        reasons.push(`PNR match: ${intent.pnr}`);
      }
    }

    // Amount range match (+60 points)
    if (intent.minAmount !== undefined || intent.maxAmount !== undefined) {
      const parsedAmts = item.amounts.map((a) => parseFloat(a)).filter((n) => !isNaN(n));
      const inRange =
        parsedAmts.length > 0 &&
        parsedAmts.some((val) => {
          if (intent.minAmount !== undefined && val < intent.minAmount) return false;
          if (intent.maxAmount !== undefined && val > intent.maxAmount) return false;
          return true;
        });

      if (inRange) {
        score += 60;
        reasons.push('Amount in requested range');
      } else if (parsedAmts.length > 0) {
        return { ...item, score: 0, matchReasons: [] };
      }
    }

    // 2. OCR Keyword Similarity (+30 points)
    let ocrMatches = 0;
    for (const kw of intent.keywords) {
      if (ocrLower.includes(kw.toLowerCase())) {
        ocrMatches++;
      }
    }
    if (ocrMatches > 0) {
      score += Math.min(30, ocrMatches * 10);
      reasons.push(`OCR keyword matches (${ocrMatches})`);
    }

    // 3. Vision Summary Similarity (+25 points)
    let summaryMatches = 0;
    if (item.visionSummary) {
      for (const kw of intent.keywords) {
        if (summaryLower.includes(kw.toLowerCase())) {
          summaryMatches++;
        }
      }
      if (summaryMatches > 0) {
        score += Math.min(25, summaryMatches * 12);
        reasons.push(`Vision summary matches (${summaryMatches})`);
      }
    }

    // 4. Category Similarity (+15 points)
    if (intent.domain !== 'general') {
      if (catLower.includes(intent.domain) || intent.domain.includes(catLower)) {
        score += 15;
        reasons.push(`Category match: ${item.category}`);
      }
    }

    // 5. Recency (+5 to +10 points)
    if (item.date) {
      const ageDays = (Date.now() - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays <= 1) {
        score += 10;
        reasons.push('Created today/yesterday');
      } else if (ageDays <= 7) {
        score += 7;
        reasons.push('Created this week');
      } else if (ageDays <= 30) {
        score += 4;
      }
    }

    return { ...item, score, matchReasons: reasons };
  }

  private retrieveFromMemory(
    intent: ParsedQueryIntent,
    folderId?: string
  ): RetrievedScreenshotContext[] {
    let list = useScreenshotStore.getState().screenshots.filter((s) => !s.isDeleted);

    if (folderId && folderId !== 'root' && folderId !== 'all') {
      list = list.filter((s) => s.categoryId === folderId || (s as any).folderId === folderId);
    }

    const items: RetrievedScreenshotContext[] = list.map((s) => {
      const merchants: string[] = [];
      if (s.entities?.merchant) merchants.push(String(s.entities.merchant));
      if (s.subcategory) merchants.push(s.subcategory);

      const amounts: string[] = [];
      if (s.entities?.amount) amounts.push(String(s.entities.amount));
      if (s.ocrText) {
        const m = s.ocrText.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi);
        if (m) {
          m.forEach((str: string) => {
            const cleaned = str.replace(/(?:₹|rs\.?|inr|\s)/gi, '').replace(/,/g, '');
            if (cleaned) amounts.push(cleaned);
          });
        }
      }

      return {
        screenshot: s,
        ocrText: s.ocrText || '',
        visionSummary: (s as any).summary || '',
        tags: (s.keywords || []).map((k) => k.toLowerCase()),
        merchants,
        amounts,
        category: s.categoryId,
        subcategory: s.subcategory || '',
        date: s.createdAt,
        score: 0,
        matchReasons: [],
      };
    });

    const scored = items.map((item) => this.scoreCandidate(item, intent));
    const filtered = folderId ? scored : scored.filter((s) => s.score > 0);
    filtered.sort((a, b) => b.score - a.score);
    return filtered;
  }

  // ===========================================================================
  // 2. Memory Timeline Event Retrieval (Top 5)
  // ===========================================================================

  private async fetchAndRankTimelineEvents(
    query: string,
    intent: ParsedQueryIntent
  ): Promise<MemoryTimelineEvent[]> {
    try {
      const allEvents = await memoryTimelineService.getAllEvents();
      if (!allEvents || allEvents.length === 0) return [];

      const queryLower = query.toLowerCase();

      const scored = allEvents.map((evt) => {
        let score = 0;
        const text = `${evt.title} ${evt.summary} ${evt.categoryName} ${evt.merchant || ''} ${evt.tags.join(' ')}`.toLowerCase();

        // Exact merchant match
        if (intent.merchant && (evt.merchant?.toLowerCase().includes(intent.merchant.toLowerCase()) || text.includes(intent.merchant.toLowerCase()))) {
          score += 40;
        }

        // Keywords match
        for (const kw of intent.keywords) {
          if (text.includes(kw.toLowerCase())) score += 15;
        }

        // Period match
        if (queryLower.includes('today') && evt.period === 'today') score += 30;
        if (queryLower.includes('yesterday') && evt.period === 'yesterday') score += 30;
        if (queryLower.includes('week') && (evt.period === 'this_week' || evt.period === 'today' || evt.period === 'yesterday')) score += 20;

        return { evt, score };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.evt.timestamp - a.evt.timestamp;
      });

      return scored.filter((s) => s.score > 0 || queryLower.includes('timeline')).map((s) => s.evt).slice(0, 5);
    } catch {
      return [];
    }
  }

  // ===========================================================================
  // 3. Daily & Weekly Digest Retrieval (Top 3)
  // ===========================================================================

  private async fetchAndRankDigests(
    query: string,
    intent: ParsedQueryIntent
  ): Promise<DigestSummaryItem[]> {
    const digests: DigestSummaryItem[] = [];
    const queryLower = query.toLowerCase();

    try {
      // Check Today's Digest
      const today = await dailyDigestService.getTodayDigest();
      if (today && today.totalScreenshots > 0) {
        let score = 10;
        if (queryLower.includes('today') || queryLower.includes('summary')) score += 30;
        if (intent.merchant && today.topMerchant?.toLowerCase().includes(intent.merchant.toLowerCase())) score += 20;
        if (intent.domain === 'finance') score += 15;

        digests.push({
          type: 'daily',
          key: today.date,
          title: `Daily Digest (${today.dateFormatted})`,
          summary: today.summary,
          screenshotCount: today.totalScreenshots,
          spendingTotal: today.spendingTotal,
          topMerchants: today.topMerchant ? [today.topMerchant] : [],
          score,
        });
      }

      // Check This Week's Digest
      const week = await digestAggregationService.getWeeklyDigest(0);
      if (week && week.totalScreenshots > 0) {
        let score = 5;
        if (queryLower.includes('week') || queryLower.includes('weekly')) score += 35;
        if (intent.domain === 'finance') score += 15;

        digests.push({
          type: 'weekly',
          key: week.weekKey || 'current_week',
          title: `Weekly Digest (${week.periodLabel})`,
          summary: week.summary,
          screenshotCount: week.totalScreenshots,
          spendingTotal: week.spending?.totalAmount,
          topMerchants: week.shopping?.topMerchants,
          score,
        });
      }

      // Sort by score
      digests.sort((a, b) => b.score - a.score);
      return digests.slice(0, 3);
    } catch {
      return [];
    }
  }

  // ===========================================================================
  // 4. Folder Context Retrieval (Top 2)
  // ===========================================================================

  private async fetchFolderContexts(
    query: string,
    intent: ParsedQueryIntent,
    folderId?: string
  ): Promise<FolderContextSummary[]> {
    try {
      const results: FolderContextSummary[] = [];

      if (folderId && folderId !== 'root' && folderId !== 'all') {
        const fc = await folderContextRepository.getFolderContext(folderId);
        if (fc) {
          results.push({
            folderId: fc.FolderId,
            folderName: folderId,
            summary: fc.Summary,
            entities: JSON.parse(fc.EntitiesJson || '{}'),
            score: 50,
          });
        }
      }

      const allFolders = await folderContextRepository.getAllFolderContexts();
      for (const f of allFolders) {
        if (results.some((r) => r.folderId === f.FolderId)) continue;
        const sumLower = f.Summary.toLowerCase();
        let score = 0;
        for (const kw of intent.keywords) {
          if (sumLower.includes(kw.toLowerCase())) score += 10;
        }
        if (score > 0) {
          results.push({
            folderId: f.FolderId,
            folderName: f.FolderId,
            summary: f.Summary,
            entities: JSON.parse(f.EntitiesJson || '{}'),
            score,
          });
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 2);
    } catch {
      return [];
    }
  }

  // ===========================================================================
  // 5. Session Long-Term Summary Retrieval
  // ===========================================================================

  private async fetchSessionSummary(sessionId?: string): Promise<string | undefined> {
    if (!sessionId) return undefined;
    try {
      const session = await chatSessionRepository.getSession(sessionId);
      return session?.summary || undefined;
    } catch {
      return undefined;
    }
  }
}

export const contextRetrievalService = ContextRetrievalService.getInstance();

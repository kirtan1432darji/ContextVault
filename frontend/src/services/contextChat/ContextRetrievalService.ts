/**
 * ContextRetrievalService.ts
 * Offline Context Retrieval Engine for ContextVault Context Chat.
 * Searches SQLite metadata (screenshots, OCR cache, Vision cache, tags, entities)
 * and ranks candidates up to a maximum of 20 screenshots using a 5-tier scoring system.
 * Never searches Android MediaStore directly.
 */

import { databaseService } from '../../database';
import { ScreenshotModel } from '../../models';
import { useScreenshotStore } from '../../store/screenshot.store';
import { QueryIntentParser, ParsedQueryIntent } from './QueryIntentParser';

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

export class ContextRetrievalService {
  private static instance: ContextRetrievalService | null = null;

  static getInstance(): ContextRetrievalService {
    if (!ContextRetrievalService.instance) {
      ContextRetrievalService.instance = new ContextRetrievalService();
    }
    return ContextRetrievalService.instance;
  }

  /**
   * Retrieves and ranks up to 20 relevant screenshots from local SQLite metadata.
   */
  async retrieveContext(
    query: string,
    folderId?: string,
    customIntent?: ParsedQueryIntent
  ): Promise<RetrievedScreenshotContext[]> {
    const intent = customIntent || QueryIntentParser.parse(query);

    try {
      // 1. Fetch Candidate Screenshots from SQLite
      let candidates = await this.fetchCandidatesFromDatabase(intent, folderId);

      // If database returned 0 candidates, fallback to in-memory store
      if (candidates.length === 0) {
        const memoryCandidates = this.retrieveFromMemory(intent, folderId);
        if (memoryCandidates.length > 0) {
          return memoryCandidates;
        }
      }

      // 2. Score and Rank Candidates
      const scored = candidates.map((item) => this.scoreCandidate(item, intent));

      // 3. Filter out zero-score items (unless it's a general folder query)
      const filtered = folderId
        ? scored
        : scored.filter((s) => s.score > 0);

      // 4. Sort by score descending, recency as tie-breaker
      filtered.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return timeB - timeA;
      });

      // 5. Cap at 20 screenshots maximum
      return filtered.slice(0, 20);
    } catch (err) {
      console.warn('[ContextRetrievalService] SQLite query failed, falling back to in-memory store:', err);
      return this.retrieveFromMemory(intent, folderId);
    }
  }

  /**
   * Queries SQLite joins across screenshots, ocr_cache, vision_cache, classification_cache.
   */
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

    // Join with ocr_cache, vision_cache, classification_cache for maximum ground truth
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

      // Extract Merchants
      const merchants: string[] = [];
      if (entities.merchant) merchants.push(String(entities.merchant));
      if (entities.merchants && Array.isArray(entities.merchants)) {
        merchants.push(...entities.merchants);
      }
      if (row.subcategory && !merchants.includes(row.subcategory)) {
        merchants.push(row.subcategory);
      }

      // Extract Amounts
      const amounts: string[] = [];
      if (entities.amount) amounts.push(String(entities.amount));
      if (entities.amounts && Array.isArray(entities.amounts)) {
        amounts.push(...entities.amounts);
      }
      // Regex extraction from OCR text
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

  /**
   * 5-Tier Scoring Engine:
   * 1. Exact merchant/tag match (+50 points)
   * 2. OCR similarity (+30 points)
   * 3. Vision summary similarity (+25 points)
   * 4. Category similarity (+15 points)
   * 5. Recency (+5 to +10 points)
   */
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

    // 1. Exact Merchant / Tag Match (+50 points)
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

    // Document type match
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

    // PNR match
    if (intent.pnr) {
      if (ocrLower.includes(intent.pnr) || tagsLower.some((t) => t.includes(intent.pnr!))) {
        score += 60;
        reasons.push(`PNR match: ${intent.pnr}`);
      }
    }

    // Amount range match
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
        // Disqualify screenshot that strictly violates the requested amount criteria
        return {
          ...item,
          score: 0,
          matchReasons: [],
        };
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
      const ocrPoints = Math.min(30, ocrMatches * 10);
      score += ocrPoints;
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
        const sumPoints = Math.min(25, summaryMatches * 12);
        score += sumPoints;
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

    return {
      ...item,
      score,
      matchReasons: reasons,
    };
  }

  /**
   * In-Memory Fallback when SQLite database is offline or in mock test environment.
   */
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
    return filtered.slice(0, 20);
  }
}

export const contextRetrievalService = ContextRetrievalService.getInstance();

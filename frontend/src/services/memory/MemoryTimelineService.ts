import { databaseService } from '../../database/database';
import { useScreenshotStore } from '../../store/screenshot.store';
import { loggerService } from '../loggerService';
import {
  MemoryTimelineEvent,
  TimelineGrouping,
  TimelinePeriod,
  MemoryDiagnosticsStats,
} from './types';

const KNOWN_MERCHANT_NAMES: Record<string, string> = {
  phonepe: 'PhonePe',
  'phone pe': 'PhonePe',
  gpay: 'Google Pay',
  'google pay': 'Google Pay',
  paytm: 'Paytm',
  swiggy: 'Swiggy',
  zomato: 'Zomato',
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  myntra: 'Myntra',
  meesho: 'Meesho',
  uber: 'Uber',
  ola: 'Ola',
  irctc: 'IRCTC',
  makemytrip: 'MakeMyTrip',
  mmt: 'MakeMyTrip',
  bookmyshow: 'BookMyShow',
  bms: 'BookMyShow',
  zepto: 'Zepto',
  blinkit: 'Blinkit',
  instamart: 'Instamart',
  bigbasket: 'BigBasket',
  sbi: 'SBI',
  hdfc: 'HDFC',
  icici: 'ICICI',
  axis: 'Axis Bank',
  cred: 'Cred',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  netflix: 'Netflix',
  spotify: 'Spotify',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class MemoryTimelineService {
  private cachedGrouping: TimelineGrouping | null = null;
  private cachedEvents: MemoryTimelineEvent[] | null = null;
  private lastRebuiltAt: string | null = null;

  /**
   * Generates or retrieves the complete chronological timeline grouping.
   */
  async getTimeline(options?: {
    forceRefresh?: boolean;
    categoryId?: string;
  }): Promise<TimelineGrouping> {
    if (!options?.forceRefresh && this.cachedGrouping && !options?.categoryId) {
      return this.cachedGrouping;
    }

    const events = await this.getAllEvents(options?.forceRefresh);
    const filtered = options?.categoryId && options.categoryId !== 'all'
      ? events.filter((e) => e.category === options.categoryId)
      : events;

    const grouping = this.groupEvents(filtered);

    if (!options?.categoryId) {
      this.cachedGrouping = grouping;
    }

    return grouping;
  }

  /**
   * Retrieves all chronological timeline events sorted from newest to oldest.
   */
  async getAllEvents(forceRefresh = false): Promise<MemoryTimelineEvent[]> {
    if (!forceRefresh && this.cachedEvents) {
      return this.cachedEvents;
    }

    let events: MemoryTimelineEvent[] = [];

    try {
      // 1. Fetch from SQLite joining screenshots with classification_cache and vision_cache
      const sql = `
        SELECT 
          s.id,
          s.file_name,
          s.file_path,
          s.local_path,
          s.content_uri,
          s.thumbnail_uri,
          s.created_at,
          s.created_on,
          s.category_id,
          s.category_name,
          s.subcategory,
          s.source_app,
          s.detected_app,
          s.keywords_json,
          s.ocr_text,
          c.summary AS class_summary,
          c.entities_json AS class_entities,
          v.summary AS vision_summary,
          v.application_name AS vision_app,
          v.detected_entities AS vision_entities
        FROM screenshots s
        LEFT JOIN classification_cache c ON c.screenshot_id = s.id
        LEFT JOIN vision_cache v ON v.screenshot_id = s.id
        WHERE (s.is_deleted = 0 OR s.is_deleted IS NULL)
        ORDER BY s.created_at DESC
      `;

      const rows = await databaseService.executeQuery(sql);

      if (rows && rows.length > 0) {
        events = rows.map((r) => this.mapRowToTimelineEvent(r));
      }
    } catch (err) {
      loggerService.warn('Memory', 'SQLite query failed, falling back to in-memory store', err);
    }

    // 2. In-memory fallback if SQLite returned empty
    if (events.length === 0) {
      const storeScreenshots = useScreenshotStore.getState().screenshots.filter((s) => !s.isDeleted);
      events = storeScreenshots.map((s) => this.mapScreenshotModelToEvent(s));
    }

    // Sort descending by timestamp
    events.sort((a, b) => b.timestamp - a.timestamp);

    this.cachedEvents = events;
    this.lastRebuiltAt = new Date().toISOString();

    return events;
  }

  /**
   * Retrieves timeline events for a specific date (YYYY-MM-DD).
   */
  async getEventsForDate(dateStr: string): Promise<MemoryTimelineEvent[]> {
    const all = await this.getAllEvents();
    return all.filter((e) => e.date === dateStr);
  }

  /**
   * Retrieves timeline events within an inclusive date range.
   */
  async getEventsForDateRange(fromDate: string, toDate: string): Promise<MemoryTimelineEvent[]> {
    const all = await this.getAllEvents();
    const fromTime = new Date(fromDate.includes('T') ? fromDate : `${fromDate}T00:00:00.000Z`).getTime();
    const toTime = new Date(toDate.includes('T') ? toDate : `${toDate}T23:59:59.999Z`).getTime();

    return all.filter((e) => e.timestamp >= fromTime && e.timestamp <= toTime);
  }

  /**
   * Adds or updates a single screenshot in the in-memory timeline and invalidates caches.
   */
  async addScreenshotToTimeline(screenshot: any): Promise<void> {
    if (!screenshot || !screenshot.id) return;
    const event = this.mapScreenshotModelToEvent(screenshot);

    if (!this.cachedEvents) {
      await this.getAllEvents();
    }

    if (this.cachedEvents) {
      const existingIndex = this.cachedEvents.findIndex(
        (e) => e.screenshotId === event.screenshotId || e.id === event.id
      );
      if (existingIndex >= 0) {
        this.cachedEvents[existingIndex] = event;
      } else {
        this.cachedEvents.unshift(event);
      }
      this.cachedEvents.sort((a, b) => b.timestamp - a.timestamp);
      this.cachedGrouping = this.groupEvents(this.cachedEvents);
    }

    try {
      const { dailyDigestService } = require('./DailyDigestService');
      if (dailyDigestService && typeof dailyDigestService.getTodayDigest === 'function') {
        await dailyDigestService.getTodayDigest(true);
      }
    } catch {}
  }

  /**
   * Rebuilds the entire memory timeline from fresh SQLite data.
   */
  async rebuildTimeline(): Promise<TimelineGrouping> {
    this.cachedGrouping = null;
    this.cachedEvents = null;
    loggerService.info('Memory', 'Rebuilding AI Memory Timeline from SQLite metadata...');
    return this.getTimeline({ forceRefresh: true });
  }

  /**
   * Returns telemetry diagnostic stats for the Memory Timeline.
   */
  async getDiagnostics(): Promise<MemoryDiagnosticsStats> {
    const events = await this.getAllEvents();
    let cachedSummariesCount = 0;

    try {
      const rows = await databaseService.executeQuery(
        `SELECT COUNT(*) as cnt FROM (
          SELECT id FROM classification_cache WHERE summary IS NOT NULL AND length(summary) > 0
          UNION
          SELECT id FROM vision_cache WHERE summary IS NOT NULL AND length(summary) > 0
        )`
      );
      cachedSummariesCount = rows[0]?.cnt || 0;
    } catch {
      cachedSummariesCount = events.filter((e) => e.summary && !e.summary.startsWith('Screenshot')).length;
    }

    // Calculate unique months and weeks
    const grouping = this.groupEvents(events);
    const monthsCount = Object.keys(grouping.monthly).length;
    const weeksCount = grouping.last7Days.length > 0 ? 1 : 0;
    const dailyCount = (grouping.today.length > 0 ? 1 : 0) + (grouping.yesterday.length > 0 ? 1 : 0);

    return {
      totalTimelineEvents: events.length,
      dailyDigestsGenerated: dailyCount,
      weeklySummariesCount: weeksCount,
      monthlySummariesCount: monthsCount,
      cachedSummariesCount,
      lastRebuiltAt: this.lastRebuiltAt,
    };
  }

  // --- Grouping & Mapping Helpers ---

  private groupEvents(events: MemoryTimelineEvent[]): TimelineGrouping {
    const now = new Date();
    const todayStr = this.formatDateOnly(now);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = this.formatDateOnly(yesterday);

    const sevenDaysAgoTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const today: MemoryTimelineEvent[] = [];
    const yesterdayList: MemoryTimelineEvent[] = [];
    const last7Days: MemoryTimelineEvent[] = [];
    const last30Days: MemoryTimelineEvent[] = [];
    const monthly: Record<string, MemoryTimelineEvent[]> = {};
    const yearly: Record<string, MemoryTimelineEvent[]> = {};

    for (const event of events) {
      const d = new Date(event.timestamp);
      const monthKey = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const yearKey = `${d.getFullYear()}`;

      // Monthly bucket
      if (!monthly[monthKey]) monthly[monthKey] = [];
      monthly[monthKey].push(event);

      // Yearly bucket
      if (!yearly[yearKey]) yearly[yearKey] = [];
      yearly[yearKey].push(event);

      // Relative buckets
      if (event.date === todayStr) {
        event.period = 'today';
        event.periodGroup = 'Today';
        today.push(event);
      } else if (event.date === yesterdayStr) {
        event.period = 'yesterday';
        event.periodGroup = 'Yesterday';
        yesterdayList.push(event);
      } else if (event.timestamp >= sevenDaysAgoTime) {
        event.period = 'last_7_days';
        event.periodGroup = 'This Week';
        last7Days.push(event);
      } else if (event.timestamp >= thirtyDaysAgoTime) {
        event.period = 'last_30_days';
        event.periodGroup = 'Last 30 Days';
        last30Days.push(event);
      } else {
        event.period = 'monthly';
        event.periodGroup = monthKey;
      }
    }

    return {
      today,
      yesterday: yesterdayList,
      last7Days,
      last30Days,
      monthly,
      yearly,
      allEvents: events,
      totalCount: events.length,
    };
  }

  private mapRowToTimelineEvent(row: any): MemoryTimelineEvent {
    const rawDate = row.created_at || row.created_on || new Date().toISOString();
    const parsedDate = new Date(rawDate);
    const dateStr = this.formatDateOnly(parsedDate);
    const timeStr = this.formatTimeOnly(parsedDate);
    const timestamp = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Date.now();

    // Parse entities
    let entities: Record<string, any> = {};
    try {
      if (row.class_entities) {
        entities = { ...entities, ...JSON.parse(row.class_entities) };
      }
      if (row.vision_entities) {
        entities = { ...entities, ...JSON.parse(row.vision_entities) };
      }
    } catch {}

    // Extract tags
    let tags: string[] = [];
    try {
      if (row.keywords_json) {
        tags = JSON.parse(row.keywords_json);
      }
    } catch {}

    const merchant = this.extractMerchant(
      entities.merchant || row.subcategory || row.vision_app || row.detected_app || row.source_app,
      row.ocr_text
    );

    const amount = this.extractAmount(entities.amount, tags, row.ocr_text);
    const category = row.category_id || 'other';
    const categoryName = row.category_name || 'General';

    // Summary logic: cached vision/classification > generated offline summary
    const rawSummary = row.class_summary || row.vision_summary;
    const summary = rawSummary && rawSummary.trim().length > 0
      ? rawSummary.trim()
      : this.buildOfflineSummary({ category, categoryName, merchant, amount, ocrText: row.ocr_text, fileName: row.file_name });

    const title = this.buildTitle({ category, categoryName, merchant, amount, summary, fileName: row.file_name });

    return {
      id: `evt_${row.id}`,
      screenshotId: row.id,
      screenshotIds: [row.id],
      date: dateStr,
      timestamp,
      timeStr,
      category,
      categoryName,
      title,
      summary,
      merchant,
      amount,
      currency: amount ? '₹' : undefined,
      screenshotCount: 1,
      thumbnailUri: row.thumbnail_uri || undefined,
      filePath: row.local_path || row.file_path,
      contentUri: row.content_uri || undefined,
      period: 'today',
      periodGroup: 'Today',
      tags,
      sourceApp: row.source_app || undefined,
      detectedApp: row.detected_app || undefined,
    };
  }

  private mapScreenshotModelToEvent(s: any): MemoryTimelineEvent {
    const rawDate = s.createdAt || s.createdOn || new Date().toISOString();
    const parsedDate = new Date(rawDate);
    const dateStr = this.formatDateOnly(parsedDate);
    const timeStr = this.formatTimeOnly(parsedDate);
    const timestamp = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Date.now();

    const tags = (s.keywords || []).concat((s.tags || []).map((t: any) => t.name || t));
    const merchant = this.extractMerchant(s.entities?.merchant || s.subcategory || s.detectedApp || s.sourceApp, s.ocrText);
    const amount = this.extractAmount(s.entities?.amount, tags, s.ocrText);
    const category = s.categoryId || 'other';
    const categoryName = s.categoryName || 'General';

    const rawSummary = s.summary;
    const summary = rawSummary && rawSummary.trim().length > 0
      ? rawSummary.trim()
      : this.buildOfflineSummary({ category, categoryName, merchant, amount, ocrText: s.ocrText, fileName: s.fileName });

    const title = this.buildTitle({ category, categoryName, merchant, amount, summary, fileName: s.fileName });

    return {
      id: `evt_${s.id}`,
      screenshotId: s.id,
      screenshotIds: [s.id],
      date: dateStr,
      timestamp,
      timeStr,
      category,
      categoryName,
      title,
      summary,
      merchant,
      amount,
      currency: amount ? '₹' : undefined,
      screenshotCount: 1,
      thumbnailUri: s.thumbnailUri,
      filePath: s.localPath || s.filePath,
      contentUri: s.contentUri,
      period: 'today',
      periodGroup: 'Today',
      tags,
      sourceApp: s.sourceApp,
      detectedApp: s.detectedApp,
    };
  }

  // --- Entity Extraction Helpers ---

  private extractMerchant(rawMerchant?: string, ocrText?: string): string | undefined {
    if (rawMerchant && rawMerchant !== 'General' && rawMerchant !== 'Unknown' && rawMerchant.trim().length > 0) {
      const lower = rawMerchant.toLowerCase();
      for (const [key, cleanName] of Object.entries(KNOWN_MERCHANT_NAMES)) {
        if (lower.includes(key)) return cleanName;
      }
      return rawMerchant.trim();
    }

    if (ocrText) {
      const lowerOcr = ocrText.toLowerCase();
      for (const [key, cleanName] of Object.entries(KNOWN_MERCHANT_NAMES)) {
        if (new RegExp(`\\b${key}\\b`, 'i').test(lowerOcr)) {
          return cleanName;
        }
      }
    }

    return undefined;
  }

  private extractAmount(entityAmount?: any, tags: string[] = [], ocrText?: string): number | undefined {
    if (entityAmount) {
      const num = parseFloat(String(entityAmount).replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) return num;
    }

    // Check tags
    for (const tag of tags) {
      if (typeof tag === 'string' && (tag.startsWith('₹') || tag.startsWith('amt_'))) {
        const num = parseFloat(tag.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) return num;
      }
    }

    // Regex check OCR
    if (ocrText) {
      const match = ocrText.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (match) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0) return num;
      }
    }

    return undefined;
  }

  private buildOfflineSummary(params: {
    category: string;
    categoryName: string;
    merchant?: string;
    amount?: number;
    ocrText?: string;
    fileName: string;
  }): string {
    const { category, merchant, amount, ocrText, fileName } = params;
    const catLower = category.toLowerCase();

    if (amount && merchant) {
      return `Payment of ₹${amount.toLocaleString('en-IN')} to ${merchant}`;
    }

    if (catLower.includes('finance') || catLower.includes('bills')) {
      if (amount) return `Transaction of ₹${amount.toLocaleString('en-IN')}`;
      if (merchant) return `Financial transaction with ${merchant}`;
      return 'Payment receipt / transaction confirmation';
    }

    if (catLower.includes('food') || catLower.includes('dining')) {
      if (merchant) return `Food order from ${merchant}`;
      return 'Food delivery order or restaurant receipt';
    }

    if (catLower.includes('shopping') || catLower.includes('orders')) {
      if (merchant) return `Shopping purchase from ${merchant}`;
      return 'E-commerce shopping order confirmation';
    }

    if (catLower.includes('travel') || catLower.includes('transit')) {
      if (merchant) return `Travel booking via ${merchant}`;
      return 'Travel ticket / itinerary confirmation';
    }

    if (catLower.includes('social') || catLower.includes('chat')) {
      if (merchant) return `Chat conversation on ${merchant}`;
      return 'Messaging conversation screenshot';
    }

    if (catLower.includes('docs') || catLower.includes('document')) {
      return 'Saved document / identification certificate';
    }

    if (ocrText && ocrText.length > 20) {
      return ocrText.slice(0, 80).replace(/\s+/g, ' ').trim() + '...';
    }

    return `Saved image: ${fileName}`;
  }

  private buildTitle(params: {
    category: string;
    categoryName: string;
    merchant?: string;
    amount?: number;
    summary: string;
    fileName: string;
  }): string {
    const { category, categoryName, merchant, amount } = params;
    const catLower = category.toLowerCase();

    if (merchant && amount) {
      return `${merchant} — ₹${amount.toLocaleString('en-IN')}`;
    }

    if (merchant) {
      if (catLower.includes('food')) return `${merchant} Order`;
      if (catLower.includes('shopping')) return `${merchant} Purchase`;
      if (catLower.includes('travel')) return `${merchant} Trip`;
      if (catLower.includes('chat')) return `${merchant} Chat`;
      return `${merchant} ${categoryName}`;
    }

    if (amount) {
      return `${categoryName} — ₹${amount.toLocaleString('en-IN')}`;
    }

    return categoryName || params.fileName;
  }

  private formatDateOnly(date: Date): string {
    try {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  private formatTimeOnly(date: Date): string {
    try {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '12:00';
    }
  }
}

export const memoryTimelineService = new MemoryTimelineService();

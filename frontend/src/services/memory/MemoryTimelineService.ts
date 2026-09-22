import { databaseService } from '../../database/database';
import { memoryTimelineRepository } from '../../database/repositories/MemoryTimelineRepository';
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
   * Adaptive Merge Window rules (in milliseconds):
   * - Payment / Banking → 5 minutes (300,000 ms)
   * - WhatsApp / Chats → 10 minutes (600,000 ms)
   * - Shopping checkout flow → 8 minutes (480,000 ms)
   * - Travel booking flow → 15 minutes (900,000 ms)
   * - Different categories → never merge (0 ms)
   * - Other / Default → 5 minutes (300,000 ms)
   */
  public getMergeWindowMs(category: string): number {
    const cat = (category || '').toLowerCase();
    if (
      cat.includes('finance') ||
      cat.includes('bank') ||
      cat.includes('bill') ||
      cat.includes('payment') ||
      cat.includes('upi')
    ) {
      return 5 * 60 * 1000;
    }
    if (
      cat.includes('chat') ||
      cat.includes('whatsapp') ||
      cat.includes('message') ||
      cat.includes('social') ||
      cat.includes('comm')
    ) {
      return 10 * 60 * 1000;
    }
    if (
      cat.includes('shop') ||
      cat.includes('order') ||
      cat.includes('food') ||
      cat.includes('dining') ||
      cat.includes('ecom')
    ) {
      return 8 * 60 * 1000;
    }
    if (
      cat.includes('travel') ||
      cat.includes('transit') ||
      cat.includes('ticket') ||
      cat.includes('flight') ||
      cat.includes('hotel')
    ) {
      return 15 * 60 * 1000;
    }
    return 5 * 60 * 1000;
  }

  public getEventType(category: string): string {
    const cat = (category || '').toLowerCase();
    if (cat.includes('finance') || cat.includes('bank') || cat.includes('payment') || cat.includes('upi')) {
      return 'payment';
    }
    if (cat.includes('chat') || cat.includes('whatsapp') || cat.includes('social') || cat.includes('message')) {
      return 'chat';
    }
    if (cat.includes('shop') || cat.includes('order') || cat.includes('food') || cat.includes('dining')) {
      return 'shopping';
    }
    if (cat.includes('travel') || cat.includes('transit') || cat.includes('flight')) {
      return 'travel';
    }
    return 'general';
  }

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
   * Retrieves timeline events for a specific period: 'today' | 'yesterday' | 'this_week' | 'earlier_this_month' | 'older'.
   */
  async getTimelineSection(period: TimelinePeriod): Promise<MemoryTimelineEvent[]> {
    const grouping = await this.getTimeline();
    switch (period) {
      case 'today':
        return grouping.today;
      case 'yesterday':
        return grouping.yesterday;
      case 'this_week':
      case 'last_7_days':
        return grouping.thisWeek || grouping.last7Days;
      case 'earlier_this_month':
      case 'last_30_days':
        return grouping.earlierThisMonth || grouping.last30Days;
      case 'older':
      case 'monthly':
      case 'yearly':
        return grouping.older || [];
      default:
        return grouping.allEvents;
    }
  }

  /**
   * Retrieves all chronological timeline events sorted from newest to oldest.
   */
  async getAllEvents(forceRefresh = false): Promise<MemoryTimelineEvent[]> {
    if (!forceRefresh && this.cachedEvents) {
      return this.cachedEvents;
    }

    let rawEvents: MemoryTimelineEvent[] = [];

    try {
      // 1. Fetch raw screenshots joining classification_cache and vision_cache
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
        rawEvents = rows.map((r) => this.mapRowToTimelineEvent(r));
      }
    } catch (err) {
      loggerService.warn('Memory', 'SQLite query failed, falling back to in-memory store', err);
    }

    // 2. In-memory fallback if SQLite returned empty
    if (rawEvents.length === 0) {
      const storeScreenshots = useScreenshotStore.getState().screenshots.filter((s) => !s.isDeleted);
      rawEvents = storeScreenshots.map((s) => this.mapScreenshotModelToEvent(s));
    }

    // Sort descending by timestamp
    rawEvents.sort((a, b) => b.timestamp - a.timestamp);

    // 3. Apply Adaptive Merge Rules across raw events
    const mergedEvents = this.mergeProximateEvents(rawEvents);

    this.cachedEvents = mergedEvents;
    this.lastRebuiltAt = new Date().toISOString();

    return mergedEvents;
  }

  /**
   * Merges proximate screenshots based on category-specific adaptive windows:
   * Payment (5m), Chats (10m), Shopping (8m), Travel (15m). Different categories never merge.
   */
  private mergeProximateEvents(events: MemoryTimelineEvent[]): MemoryTimelineEvent[] {
    if (events.length <= 1) return events;

    const merged: MemoryTimelineEvent[] = [];
    const seenScreenshotIds = new Set<string>();

    for (const evt of events) {
      // Deduplicate screenshot IDs
      if (seenScreenshotIds.has(evt.screenshotId)) {
        continue;
      }
      seenScreenshotIds.add(evt.screenshotId);

      // Check if this event can merge into the previous event
      if (merged.length > 0) {
        const last = merged[merged.length - 1];
        const isSameCategory = last.category === evt.category;
        const mergeWindow = this.getMergeWindowMs(last.category);
        const timeDiff = Math.abs(last.timestamp - evt.timestamp);

        if (isSameCategory && timeDiff <= mergeWindow) {
          // Merge evt into last
          if (!last.screenshotIds.includes(evt.screenshotId)) {
            last.screenshotIds.push(evt.screenshotId);
          }
          last.screenshotCount = last.screenshotIds.length;
          // Combine tags
          for (const t of evt.tags) {
            if (!last.tags.includes(t)) last.tags.push(t);
          }
          // Aggregate amounts if both have amounts in finance
          if (evt.amount && last.amount) {
            last.amount = Math.round((last.amount + evt.amount) * 100) / 100;
          } else if (evt.amount && !last.amount) {
            last.amount = evt.amount;
          }
          continue;
        }
      }

      // Clone and push as a new event
      merged.push({
        ...evt,
        screenshotIds: [...evt.screenshotIds],
        tags: [...evt.tags],
      });
    }

    return merged;
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
   * Adds or updates a single screenshot in the timeline, applying adaptive merge windows,
   * persisting to SQLite memory_timeline table, and invalidating caches.
   */
  async addScreenshotToTimeline(screenshot: any): Promise<void> {
    if (!screenshot || !screenshot.id) return;
    const event = this.mapScreenshotModelToEvent(screenshot);

    if (!this.cachedEvents) {
      await this.getAllEvents();
    }

    const mergeWindow = this.getMergeWindowMs(event.category);
    let merged = false;

    if (this.cachedEvents) {
      // Check if proximate event on the same date matches category
      for (const existing of this.cachedEvents) {
        if (
          existing.category === event.category &&
          existing.date === event.date &&
          Math.abs(existing.timestamp - event.timestamp) <= mergeWindow
        ) {
          if (!existing.screenshotIds.includes(event.screenshotId)) {
            existing.screenshotIds.push(event.screenshotId);
          }
          existing.screenshotCount = existing.screenshotIds.length;
          for (const t of event.tags) {
            if (!existing.tags.includes(t)) existing.tags.push(t);
          }
          if (event.amount && existing.amount) {
            existing.amount = Math.round((existing.amount + event.amount) * 100) / 100;
          } else if (event.amount && !existing.amount) {
            existing.amount = event.amount;
          }

          // Persist merged record into SQLite
          try {
            await memoryTimelineRepository.upsertEvent({
              id: existing.id,
              eventDate: existing.date,
              eventPeriod: existing.period as any,
              eventType: this.getEventType(existing.category),
              summary: existing.summary,
              screenshotIds: existing.screenshotIds,
              createdAt: new Date(existing.timestamp).toISOString(),
            });
          } catch {}

          merged = true;
          break;
        }
      }

      if (!merged) {
        const existingIdx = this.cachedEvents.findIndex(
          (e) => e.screenshotId === event.screenshotId || e.id === event.id
        );
        if (existingIdx >= 0) {
          this.cachedEvents[existingIdx] = event;
        } else {
          this.cachedEvents.unshift(event);
        }

        // Persist new record into SQLite
        try {
          await memoryTimelineRepository.upsertEvent({
            id: event.id,
            eventDate: event.date,
            eventPeriod: event.period as any,
            eventType: this.getEventType(event.category),
            summary: event.summary,
            screenshotIds: event.screenshotIds,
            createdAt: new Date(event.timestamp).toISOString(),
          });
        } catch {}
      }

      this.cachedEvents.sort((a, b) => b.timestamp - a.timestamp);
      this.cachedGrouping = this.groupEvents(this.cachedEvents);
    }
  }

  /**
   * Rebuilds the entire memory timeline from fresh SQLite metadata.
   */
  async rebuildTimeline(): Promise<TimelineGrouping> {
    this.cachedGrouping = null;
    this.cachedEvents = null;
    loggerService.info('Memory', 'Rebuilding AI Memory Timeline from SQLite metadata...');

    const events = await this.getAllEvents(true);

    // Repopulate memory_timeline table
    try {
      await memoryTimelineRepository.clearAll();
      for (const evt of events) {
        await memoryTimelineRepository.upsertEvent({
          id: evt.id,
          eventDate: evt.date,
          eventPeriod: evt.period as any,
          eventType: this.getEventType(evt.category),
          summary: evt.summary,
          screenshotIds: evt.screenshotIds,
          createdAt: new Date(evt.timestamp).toISOString(),
        });
      }
    } catch (err) {
      loggerService.warn('Memory', 'Error caching timeline to SQLite', err);
    }

    return this.groupEvents(events);
  }

  /**
   * Refreshes in-memory timeline from SQLite.
   */
  async refreshTimeline(): Promise<TimelineGrouping> {
    return this.getTimeline({ forceRefresh: true });
  }

  /**
   * Clears in-memory caches and SQLite timeline table.
   */
  async clearAll(): Promise<void> {
    this.cachedEvents = null;
    this.cachedGrouping = null;
    try {
      await memoryTimelineRepository.clearAll();
    } catch {}
  }

  /**
   * Deletes a timeline event by ID.
   */
  async deleteTimelineEvent(id: string): Promise<void> {
    try {
      await memoryTimelineRepository.deleteEvent(id);
    } catch {}
    if (this.cachedEvents) {
      this.cachedEvents = this.cachedEvents.filter((e) => e.id !== id);
      this.cachedGrouping = this.groupEvents(this.cachedEvents);
    }
  }

  /**
   * Removes a screenshot from all timeline events.
   */
  async removeScreenshot(screenshotId: string): Promise<void> {
    try {
      await memoryTimelineRepository.deleteByScreenshotId(screenshotId);
    } catch {}
    if (this.cachedEvents) {
      this.cachedEvents = this.cachedEvents.filter((e) => {
        if (e.screenshotId === screenshotId) return false;
        e.screenshotIds = e.screenshotIds.filter((id) => id !== screenshotId);
        e.screenshotCount = e.screenshotIds.length;
        return e.screenshotIds.length > 0;
      });
      this.cachedGrouping = this.groupEvents(this.cachedEvents);
    }
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

  public groupEvents(events: MemoryTimelineEvent[]): TimelineGrouping {
    const now = new Date();
    const todayStr = this.formatDateOnly(now);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = this.formatDateOnly(yesterday);

    const sevenDaysAgoTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const today: MemoryTimelineEvent[] = [];
    const yesterdayList: MemoryTimelineEvent[] = [];
    const thisWeekList: MemoryTimelineEvent[] = [];
    const earlierThisMonthList: MemoryTimelineEvent[] = [];
    const olderList: MemoryTimelineEvent[] = [];

    const last7Days: MemoryTimelineEvent[] = [];
    const last30Days: MemoryTimelineEvent[] = [];
    const monthly: Record<string, MemoryTimelineEvent[]> = {};
    const yearly: Record<string, MemoryTimelineEvent[]> = {};

    for (const event of events) {
      const d = new Date(event.timestamp);
      const monthKey = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const yearKey = `${d.getFullYear()}`;

      // Monthly & yearly buckets
      if (!monthly[monthKey]) monthly[monthKey] = [];
      monthly[monthKey].push(event);

      if (!yearly[yearKey]) yearly[yearKey] = [];
      yearly[yearKey].push(event);

      // Relative buckets for Sprint P3-A Timeline Groups:
      // Today, Yesterday, This Week, Earlier This Month, Older
      if (event.date === todayStr) {
        event.period = 'today';
        event.periodGroup = 'Today';
        today.push(event);
      } else if (event.date === yesterdayStr) {
        event.period = 'yesterday';
        event.periodGroup = 'Yesterday';
        yesterdayList.push(event);
      } else if (event.timestamp >= sevenDaysAgoTime) {
        event.period = 'this_week';
        event.periodGroup = 'This Week';
        thisWeekList.push(event);
      } else if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        event.period = 'earlier_this_month';
        event.periodGroup = 'Earlier This Month';
        earlierThisMonthList.push(event);
      } else {
        event.period = 'older';
        event.periodGroup = 'Older';
        olderList.push(event);
      }

      // Backward compatibility buckets (past week excluding today & yesterday)
      if (event.timestamp >= sevenDaysAgoTime && event.date !== todayStr && event.date !== yesterdayStr) {
        last7Days.push(event);
      }
      if (event.timestamp >= thirtyDaysAgoTime) {
        last30Days.push(event);
      }
    }

    return {
      today,
      yesterday: yesterdayList,
      thisWeek: thisWeekList,
      earlierThisMonth: earlierThisMonthList,
      older: olderList,
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

    for (const tag of tags) {
      if (typeof tag === 'string' && (tag.startsWith('₹') || tag.startsWith('amt_'))) {
        const num = parseFloat(tag.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) return num;
      }
    }

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

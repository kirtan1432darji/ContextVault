import { memoryTimelineService } from './MemoryTimelineService';
import { digestRepository } from '../../database/repositories/DigestRepository';
import { DailyDigest, MemoryTimelineEvent } from './types';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class DailyDigestService {
  private digestCache: Map<string, DailyDigest> = new Map();

  /**
   * Generates or retrieves the Daily Digest for "Today in ContextVault".
   */
  async getTodayDigest(forceRefresh = false): Promise<DailyDigest> {
    const todayStr = this.getTodayDateString();
    return this.getDigestForDate(todayStr, forceRefresh);
  }

  /**
   * Generates or retrieves the Daily Digest for any specified date (YYYY-MM-DD).
   * Checks in-memory cache -> SQLite daily_digest table -> synthesizes from Vision metadata.
   */
  async getDigestForDate(dateStr: string, forceRefresh = false): Promise<DailyDigest> {
    if (!forceRefresh && this.digestCache.has(dateStr)) {
      return this.digestCache.get(dateStr)!;
    }

    // Try reading from SQLite table if not forcing refresh
    if (!forceRefresh) {
      try {
        const stored = await digestRepository.getDailyDigest(dateStr);
        if (stored) {
          const events = await memoryTimelineService.getEventsForDate(dateStr);
          const digest = this.synthesizeDigest(dateStr, events);
          // Hydrate summary if stored has custom text
          if (stored.aiSummary) digest.summary = stored.aiSummary;
          this.digestCache.set(dateStr, digest);
          return digest;
        }
      } catch {}
    }

    const events = await memoryTimelineService.getEventsForDate(dateStr);
    const digest = this.synthesizeDigest(dateStr, events);

    // Persist to SQLite daily_digest table
    try {
      const merchantSummary = {
        topMerchant: digest.topMerchant,
        payments: digest.payments.merchants,
        orders: digest.orders.merchants,
      };
      const categorySummary = {
        topCategory: digest.topCategory,
        paymentsCount: digest.payments.count,
        ordersCount: digest.orders.count,
        travelCount: digest.travel.count,
        chatsCount: digest.chats.count,
        documentsCount: digest.documents.count,
      };

      await digestRepository.upsertDailyDigest({
        digestDate: dateStr,
        screenshotCount: digest.totalScreenshots,
        spendingTotal: digest.spendingTotal,
        merchantSummaryJson: JSON.stringify(merchantSummary),
        categorySummaryJson: JSON.stringify(categorySummary),
        aiSummary: digest.summary,
        createdAt: new Date().toISOString(),
      });
    } catch {}

    this.digestCache.set(dateStr, digest);
    return digest;
  }

  /**
   * Updates or re-synthesizes the daily digest for a specific date (or today),
   * updating both in-memory cache and SQLite daily_digest table.
   */
  async updateDailyDigest(dateStr?: string): Promise<DailyDigest> {
    const targetDate = dateStr
      ? (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr)
      : this.getTodayDateString();
    return this.getDigestForDate(targetDate, true);
  }

  /**
   * Alias for updateDailyDigest.
   */
  async updateDigest(dateStr?: string): Promise<DailyDigest> {
    return this.updateDailyDigest(dateStr);
  }

  /**
   * Retrieves the daily digests for the past N days.
   */
  async getRecentDailyDigests(days = 7): Promise<DailyDigest[]> {
    const digests: DailyDigest[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = this.formatDateString(targetDate);
      const digest = await this.getDigestForDate(dateStr);
      if (digest.totalScreenshots > 0 || i === 0) {
        digests.push(digest);
      }
    }

    return digests;
  }

  /**
   * Synthesizes categorized activity and creates a concise natural summary with highlights.
   */
  private synthesizeDigest(dateStr: string, events: MemoryTimelineEvent[]): DailyDigest {
    let parsedDate: Date;
    try {
      parsedDate = new Date(dateStr + 'T00:00:00');
      if (isNaN(parsedDate.getTime())) parsedDate = new Date();
    } catch {
      parsedDate = new Date();
    }

    const dayName = DAYS_OF_WEEK[parsedDate.getDay()] || '';
    const monthName = MONTHS_SHORT[parsedDate.getMonth()] || '';
    const dayNum = parsedDate.getDate();
    const year = parsedDate.getFullYear();
    const dateFormatted = `${dayName}, ${monthName} ${dayNum}, ${year}`;

    const payments: MemoryTimelineEvent[] = [];
    const orders: MemoryTimelineEvent[] = [];
    const travel: MemoryTimelineEvent[] = [];
    const chats: MemoryTimelineEvent[] = [];
    const documents: MemoryTimelineEvent[] = [];
    const entertainment: MemoryTimelineEvent[] = [];
    const health: MemoryTimelineEvent[] = [];
    const highlights: string[] = [];

    let totalSpending = 0;
    const paymentMerchants = new Set<string>();
    const orderMerchants = new Set<string>();
    const travelBookings = new Set<string>();
    const chatApps = new Set<string>();
    const docTypes = new Set<string>();
    const entTitles = new Set<string>();

    const merchantFreq: Record<string, number> = {};
    const merchantSpend: Record<string, number> = {};
    const categoryFreq: Record<string, number> = {};
    const appFreq: Record<string, number> = {};

    let totalScreenshots = 0;

    for (const evt of events) {
      totalScreenshots += evt.screenshotCount || 1;
      const cat = evt.category.toLowerCase();
      const titleLower = evt.title.toLowerCase();
      const tags = evt.tags.map((t) => t.toLowerCase());

      // Track category frequency
      const catName = evt.categoryName || evt.category;
      categoryFreq[catName] = (categoryFreq[catName] || 0) + (evt.screenshotCount || 1);

      // Track merchant stats
      if (evt.merchant) {
        merchantFreq[evt.merchant] = (merchantFreq[evt.merchant] || 0) + 1;
        if (evt.amount) {
          merchantSpend[evt.merchant] = (merchantSpend[evt.merchant] || 0) + evt.amount;
        }
      }

      // Track app frequency
      const app = evt.sourceApp || evt.detectedApp || evt.merchant;
      if (app) {
        appFreq[app] = (appFreq[app] || 0) + 1;
      }

      if (evt.amount && evt.amount > 0) {
        totalSpending += evt.amount;
      }

      const isOrder =
        cat.includes('food') ||
        cat.includes('dining') ||
        cat.includes('shopping') ||
        cat.includes('orders') ||
        ['Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Blinkit', 'Zepto'].includes(evt.merchant || '');

      const isTravel =
        cat.includes('travel') ||
        cat.includes('transit') ||
        tags.includes('ticket') ||
        tags.includes('flight') ||
        ['IRCTC', 'MakeMyTrip', 'Uber', 'Ola'].includes(evt.merchant || '');

      const isFinance =
        cat.includes('finance') ||
        cat.includes('bills') ||
        tags.includes('payment') ||
        tags.includes('upi') ||
        ['PhonePe', 'Google Pay', 'Paytm', 'Cred', 'SBI', 'HDFC', 'ICICI', 'Axis Bank'].includes(evt.merchant || '') ||
        (Boolean(evt.amount) && !isOrder && !isTravel);

      if (isOrder) {
        orders.push(evt);
        if (evt.merchant) orderMerchants.add(evt.merchant);
      } else if (isFinance) {
        payments.push(evt);
        if (evt.merchant) paymentMerchants.add(evt.merchant);
      } else if (isTravel) {
        travel.push(evt);
        if (evt.merchant) travelBookings.add(evt.merchant);
      } else if (
        cat.includes('social') ||
        cat.includes('chat') ||
        ['WhatsApp', 'Telegram', 'Slack', 'Teams'].includes(evt.merchant || '')
      ) {
        chats.push(evt);
        if (evt.merchant) chatApps.add(evt.merchant);
      } else if (
        cat.includes('doc') ||
        tags.includes('id') ||
        tags.includes('aadhaar') ||
        tags.includes('pan') ||
        tags.includes('passport')
      ) {
        documents.push(evt);
        docTypes.add(evt.title);
      } else if (
        cat.includes('media') ||
        cat.includes('entertainment') ||
        ['Netflix', 'Spotify', 'YouTube', 'Prime'].includes(evt.merchant || '')
      ) {
        entertainment.push(evt);
        entTitles.add(evt.merchant || evt.title);
      } else if (
        cat.includes('health') ||
        tags.includes('medical') ||
        tags.includes('prescription')
      ) {
        health.push(evt);
      }
    }

    // Determine Top Merchant, Top Category, Most Active App
    let topMerchant: string | undefined;
    let maxMerchantScore = 0;
    for (const [m, count] of Object.entries(merchantFreq)) {
      const score = count * 10 + (merchantSpend[m] || 0);
      if (score > maxMerchantScore) {
        maxMerchantScore = score;
        topMerchant = m;
      }
    }

    let topCategory: string | undefined;
    let maxCatCount = 0;
    for (const [c, count] of Object.entries(categoryFreq)) {
      if (count > maxCatCount) {
        maxCatCount = count;
        topCategory = c;
      }
    }

    let mostActiveApp: string | undefined;
    let maxAppCount = 0;
    for (const [a, count] of Object.entries(appFreq)) {
      if (count > maxAppCount) {
        maxAppCount = count;
        mostActiveApp = a;
      }
    }

    // Build Highlights
    if (totalSpending > 0) {
      const spendMerchants = Array.from(paymentMerchants).concat(Array.from(orderMerchants)).slice(0, 2);
      if (spendMerchants.length > 0) {
        highlights.push(`Spent ₹${totalSpending.toLocaleString('en-IN')} across ${spendMerchants.join(' and ')}.`);
      } else {
        highlights.push(`Spent ₹${totalSpending.toLocaleString('en-IN')} today.`);
      }
    } else if (payments.length > 0) {
      highlights.push(`${payments.length} payment record${payments.length > 1 ? 's' : ''} captured.`);
    }

    if (orders.length > 0) {
      const merchList = Array.from(orderMerchants).slice(0, 2).join(', ');
      highlights.push(`${orders.length} order${orders.length > 1 ? 's' : ''}${merchList ? ` on ${merchList}` : ''}.`);
    }

    if (travel.length > 0) {
      highlights.push(`${travel.length} travel booking${travel.length > 1 ? 's' : ''} captured.`);
    }

    if (chats.length > 0) {
      highlights.push(`${chats.length} chat screenshot${chats.length > 1 ? 's' : ''}.`);
    }

    if (documents.length > 0) {
      highlights.push(`${documents.length} document${documents.length > 1 ? 's' : ''} saved.`);
    }

    if (health.length > 0) {
      highlights.push(`${health.length} health or medical report${health.length > 1 ? 's' : ''}.`);
    }

    // Calculate payment-specific total
    let paymentTotal = 0;
    for (const p of payments) {
      if (p.amount) paymentTotal += p.amount;
    }
    paymentTotal = Math.round(paymentTotal * 100) / 100;

    // AI Summary
    let summary = '';
    if (totalScreenshots === 0) {
      summary = 'No screenshots captured today.';
    } else {
      const parts: string[] = [];
      if (payments.length > 0) {
        const paymentMerchantsStr = Array.from(paymentMerchants).join(', ');
        parts.push(`₹${paymentTotal.toLocaleString('en-IN')} paid via ${paymentMerchantsStr || 'UPI'}`);
      }
      if (orders.length > 0) {
        const orderMerchantsStr = Array.from(orderMerchants).join(', ');
        parts.push(`${orders.length} order${orders.length > 1 ? 's' : ''} on ${orderMerchantsStr || 'shopping'}`);
      }
      if (travel.length > 0) {
        parts.push(`${travel.length} travel booking${travel.length > 1 ? 's' : ''}`);
      }
      if (chats.length > 0) {
        parts.push(`${chats.length} chat${chats.length > 1 ? 's' : ''}`);
      }
      if (documents.length > 0) {
        parts.push(`${documents.length} document${documents.length > 1 ? 's' : ''}`);
      }
      if (health.length > 0) {
        parts.push(`${health.length} health record${health.length > 1 ? 's' : ''}`);
      }

      const isToday = dateStr === this.formatDateString(new Date());
      const prefix = isToday ? 'Today in ContextVault:' : `ContextVault Daily Digest (${dateFormatted}):`;
      summary = parts.length > 0 ? `${prefix} ${parts.join(', ')}.` : `${prefix} ${totalScreenshots} screenshots saved.`;
    }

    return {
      date: dateStr,
      dateFormatted,
      totalScreenshots,
      summary,
      spendingTotal: Math.round(totalSpending * 100) / 100,
      topMerchant,
      topCategory,
      mostActiveApp,
      payments: { count: payments.length, totalAmount: paymentTotal, merchants: Array.from(paymentMerchants), items: payments },
      orders: { count: orders.length, merchants: Array.from(orderMerchants), items: orders },
      travel: { count: travel.length, bookings: Array.from(travelBookings), items: travel },
      chats: { count: chats.length, apps: Array.from(chatApps), items: chats },
      documents: { count: documents.length, types: Array.from(docTypes), items: documents },
      entertainment: { count: entertainment.length, titles: Array.from(entTitles), items: entertainment },
      health: { count: health.length, items: health },
      highlights,
    };
  }

  private getTodayDateString(): string {
    return this.formatDateString(new Date());
  }

  private formatDateString(d: Date): string {
    try {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }
}

export const dailyDigestService = new DailyDigestService();

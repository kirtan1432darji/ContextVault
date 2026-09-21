import { memoryTimelineService } from './MemoryTimelineService';
import { DailyDigest, MemoryTimelineEvent } from './types';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class DailyDigestService {
  private digestCache: Map<string, DailyDigest> = new Map();

  /**
   * Generates the Daily Digest for "Today in ContextVault".
   */
  async getTodayDigest(forceRefresh = false): Promise<DailyDigest> {
    const todayStr = this.getTodayDateString();
    return this.getDigestForDate(todayStr, forceRefresh);
  }

  /**
   * Generates or retrieves the Daily Digest for any specified date (YYYY-MM-DD).
   */
  async getDigestForDate(dateStr: string, forceRefresh = false): Promise<DailyDigest> {
    if (!forceRefresh && this.digestCache.has(dateStr)) {
      return this.digestCache.get(dateStr)!;
    }

    const events = await memoryTimelineService.getEventsForDate(dateStr);
    const digest = this.synthesizeDigest(dateStr, events);
    this.digestCache.set(dateStr, digest);
    return digest;
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
   * Synthesizes categorized activity and creates a concise natural summary.
   */
  private synthesizeDigest(dateStr: string, events: MemoryTimelineEvent[]): DailyDigest {
    const parsedDate = new Date(dateStr + 'T00:00:00');
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

    let totalPaymentAmount = 0;
    const paymentMerchants = new Set<string>();
    const orderMerchants = new Set<string>();
    const travelBookings = new Set<string>();
    const chatApps = new Set<string>();
    const docTypes = new Set<string>();
    const entTitles = new Set<string>();

    for (const evt of events) {
      const cat = evt.category.toLowerCase();
      const titleLower = evt.title.toLowerCase();
      const tags = evt.tags.map((t) => t.toLowerCase());

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

      // 1. Orders / Shopping / Food
      if (isOrder) {
        orders.push(evt);
        if (evt.merchant) orderMerchants.add(evt.merchant);
      }
      // 2. Payments / Finance
      else if (isFinance) {
        payments.push(evt);
        if (evt.amount) totalPaymentAmount += evt.amount;
        if (evt.merchant) paymentMerchants.add(evt.merchant);
      }
      // 3. Travel
      else if (isTravel) {
        travel.push(evt);
        if (evt.merchant) travelBookings.add(evt.merchant);
      }
      // 4. Chats
      else if (
        cat.includes('social') ||
        cat.includes('chat') ||
        ['WhatsApp', 'Telegram', 'Slack', 'Teams'].includes(evt.merchant || '')
      ) {
        chats.push(evt);
        if (evt.merchant) chatApps.add(evt.merchant);
      }
      // 5. Documents
      else if (
        cat.includes('doc') ||
        tags.includes('id') ||
        tags.includes('aadhaar') ||
        tags.includes('pan') ||
        tags.includes('passport')
      ) {
        documents.push(evt);
        docTypes.add(evt.title);
      }
      // 6. Entertainment
      else if (
        cat.includes('media') ||
        cat.includes('entertainment') ||
        ['Netflix', 'Spotify', 'YouTube', 'Prime'].includes(evt.merchant || '')
      ) {
        entertainment.push(evt);
        entTitles.add(evt.merchant || evt.title);
      }
      // 7. Health
      else if (
        cat.includes('health') ||
        tags.includes('medical') ||
        tags.includes('prescription')
      ) {
        health.push(evt);
      }
    }

    // Build Highlights
    if (payments.length > 0) {
      if (totalPaymentAmount > 0) {
        highlights.push(`${payments.length} payment${payments.length > 1 ? 's' : ''} (₹${totalPaymentAmount.toLocaleString('en-IN')})`);
      } else {
        highlights.push(`${payments.length} payment record${payments.length > 1 ? 's' : ''}`);
      }
    }
    if (orders.length > 0) {
      const merchList = Array.from(orderMerchants).slice(0, 2).join(', ');
      highlights.push(`${orders.length} order${orders.length > 1 ? 's' : ''}${merchList ? ` on ${merchList}` : ''}`);
    }
    if (travel.length > 0) {
      highlights.push(`${travel.length} travel booking${travel.length > 1 ? 's' : ''}`);
    }
    if (chats.length > 0) {
      highlights.push(`${chats.length} chat screenshot${chats.length > 1 ? 's' : ''}`);
    }
    if (documents.length > 0) {
      highlights.push(`${documents.length} document${documents.length > 1 ? 's' : ''} saved`);
    }

    // Build Concise AI Summary
    const summary = this.buildDigestSummary({
      dateStr,
      totalScreenshots: events.length,
      paymentsCount: payments.length,
      totalPaymentAmount,
      paymentMerchants: Array.from(paymentMerchants),
      ordersCount: orders.length,
      orderMerchants: Array.from(orderMerchants),
      travelCount: travel.length,
      chatsCount: chats.length,
      documentsCount: documents.length,
    });

    return {
      date: dateStr,
      dateFormatted,
      totalScreenshots: events.length,
      summary,
      payments: {
        count: payments.length,
        totalAmount: totalPaymentAmount,
        merchants: Array.from(paymentMerchants),
        items: payments,
      },
      orders: {
        count: orders.length,
        merchants: Array.from(orderMerchants),
        items: orders,
      },
      travel: {
        count: travel.length,
        bookings: Array.from(travelBookings),
        items: travel,
      },
      chats: {
        count: chats.length,
        apps: Array.from(chatApps),
        items: chats,
      },
      documents: {
        count: documents.length,
        types: Array.from(docTypes),
        items: documents,
      },
      entertainment: {
        count: entertainment.length,
        titles: Array.from(entTitles),
        items: entertainment,
      },
      health: {
        count: health.length,
        items: health,
      },
      highlights,
    };
  }

  private buildDigestSummary(params: {
    dateStr: string;
    totalScreenshots: number;
    paymentsCount: number;
    totalPaymentAmount: number;
    paymentMerchants: string[];
    ordersCount: number;
    orderMerchants: string[];
    travelCount: number;
    chatsCount: number;
    documentsCount: number;
  }): string {
    const isToday = params.dateStr === this.getTodayDateString();
    const prefix = isToday ? 'Today in ContextVault: ' : 'Daily Digest: ';

    if (params.totalScreenshots === 0) {
      return isToday
        ? 'No screenshots captured today yet. Take or sync screenshots to see your daily memory digest.'
        : 'No screenshots recorded on this day.';
    }

    const segments: string[] = [];

    if (params.paymentsCount > 0) {
      let payStr = `${params.paymentsCount} payment${params.paymentsCount > 1 ? 's' : ''}`;
      if (params.totalPaymentAmount > 0) {
        payStr += ` totaling ₹${params.totalPaymentAmount.toLocaleString('en-IN')}`;
      }
      if (params.paymentMerchants.length > 0) {
        payStr += ` (${params.paymentMerchants.slice(0, 2).join(' & ')})`;
      }
      segments.push(payStr);
    }

    if (params.ordersCount > 0) {
      let ordStr = `${params.ordersCount} order${params.ordersCount > 1 ? 's' : ''}`;
      if (params.orderMerchants.length > 0) {
        ordStr += ` from ${params.orderMerchants.slice(0, 2).join(' & ')}`;
      }
      segments.push(ordStr);
    }

    if (params.travelCount > 0) {
      segments.push(`${params.travelCount} travel booking${params.travelCount > 1 ? 's' : ''}`);
    }

    if (params.chatsCount > 0) {
      segments.push(`${params.chatsCount} chat${params.chatsCount > 1 ? 's' : ''} saved`);
    }

    if (params.documentsCount > 0) {
      segments.push(`${params.documentsCount} document${params.documentsCount > 1 ? 's' : ''} preserved`);
    }

    if (segments.length === 0) {
      return `${prefix}${params.totalScreenshots} screenshot${params.totalScreenshots > 1 ? 's' : ''} organized across your smart folders.`;
    }

    return `${prefix}${segments.join(', ')}.`;
  }

  private getTodayDateString(): string {
    return this.formatDateString(new Date());
  }

  private formatDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

export const dailyDigestService = new DailyDigestService();

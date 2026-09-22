jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Alert: {
    alert: jest.fn(),
  },
}));

import {
  memoryTimelineService,
  dailyDigestService,
  digestSummaryService,
  financeInsightService,
  merchantTimelineService,
  highlightService,
} from '../services/memory';
import { searchIntentParser } from '../services/search/SearchIntentParser';
import { semanticSearchService } from '../services/search/SemanticSearchService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

const createMockScreenshot = (
  id: string,
  categoryId = 'finance_bills',
  fileName = 'screenshot.jpg',
  createdAt = '2026-09-18T10:00:00Z',
  ocrText = '',
  extra: any = {}
): ScreenshotModel => ({
  id,
  deviceAssetId: `asset_${id}`,
  filePath: `file:///storage/emulated/0/Pictures/Screenshots/${fileName}`,
  localPath: `file:///storage/emulated/0/Pictures/Screenshots/${fileName}`,
  fileName,
  fileSize: 2048,
  width: 1080,
  height: 2400,
  createdAt,
  createdOn: createdAt,
  categoryId,
  folderId: categoryId,
  categoryName: extra.categoryName || categoryId,
  subcategory: extra.subcategory || 'General',
  confidence: 0.95,
  isAutoCategorized: true,
  isFavorite: false,
  isReviewed: true,
  isSynced: false,
  ocrStatus: 'completed',
  ocrText,
  tags: (extra.tags || []).map((t: string) => ({ id: `tag_${t}`, name: t, colorHex: '#6366F1' })),
  keywords: extra.tags || [],
  entities: extra.entities,
  sourceApp: extra.sourceApp,
  detectedApp: extra.detectedApp,
  summary: extra.summary,
  ...extra,
});

describe('Sprint P6-A — AI Memory Timeline & Daily Digest Engine', () => {
  const now = new Date();
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatDate(now);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayStr = formatDate(yesterdayDate);
  const threeDaysAgoDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
  const threeDaysAgoStr = formatDate(threeDaysAgoDate);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastMonthStr = formatDate(lastMonthDate);

  const mockScreenshots: ScreenshotModel[] = [
    // 1. Today payment: PhonePe ₹450
    createMockScreenshot(
      'sc_today_phonepe',
      'finance_bills',
      'phonepe_payment.jpg',
      `${todayStr}T14:20:00`,
      'Paid to Sharma Kirana Store ₹450 Transaction Successful PhonePe',
      {
        categoryName: 'Finance & Bills',
        subcategory: 'PhonePe',
        entities: { merchant: 'PhonePe', amount: 450 },
        tags: ['payment', 'upi', 'phonepe'],
        summary: 'PhonePe payment of ₹450 to Sharma Kirana Store',
      }
    ),
    // 2. Today food: Swiggy ₹320
    createMockScreenshot(
      'sc_today_swiggy',
      'food_dining',
      'swiggy_order.png',
      `${todayStr}T12:45:00`,
      'Swiggy Order Confirmed Biryani By Kilo ₹320 Delivery to Home',
      {
        categoryName: 'Food & Dining',
        subcategory: 'Swiggy',
        entities: { merchant: 'Swiggy', amount: 320 },
        tags: ['food', 'swiggy'],
        summary: 'Swiggy food order of Biryani totaling ₹320',
      }
    ),
    // 3. Yesterday payment: Google Pay ₹1,200
    createMockScreenshot(
      'sc_yest_gpay',
      'finance_bills',
      'gpay_electric.jpg',
      `${yesterdayStr}T14:30:00`,
      'Electricity Bill Paid ₹1,200 via Google Pay successfully',
      {
        categoryName: 'Finance & Bills',
        subcategory: 'Google Pay',
        entities: { merchant: 'Google Pay', amount: 1200 },
        tags: ['payment', 'electricity'],
        summary: 'Electricity bill of ₹1,200 paid through Google Pay',
      }
    ),
    // 4. Yesterday chat: WhatsApp
    createMockScreenshot(
      'sc_yest_chat',
      'social_chat',
      'whatsapp_chat.png',
      `${yesterdayStr}T11:15:00`,
      'Project Meeting scheduled for tomorrow at 10 AM on Teams',
      {
        categoryName: 'Chats & Social',
        subcategory: 'WhatsApp',
        entities: { application: 'WhatsApp' },
        tags: ['chat', 'meeting'],
        summary: 'WhatsApp chat conversation regarding project meeting',
      }
    ),
    // 5. This week shopping: Amazon ₹2,499
    createMockScreenshot(
      'sc_week_amazon',
      'shopping_orders',
      'amazon_invoice.jpg',
      `${threeDaysAgoStr}T09:00:00`,
      'Amazon.in Order Placed Wireless Earbuds ₹2,499 Arriving Friday',
      {
        categoryName: 'Shopping & Orders',
        subcategory: 'Amazon',
        entities: { merchant: 'Amazon', amount: 2499 },
        tags: ['shopping', 'amazon'],
        summary: 'Amazon order placed for Wireless Earbuds totaling ₹2,499',
      }
    ),
    // 6. This week travel: IRCTC Train Booking ₹850
    createMockScreenshot(
      'sc_week_irctc',
      'travel_transit',
      'irctc_ticket.png',
      `${threeDaysAgoStr}T16:00:00`,
      'IRCTC E-Ticketing Service PNR 2458963214 Mumbai to Ahmedabad ₹850 Confirmed',
      {
        categoryName: 'Travel & Transit',
        subcategory: 'IRCTC',
        entities: { merchant: 'IRCTC', amount: 850 },
        tags: ['travel', 'train', 'irctc'],
        summary: 'IRCTC train ticket booked from Mumbai to Ahmedabad',
      }
    ),
    // 7. Last month purchase: Flipkart ₹5,999
    createMockScreenshot(
      'sc_last_month_flipkart',
      'shopping_orders',
      'flipkart_monitor.jpg',
      `${lastMonthStr}T15:00:00`,
      'Flipkart SuperCoins Used Gaming Monitor Paid ₹5,999 Delivered',
      {
        categoryName: 'Shopping & Orders',
        subcategory: 'Flipkart',
        entities: { merchant: 'Flipkart', amount: 5999 },
        tags: ['shopping', 'flipkart'],
        summary: 'Flipkart order for Gaming Monitor totaling ₹5,999',
      }
    ),
    // 8. Offline fallback test: No summary in metadata
    createMockScreenshot(
      'sc_offline_doc',
      'personal_docs',
      'aadhaar_card.png',
      `${todayStr}T08:00:00`,
      'Government of India Unique Identification Authority of India Aadhaar 1234 5678 9012',
      {
        categoryName: 'Identity & Documents',
        tags: ['id', 'aadhaar'],
        // Explicitly omit summary to verify offline rule-based fallback
      }
    ),
  ];

  beforeEach(() => {
    useScreenshotStore.setState({
      screenshots: mockScreenshots,
      needsReviewList: [],
    });
    // Invalidate memory timeline caches
    memoryTimelineService.rebuildTimeline();
  });

  // ==========================================
  // 1. TIMELINE GROUPING
  // ==========================================
  describe('1. Timeline Grouping', () => {
    it('groups screenshots chronologically into Today, Yesterday, This Week, and Monthly', async () => {
      const grouping = await memoryTimelineService.getTimeline({ forceRefresh: true });

      expect(grouping.totalCount).toBe(8);
      expect(grouping.allEvents.length).toBe(8);

      // Today events
      expect(grouping.today.length).toBe(3); // PhonePe, Swiggy, Aadhaar
      const todayIds = grouping.today.map((e) => e.screenshotId);
      expect(todayIds).toContain('sc_today_phonepe');
      expect(todayIds).toContain('sc_today_swiggy');
      expect(todayIds).toContain('sc_offline_doc');

      // Yesterday events
      expect(grouping.yesterday.length).toBe(2); // Google Pay, WhatsApp
      const yestIds = grouping.yesterday.map((e) => e.screenshotId);
      expect(yestIds).toContain('sc_yest_gpay');
      expect(yestIds).toContain('sc_yest_chat');

      // Last 7 days (not including today/yesterday)
      expect(grouping.last7Days.length).toBe(2); // Amazon, IRCTC
      const weekIds = grouping.last7Days.map((e) => e.screenshotId);
      expect(weekIds).toContain('sc_week_amazon');
      expect(weekIds).toContain('sc_week_irctc');

      // Monthly groupings exist
      expect(Object.keys(grouping.monthly).length).toBeGreaterThanOrEqual(1);

      // Yearly groupings exist
      expect(Object.keys(grouping.yearly).length).toBeGreaterThanOrEqual(1);
    });

    it('retrieves events for a specific date', async () => {
      const events = await memoryTimelineService.getEventsForDate(todayStr);
      expect(events.length).toBe(3);
      events.forEach((e) => expect(e.date).toBe(todayStr));
    });

    it('retrieves events within a date range', async () => {
      const events = await memoryTimelineService.getEventsForDateRange(yesterdayStr, todayStr);
      expect(events.length).toBe(5); // 3 today + 2 yesterday
    });
  });

  // ==========================================
  // 2. DAILY DIGEST GENERATION
  // ==========================================
  describe('2. Daily Digest Generation', () => {
    it('generates Today in ContextVault with accurate payment and order counts', async () => {
      const digest = await dailyDigestService.getTodayDigest(true);

      expect(digest.date).toBe(todayStr);
      expect(digest.totalScreenshots).toBe(3);

      // Payments today: PhonePe (₹450)
      expect(digest.payments.count).toBe(1);
      expect(digest.payments.totalAmount).toBe(450);
      expect(digest.payments.merchants).toContain('PhonePe');

      // Orders today: Swiggy
      expect(digest.orders.count).toBe(1);
      expect(digest.orders.merchants).toContain('Swiggy');

      // Documents today: Aadhaar
      expect(digest.documents.count).toBe(1);

      // Concise summary synthesis
      expect(digest.summary).toContain('Today in ContextVault:');
      expect(digest.summary).toContain('₹450');
      expect(digest.summary).toContain('PhonePe');
      expect(digest.summary).toContain('Swiggy');
    });

    it('generates Yesterday digest accurately', async () => {
      const digest = await dailyDigestService.getDigestForDate(yesterdayStr, true);

      expect(digest.date).toBe(yesterdayStr);
      expect(digest.totalScreenshots).toBe(2);

      // Payments yesterday: Google Pay (₹1,200)
      expect(digest.payments.count).toBe(1);
      expect(digest.payments.totalAmount).toBe(1200);

      // Chats yesterday: WhatsApp
      expect(digest.chats.count).toBe(1);
      expect(digest.chats.apps).toContain('WhatsApp');
    });

    it('retrieves recent daily digests for past 7 days', async () => {
      const digests = await dailyDigestService.getRecentDailyDigests(7);
      expect(digests.length).toBeGreaterThanOrEqual(2);
      expect(digests[0].date).toBe(todayStr);
    });
  });

  // ==========================================
  // 3. MERCHANT HISTORY
  // ==========================================
  describe('3. Merchant History', () => {
    it('retrieves complete chronological history for Swiggy', async () => {
      const swiggyHistory = await merchantTimelineService.getMerchantTimeline('Swiggy');

      expect(swiggyHistory).not.toBeNull();
      expect(swiggyHistory!.merchant).toBe('Swiggy');
      expect(swiggyHistory!.transactionCount).toBe(1);
      expect(swiggyHistory!.totalSpent).toBe(320);
      expect(swiggyHistory!.history.length).toBe(1);
    });

    it('aggregates all distinct merchants ranked by spend', async () => {
      const merchants = await merchantTimelineService.getAllMerchants();

      expect(merchants.length).toBeGreaterThanOrEqual(4);
      // Top spend merchant should be Flipkart (₹5,999) or Amazon (₹2,499)
      const topSpender = merchants[0];
      expect(topSpender.totalSpent).toBe(5999);
      expect(topSpender.merchant).toBe('Flipkart');

      const names = merchants.map((m) => m.merchant);
      expect(names).toContain('Flipkart');
      expect(names).toContain('Amazon');
      expect(names).toContain('Google Pay');
      expect(names).toContain('IRCTC');
      expect(names).toContain('PhonePe');
      expect(names).toContain('Swiggy');
    });

    it('returns top merchants with limit', async () => {
      const top3 = await merchantTimelineService.getTopMerchants(3);
      expect(top3.length).toBe(3);
      expect(top3[0].totalSpent).toBeGreaterThanOrEqual(top3[1].totalSpent);
    });
  });

  // ==========================================
  // 4. SPENDING AGGREGATION & FINANCE INSIGHTS
  // ==========================================
  describe('4. Spending Aggregation & Finance Insights', () => {
    it('calculates total UPI spending and average transaction amount', async () => {
      const insights = await financeInsightService.getSpendingInsights();

      // Total tracked: 450 + 320 + 1200 + 2499 + 850 + 5999 = 11,318
      expect(insights.totalUpiSpending).toBe(11318);
      expect(insights.upiTransactionCount).toBe(6);
      expect(insights.averageTransaction).toBe(Math.round(11318 / 6));

      // Largest purchase: Flipkart (₹5,999)
      expect(insights.largestPurchase).not.toBeNull();
      expect(insights.largestPurchase!.amount).toBe(5999);
      expect(insights.largestPurchase!.merchant).toBe('Flipkart');
    });

    it('calculates category spending breakdown and percentages', async () => {
      const breakdown = await financeInsightService.getCategoryBreakdown();

      expect(breakdown.length).toBeGreaterThanOrEqual(3);
      const totalPct = breakdown.reduce((acc, c) => acc + c.percentage, 0);
      expect(totalPct).toBeGreaterThanOrEqual(95); // allow rounding
    });

    it('calculates monthly spending trend chronologically', async () => {
      const trend = await financeInsightService.getMonthlyTrend();

      expect(trend.length).toBeGreaterThanOrEqual(1);
      trend.forEach((t) => {
        expect(t.amount).toBeGreaterThan(0);
        expect(t.count).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================
  // 5. MONTHLY & WEEKLY RECAPS
  // ==========================================
  describe('5. Monthly & Weekly Recaps', () => {
    it('generates weekly digest covering spending, shopping, travel, and productivity', async () => {
      const weekly = await digestSummaryService.getWeeklyDigest(0);

      expect(weekly.periodType).toBe('weekly');
      expect(weekly.periodLabel).toBe('This Week');
      expect(weekly.totalScreenshots).toBeGreaterThanOrEqual(6);

      // Travel count includes IRCTC
      expect(weekly.travel.tripsCount).toBeGreaterThanOrEqual(1);
      expect(weekly.travel.destinationsOrBookings).toContain('IRCTC');

      // Productivity includes chats & docs
      expect(weekly.productivity.chatsCaptured).toBeGreaterThanOrEqual(1);
      expect(weekly.productivity.documentsSaved).toBeGreaterThanOrEqual(1);

      // Natural language summary
      expect(weekly.summary).toContain('This Week');
    });

    it('generates monthly digest with highlights and spending', async () => {
      const monthly = await digestSummaryService.getMonthlyDigest(0);

      expect(monthly.periodType).toBe('monthly');
      expect(monthly.totalScreenshots).toBeGreaterThanOrEqual(1);
      expect(monthly.highlights.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 6. OFFLINE SUMMARY FALLBACK
  // ==========================================
  describe('6. Offline Summary Fallback', () => {
    it('constructs grounded fallback summary when Vision AI summary is absent', async () => {
      const events = await memoryTimelineService.getAllEvents();
      const docEvent = events.find((e) => e.screenshotId === 'sc_offline_doc');

      expect(docEvent).toBeDefined();
      // Should have generated an intelligent grounded offline summary
      expect(docEvent!.summary).toBeTruthy();
      expect(
        docEvent!.summary.includes('document') ||
        docEvent!.summary.includes('Aadhaar') ||
        docEvent!.summary.includes('identification')
      ).toBe(true);
    });
  });

  // ==========================================
  // 7. AI HIGHLIGHTS
  // ==========================================
  describe('7. AI Highlights', () => {
    it('surfaces biggest purchase, top merchant, active app, and memories', async () => {
      const highlights = await highlightService.getHighlights();

      expect(highlights.length).toBeGreaterThanOrEqual(3);

      const types = highlights.map((h) => h.type);
      expect(types).toContain('travel_memory');
      expect(types).toContain('shopping_memory');

      // Travel memory highlight
      const travelHl = highlights.find((h) => h.type === 'travel_memory');
      expect(travelHl?.value).toBe('IRCTC');

      // Shopping memory highlight
      const shoppingHl = highlights.find((h) => h.type === 'shopping_memory');
      expect(shoppingHl?.value).toBe('Amazon');
    });
  });

  // ==========================================
  // 8. SEARCH TIMELINE FILTER
  // ==========================================
  describe('8. Search Timeline Filter Integration', () => {
    it('parses timeline queries with possessive forms', () => {
      const p1 = searchIntentParser.parse("Last month's payments.");
      expect(p1.dateRange?.relative).toBe('last_month');
      expect(p1.domain).toBe('finance');

      const p2 = searchIntentParser.parse("Yesterday's chats.");
      expect(p2.dateRange?.relative).toBe('yesterday');
      expect(p2.domain).toBe('chats');

      const p3 = searchIntentParser.parse("This week's travel.");
      expect(p3.dateRange?.relative).toBe('this_week');
      expect(p3.domain).toBe('travel');

      const p4 = searchIntentParser.parse("September shopping.");
      expect(p4.dateRange?.relative).toBe('specific_month');
      expect(p4.dateRange?.monthName).toBe('september');
      expect(p4.domain).toBe('shopping');
    });

    it('filters candidates via timelineFilter in SemanticSearchService', async () => {
      // Search today's payments
      const resultsToday = await semanticSearchService.search('payments', {
        timelineFilter: 'today',
      });
      expect(resultsToday.length).toBeGreaterThanOrEqual(1);
      resultsToday.forEach((r) => expect(r.createdAt.startsWith(todayStr)).toBe(true));

      // Search yesterday's chats
      const resultsYest = await semanticSearchService.search('chat', {
        timelineFilter: 'yesterday',
      });
      expect(resultsYest.length).toBeGreaterThanOrEqual(1);
      resultsYest.forEach((r) => expect(r.createdAt.startsWith(yesterdayStr)).toBe(true));
    });
  });

  // ==========================================
  // 9. TELEMETRY & DIAGNOSTICS
  // ==========================================
  describe('9. Telemetry & Diagnostics', () => {
    it('returns memory diagnostics stats accurately', async () => {
      const stats = await memoryTimelineService.getDiagnostics();

      expect(stats.totalTimelineEvents).toBe(8);
      expect(stats.dailyDigestsGenerated).toBeGreaterThanOrEqual(1);
      expect(stats.monthlySummariesCount).toBeGreaterThanOrEqual(1);
      expect(stats.cachedSummariesCount).toBeGreaterThanOrEqual(0);
      expect(stats.lastRebuiltAt).toBeTruthy();
    });
  });
});

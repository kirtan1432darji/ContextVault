export type TimelinePeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'earlier_this_month'
  | 'older'
  | 'last_7_days'
  | 'last_30_days'
  | 'monthly'
  | 'yearly';

export interface MemoryTimelineEvent {
  id: string;
  screenshotId: string;
  screenshotIds: string[];
  date: string; // YYYY-MM-DD
  timestamp: number;
  timeStr: string; // e.g. "14:32"
  category: string; // Internal category ID
  categoryName: string; // Display name
  title: string;
  summary: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  screenshotCount: number;
  thumbnailUri?: string;
  filePath: string;
  contentUri?: string;
  period: TimelinePeriod;
  periodGroup: string; // Human label: 'Today', 'Yesterday', 'This Week', 'Earlier This Month', 'Older'
  tags: string[];
  sourceApp?: string;
  detectedApp?: string;
}

export interface TimelineGrouping {
  today: MemoryTimelineEvent[];
  yesterday: MemoryTimelineEvent[];
  thisWeek: MemoryTimelineEvent[];
  earlierThisMonth: MemoryTimelineEvent[];
  older: MemoryTimelineEvent[];
  last7Days: MemoryTimelineEvent[];
  last30Days: MemoryTimelineEvent[];
  monthly: Record<string, MemoryTimelineEvent[]>;
  yearly: Record<string, MemoryTimelineEvent[]>;
  allEvents: MemoryTimelineEvent[];
  totalCount: number;
}

export interface DailyDigestSection<T = MemoryTimelineEvent> {
  count: number;
  items: T[];
  merchants?: string[];
  totalAmount?: number;
  bookings?: string[];
  apps?: string[];
  types?: string[];
  titles?: string[];
}

export interface DailyDigest {
  date: string; // YYYY-MM-DD
  dateFormatted: string; // e.g. "Friday, Sep 18, 2026"
  totalScreenshots: number;
  summary: string;
  spendingTotal: number;
  topMerchant?: string;
  topCategory?: string;
  mostActiveApp?: string;
  payments: { count: number; totalAmount: number; merchants: string[]; items: MemoryTimelineEvent[] };
  orders: { count: number; merchants: string[]; items: MemoryTimelineEvent[] };
  travel: { count: number; bookings: string[]; items: MemoryTimelineEvent[] };
  chats: { count: number; apps: string[]; items: MemoryTimelineEvent[] };
  documents: { count: number; types: string[]; items: MemoryTimelineEvent[] };
  entertainment: { count: number; titles: string[]; items: MemoryTimelineEvent[] };
  health: { count: number; items: MemoryTimelineEvent[] };
  highlights: string[];
}

export interface PeriodDigest {
  periodType: 'weekly' | 'monthly';
  periodLabel: string; // e.g. "This Week" or "September 2026"
  weekKey?: string;
  monthKey?: string;
  dateFrom: string;
  dateTo: string;
  totalScreenshots: number;
  totalSpending?: number;
  summary: string;
  spending: {
    totalAmount: number;
    upiCount: number;
    topMerchant?: string;
    topCategory?: string;
    largestPurchase?: {
      amount: number;
      merchant?: string;
      screenshotId: string;
      date: string;
    };
  };
  shopping: {
    totalOrders: number;
    topMerchants: string[];
    itemsCount: number;
  };
  travel: {
    tripsCount: number;
    destinationsOrBookings: string[];
  };
  productivity: {
    documentsSaved: number;
    chatsCaptured: number;
    codeSnippets: number;
  };
  highlights: string[];
}

export interface FinanceInsights {
  totalUpiSpending: number;
  upiTransactionCount: number;
  topMerchants: { merchant: string; amount: number; count: number }[];
  categorySpending: { category: string; amount: number; count: number; percentage: number }[];
  monthlySpendingTrend: { month: string; amount: number; count: number }[];
  averageTransaction: number;
  largestPurchase: {
    amount: number;
    merchant?: string;
    date: string;
    screenshotId: string;
    thumbnailUri?: string;
    filePath?: string;
  } | null;
}

export interface MerchantTimelineItem {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  firstSeenDate: string;
  lastSeenDate: string;
  history: MemoryTimelineEvent[];
}

export type MemoryHighlightType =
  | 'biggest_purchase'
  | 'most_visited_merchant'
  | 'most_active_app'
  | 'most_screenshots_day'
  | 'travel_memory'
  | 'shopping_memory';

export interface MemoryHighlight {
  id: string;
  type: MemoryHighlightType;
  title: string;
  subtitle: string;
  value: string;
  date: string;
  screenshotId: string;
  thumbnailUri?: string;
  filePath?: string;
}

export interface MemoryDiagnosticsStats {
  totalTimelineEvents: number;
  dailyDigestsGenerated: number;
  weeklySummariesCount: number;
  monthlySummariesCount: number;
  cachedSummariesCount: number;
  lastRebuiltAt: string | null;
}

export type InsightDomain =
  | 'spending'
  | 'shopping'
  | 'productivity'
  | 'travel'
  | 'health'
  | 'communication';

export interface InsightDomainCard {
  domain: InsightDomain;
  title: string;
  subtitle: string;
  primaryMetric: string;
  secondaryMetric?: string;
  icon: string;
  color: string;
  items: { label: string; value: string; extra?: string }[];
  highlights: string[];
  updatedAt: string;
}

export interface YearlyHighlights {
  year: number;
  totalScreenshots: number;
  spendingTotal: number;
  totalSpending?: number;
  biggestPurchase?: {
    amount: number;
    merchant?: string;
    screenshotId?: string;
    date?: string;
  };
  topCategory?: string;
  shoppingCount: number;
  travelCount: number;
  documentsCount: number;
  healthCount: number;
  mostVisitedMerchant: string;
  mostUsedApp: string;
  timelineStreak: number;
  mostMemorableDay: {
    date: string;
    count: number;
    summary: string;
  };
  highlights: string[];
}

import { memoryTimelineService } from './MemoryTimelineService';
import { digestRepository } from '../../database/repositories/DigestRepository';
import { PeriodDigest, YearlyHighlights, MemoryTimelineEvent } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class DigestAggregationService {
  private memoryStreakCache: number | null = null;

  /**
   * Generates or retrieves weekly summary digest.
   * @param weekOffset 0 for current week, 1 for previous week, etc.
   */
  async getWeeklyDigest(weekOffset = 0, forceRefresh = false): Promise<PeriodDigest> {
    const now = new Date();
    const endDaysAgo = weekOffset * 7;
    const startDaysAgo = endDaysAgo + 7;

    const endDate = new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000);
    const startDate = new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000);

    const fromDateStr = this.formatDateString(startDate);
    const toDateStr = this.formatDateString(endDate);
    const weekKey = this.getWeekKey(startDate);
    const label = weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Last Week' : `${weekOffset} Weeks Ago`;

    // Try reading cached digest from SQLite if not current week and not forced
    if (weekOffset > 0 && !forceRefresh) {
      try {
        const stored = await digestRepository.getWeeklyDigest(weekKey);
        if (stored) {
          return {
            periodType: 'weekly',
            periodLabel: label,
            dateFrom: fromDateStr,
            dateTo: toDateStr,
            totalScreenshots: stored.screenshotCount,
            summary: stored.aiSummary,
            spending: {
              totalAmount: stored.spendingTotal,
              upiCount: 0,
            },
            shopping: { totalOrders: 0, topMerchants: [], itemsCount: 0 },
            travel: { tripsCount: 0, destinationsOrBookings: [] },
            productivity: { documentsSaved: 0, chatsCaptured: 0, codeSnippets: 0 },
            highlights: [stored.aiSummary],
          };
        }
      } catch {}
    }

    const events = await memoryTimelineService.getEventsForDateRange(fromDateStr, toDateStr);
    const digest = this.aggregatePeriodDigest(events, fromDateStr, toDateStr, label, 'weekly');
    digest.weekKey = weekKey;
    digest.totalSpending = digest.spending.totalAmount;

    // Persist to weekly_digest table
    try {
      const topCategories = Object.keys(digest.shopping.topMerchants).concat(['Finance']);
      await digestRepository.upsertWeeklyDigest({
        weekKey,
        screenshotCount: digest.totalScreenshots,
        spendingTotal: digest.spending.totalAmount,
        aiSummary: digest.summary,
        topCategoriesJson: JSON.stringify(topCategories),
        createdAt: new Date().toISOString(),
      });
    } catch {}

    return digest;
  }

  /**
   * Generates or retrieves monthly summary digest.
   * @param monthOffset 0 for current month, 1 for previous month, etc.
   */
  async getMonthlyDigest(monthOffset = 0, forceRefresh = false): Promise<PeriodDigest> {
    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth() - monthOffset;

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const fromDateStr = this.formatDateString(startDate);
    const toDateStr = this.formatDateString(endDate);
    const monthName = MONTH_NAMES[startDate.getMonth()];
    const label = `${monthName} ${startDate.getFullYear()}`;
    const monthKey = this.getMonthKey(startDate);

    // Try reading cached digest from SQLite if not current month and not forced
    if (monthOffset > 0 && !forceRefresh) {
      try {
        const stored = await digestRepository.getMonthlyDigest(monthKey);
        if (stored) {
          let insights: any = {};
          try {
            insights = JSON.parse(stored.insightsJson || '{}');
          } catch {}
          return {
            periodType: 'monthly',
            periodLabel: label,
            monthKey,
            dateFrom: fromDateStr,
            dateTo: toDateStr,
            totalScreenshots: stored.screenshotCount,
            totalSpending: stored.spendingTotal,
            summary: stored.aiSummary,
            spending: {
              totalAmount: stored.spendingTotal,
              upiCount: insights.upiCount || 0,
              topMerchant: insights.topMerchant,
            },
            shopping: { totalOrders: insights.ordersCount || 0, topMerchants: insights.topMerchants || [], itemsCount: 0 },
            travel: { tripsCount: insights.travelCount || 0, destinationsOrBookings: [] },
            productivity: { documentsSaved: insights.docsCount || 0, chatsCaptured: insights.chatsCount || 0, codeSnippets: 0 },
            highlights: [stored.aiSummary],
          };
        }
      } catch {}
    }

    const events = await memoryTimelineService.getEventsForDateRange(fromDateStr, toDateStr);
    const digest = this.aggregatePeriodDigest(events, fromDateStr, toDateStr, label, 'monthly');
    digest.monthKey = monthKey;
    digest.totalSpending = digest.spending.totalAmount;

    // Persist to monthly_digest table
    try {
      const insights = {
        topMerchant: digest.spending.topMerchant,
        topCategory: digest.spending.topCategory,
        ordersCount: digest.shopping.totalOrders,
        topMerchants: digest.shopping.topMerchants,
        travelCount: digest.travel.tripsCount,
        docsCount: digest.productivity.documentsSaved,
        chatsCount: digest.productivity.chatsCaptured,
      };

      await digestRepository.upsertMonthlyDigest({
        monthKey,
        screenshotCount: digest.totalScreenshots,
        spendingTotal: digest.spending.totalAmount,
        aiSummary: digest.summary,
        insightsJson: JSON.stringify(insights),
        createdAt: new Date().toISOString(),
      });
    } catch {}

    return digest;
  }

  /**
   * Generates annual highlights and statistics.
   */
  async getYearlyHighlights(year?: number): Promise<YearlyHighlights> {
    const targetYear = year || new Date().getFullYear();
    const fromDateStr = `${targetYear}-01-01`;
    const toDateStr = `${targetYear}-12-31`;

    const events = await memoryTimelineService.getEventsForDateRange(fromDateStr, toDateStr);

    let totalScreenshots = 0;
    let spendingTotal = 0;
    let shoppingCount = 0;
    let travelCount = 0;
    let documentsCount = 0;
    let healthCount = 0;

    let biggestPurchase: { amount: number; merchant?: string; screenshotId?: string; date?: string } | undefined;
    const categoryCounts: Record<string, number> = {};
    const categorySpend: Record<string, number> = {};
    const merchantFreq: Record<string, number> = {};
    const appFreq: Record<string, number> = {};
    const dateCountMap: Record<string, { count: number; sampleTitle: string }> = {};

    for (const evt of events) {
      const count = evt.screenshotCount || 1;
      totalScreenshots += count;

      const catName = evt.categoryName || evt.category;
      categoryCounts[catName] = (categoryCounts[catName] || 0) + count;

      if (evt.amount) {
        spendingTotal += evt.amount;
        categorySpend[catName] = (categorySpend[catName] || 0) + evt.amount;
        if (!biggestPurchase || evt.amount > biggestPurchase.amount) {
          biggestPurchase = {
            amount: evt.amount,
            merchant: evt.merchant,
            screenshotId: evt.screenshotId,
            date: evt.date,
          };
        }
      }

      if (evt.merchant) {
        merchantFreq[evt.merchant] = (merchantFreq[evt.merchant] || 0) + 1;
      }

      const app = evt.sourceApp || evt.detectedApp || evt.merchant;
      if (app) {
        appFreq[app] = (appFreq[app] || 0) + 1;
      }

      const cat = evt.category.toLowerCase();
      if (cat.includes('shop') || cat.includes('food') || cat.includes('order')) {
        shoppingCount += count;
      } else if (cat.includes('travel') || cat.includes('transit')) {
        travelCount += count;
      } else if (cat.includes('doc')) {
        documentsCount += count;
      } else if (cat.includes('health') || cat.includes('med')) {
        healthCount += count;
      }

      // Track daily activity
      if (!dateCountMap[evt.date]) {
        dateCountMap[evt.date] = { count: 0, sampleTitle: evt.title };
      }
      dateCountMap[evt.date].count += count;
    }

    // Top merchant
    let mostVisitedMerchant = 'None';
    let maxMerchantCount = 0;
    for (const [m, c] of Object.entries(merchantFreq)) {
      if (c > maxMerchantCount) {
        maxMerchantCount = c;
        mostVisitedMerchant = m;
      }
    }

    // Top category (count first, spend as tie-breaker)
    let topCategory = 'Finance & Bills';
    let maxCatScore = 0;
    for (const [c, cnt] of Object.entries(categoryCounts)) {
      const spend = categorySpend[c] || 0;
      const score = cnt * 1000000 + spend;
      if (score > maxCatScore) {
        maxCatScore = score;
        topCategory = c;
      }
    }

    // Most used app
    let mostUsedApp = 'None';
    let maxAppCount = 0;
    for (const [a, c] of Object.entries(appFreq)) {
      if (c > maxAppCount) {
        maxAppCount = c;
        mostUsedApp = a;
      }
    }

    // Most memorable day (peak screenshots)
    let mostMemorableDay = { date: '', count: 0, summary: 'No activity' };
    for (const [d, info] of Object.entries(dateCountMap)) {
      if (info.count > mostMemorableDay.count) {
        mostMemorableDay = {
          date: d,
          count: info.count,
          summary: `${info.count} screenshots captured, including ${info.sampleTitle}`,
        };
      }
    }

    // Calculate streak
    const timelineStreak = await this.calculateScreenshotStreak(true);

    // AI highlights
    const highlights: string[] = [];
    if (spendingTotal > 0) {
      highlights.push(`Total tracked spending in ${targetYear}: ₹${Math.round(spendingTotal).toLocaleString('en-IN')}`);
    }
    if (shoppingCount > 0) {
      highlights.push(`${shoppingCount} shopping orders and food receipts archived`);
    }
    if (travelCount > 0) {
      highlights.push(`${travelCount} travel memories and transit bookings recorded`);
    }
    if (documentsCount > 0) {
      highlights.push(`${documentsCount} critical documents protected`);
    }
    if (mostMemorableDay.count > 0) {
      highlights.push(`Most active day was ${mostMemorableDay.date} with ${mostMemorableDay.count} screenshots`);
    }

    return {
      year: targetYear,
      totalScreenshots,
      spendingTotal: Math.round(spendingTotal * 100) / 100,
      totalSpending: Math.round(spendingTotal * 100) / 100,
      biggestPurchase,
      topCategory,
      shoppingCount,
      travelCount,
      documentsCount,
      healthCount,
      mostVisitedMerchant,
      mostUsedApp,
      timelineStreak,
      mostMemorableDay,
      highlights,
    };
  }

  /**
   * Calculates the consecutive screenshot capture streak in days.
   */
  async calculateScreenshotStreak(forceRefresh = false): Promise<number> {
    if (!forceRefresh && this.memoryStreakCache !== null) {
      return this.memoryStreakCache;
    }

    const allEvents = await memoryTimelineService.getAllEvents(forceRefresh);
    if (allEvents.length === 0) {
      this.memoryStreakCache = 0;
      return 0;
    }

    const uniqueDates = Array.from(new Set(allEvents.map((e) => e.date))).sort().reverse();
    if (uniqueDates.length === 0) {
      this.memoryStreakCache = 0;
      return 0;
    }

    const now = new Date();
    const todayStr = this.formatDateString(now);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = this.formatDateString(yesterday);

    let streak = 0;
    let expectedDate = uniqueDates[0] === todayStr ? now : uniqueDates[0] === yesterdayStr ? yesterday : null;

    if (!expectedDate) {
      this.memoryStreakCache = 0;
      return 0;
    }

    for (const dStr of uniqueDates) {
      const expStr = this.formatDateString(expectedDate);
      if (dStr === expStr) {
        streak++;
        expectedDate = new Date(expectedDate.getTime() - 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }

    this.memoryStreakCache = streak;
    return streak;
  }

  clearCache(): void {
    this.memoryStreakCache = null;
  }

  private aggregatePeriodDigest(
    events: MemoryTimelineEvent[],
    dateFrom: string,
    dateTo: string,
    periodLabel: string,
    periodType: 'weekly' | 'monthly'
  ): PeriodDigest {
    let totalAmount = 0;
    let upiCount = 0;
    let totalScreenshots = 0;

    const merchantSpend: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const shoppingMerchants = new Set<string>();
    const travelBookings = new Set<string>();

    let totalOrders = 0;
    let tripsCount = 0;
    let docsSaved = 0;
    let chatsCount = 0;
    let codeSnippets = 0;

    let largestPurchase: { amount: number; merchant?: string; screenshotId: string; date: string } | undefined;

    for (const evt of events) {
      totalScreenshots += evt.screenshotCount || 1;
      const cat = evt.category.toLowerCase();
      const catName = evt.categoryName || evt.category;
      categoryCounts[catName] = (categoryCounts[catName] || 0) + (evt.screenshotCount || 1);

      if (evt.amount && evt.amount > 0) {
        totalAmount += evt.amount;
        upiCount++;

        if (evt.merchant) {
          merchantSpend[evt.merchant] = (merchantSpend[evt.merchant] || 0) + evt.amount;
        }

        if (!largestPurchase || evt.amount > largestPurchase.amount) {
          largestPurchase = {
            amount: evt.amount,
            merchant: evt.merchant,
            screenshotId: evt.screenshotId,
            date: evt.date,
          };
        }
      }

      if (cat.includes('shop') || cat.includes('food') || cat.includes('order')) {
        totalOrders += evt.screenshotCount || 1;
        if (evt.merchant) shoppingMerchants.add(evt.merchant);
      } else if (cat.includes('travel') || cat.includes('transit')) {
        tripsCount += evt.screenshotCount || 1;
        if (evt.merchant) travelBookings.add(evt.merchant);
      } else if (cat.includes('doc')) {
        docsSaved += evt.screenshotCount || 1;
      } else if (cat.includes('chat') || cat.includes('social')) {
        chatsCount += evt.screenshotCount || 1;
      } else if (cat.includes('code') || cat.includes('dev')) {
        codeSnippets += evt.screenshotCount || 1;
      }
    }

    // Top merchant
    let topMerchant: string | undefined;
    let maxSpend = 0;
    for (const [m, amt] of Object.entries(merchantSpend)) {
      if (amt > maxSpend) {
        maxSpend = amt;
        topMerchant = m;
      }
    }

    // Top category
    let topCategory: string | undefined;
    let maxCatCount = 0;
    for (const [c, cnt] of Object.entries(categoryCounts)) {
      if (cnt > maxCatCount) {
        maxCatCount = cnt;
        topCategory = c;
      }
    }

    const highlights: string[] = [];
    if (totalAmount > 0) {
      highlights.push(`Spent ₹${Math.round(totalAmount).toLocaleString('en-IN')}${topMerchant ? ` (top: ${topMerchant})` : ''}`);
    }
    if (totalOrders > 0) {
      highlights.push(`${totalOrders} orders / shopping screenshots`);
    }
    if (tripsCount > 0) {
      highlights.push(`${tripsCount} travel bookings & tickets`);
    }
    if (docsSaved > 0) {
      highlights.push(`${docsSaved} documents archived`);
    }

    const summary = totalScreenshots > 0
      ? `${totalScreenshots} screenshots organized in ${periodLabel}${topCategory ? ` with most activity in ${topCategory}` : ''}.`
      : `No screenshots recorded for ${periodLabel}.`;

    return {
      periodType,
      periodLabel,
      dateFrom,
      dateTo,
      totalScreenshots,
      summary,
      spending: {
        totalAmount: Math.round(totalAmount * 100) / 100,
        upiCount,
        topMerchant,
        topCategory,
        largestPurchase,
      },
      shopping: {
        totalOrders,
        topMerchants: Array.from(shoppingMerchants),
        itemsCount: totalOrders,
      },
      travel: {
        tripsCount,
        destinationsOrBookings: Array.from(travelBookings),
      },
      productivity: {
        documentsSaved: docsSaved,
        chatsCaptured: chatsCount,
        codeSnippets,
      },
      highlights,
    };
  }

  private getWeekKey(d: Date): string {
    const year = d.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const dayOfYear = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((dayOfYear + oneJan.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  }

  private getMonthKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
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

export const digestAggregationService = new DigestAggregationService();

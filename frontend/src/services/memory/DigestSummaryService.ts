import { memoryTimelineService } from './MemoryTimelineService';
import { PeriodDigest, MemoryTimelineEvent } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class DigestSummaryService {
  private periodCache: Map<string, PeriodDigest> = new Map();

  /**
   * Generates weekly summary digest.
   * @param weekOffset 0 for current week, 1 for previous week, etc.
   */
  async getWeeklyDigest(weekOffset = 0): Promise<PeriodDigest> {
    const now = new Date();
    const endDaysAgo = weekOffset * 7;
    const startDaysAgo = endDaysAgo + 7;

    const endDate = new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000);
    const startDate = new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000);

    const fromDateStr = this.formatDateString(startDate);
    const toDateStr = this.formatDateString(endDate);
    const label = weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Last Week' : `${weekOffset} Weeks Ago`;

    return this.getDigestForRange(fromDateStr, toDateStr, label, 'weekly');
  }

  /**
   * Generates monthly summary digest.
   * @param monthOffset 0 for current month, 1 for previous month, etc.
   */
  async getMonthlyDigest(monthOffset = 0): Promise<PeriodDigest> {
    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth() - monthOffset;

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const fromDateStr = this.formatDateString(startDate);
    const toDateStr = this.formatDateString(endDate);
    const monthName = MONTH_NAMES[startDate.getMonth()];
    const label = `${monthName} ${startDate.getFullYear()}`;

    return this.getDigestForRange(fromDateStr, toDateStr, label, 'monthly');
  }

  /**
   * Generates a PeriodDigest for any specified range.
   */
  async getDigestForRange(
    fromDate: string,
    toDate: string,
    label: string,
    periodType: 'weekly' | 'monthly'
  ): Promise<PeriodDigest> {
    const cacheKey = `${periodType}_${fromDate}_${toDate}`;
    if (this.periodCache.has(cacheKey)) {
      return this.periodCache.get(cacheKey)!;
    }

    const events = await memoryTimelineService.getEventsForDateRange(fromDate, toDate);

    let totalSpending = 0;
    let upiCount = 0;
    const merchantSpending: Record<string, number> = {};
    const categorySpending: Record<string, number> = {};
    let largestPurchase: { amount: number; merchant?: string; screenshotId: string; date: string } | undefined;

    let totalOrders = 0;
    const orderMerchants: Record<string, number> = {};

    let tripsCount = 0;
    const travelBookings = new Set<string>();

    let documentsSaved = 0;
    let chatsCaptured = 0;
    let codeSnippets = 0;

    for (const evt of events) {
      const cat = evt.category.toLowerCase();
      const tags = evt.tags.map((t) => t.toLowerCase());

      // 1. Spending
      if (evt.amount && evt.amount > 0) {
        totalSpending += evt.amount;
        upiCount++;

        const mName = evt.merchant || 'Other';
        merchantSpending[mName] = (merchantSpending[mName] || 0) + evt.amount;

        const cName = evt.categoryName || 'General';
        categorySpending[cName] = (categorySpending[cName] || 0) + evt.amount;

        if (!largestPurchase || evt.amount > largestPurchase.amount) {
          largestPurchase = {
            amount: evt.amount,
            merchant: evt.merchant,
            screenshotId: evt.screenshotId,
            date: evt.date,
          };
        }
      }

      // 2. Shopping
      if (
        cat.includes('shopping') ||
        cat.includes('food') ||
        ['Amazon', 'Flipkart', 'Swiggy', 'Zomato', 'Myntra', 'Meesho', 'Zepto', 'Blinkit'].includes(evt.merchant || '')
      ) {
        totalOrders++;
        if (evt.merchant) {
          orderMerchants[evt.merchant] = (orderMerchants[evt.merchant] || 0) + 1;
        }
      }

      // 3. Travel
      if (
        cat.includes('travel') ||
        tags.includes('ticket') ||
        tags.includes('flight') ||
        ['IRCTC', 'MakeMyTrip', 'Uber', 'Ola'].includes(evt.merchant || '')
      ) {
        tripsCount++;
        if (evt.merchant) travelBookings.add(evt.merchant);
      }

      // 4. Productivity
      if (cat.includes('doc') || tags.includes('id')) {
        documentsSaved++;
      } else if (cat.includes('chat') || cat.includes('social')) {
        chatsCaptured++;
      } else if (cat.includes('code') || cat.includes('dev')) {
        codeSnippets++;
      }
    }

    // Top merchant by spend
    const sortedMerchants = Object.entries(merchantSpending).sort((a, b) => b[1] - a[1]);
    const topMerchant = sortedMerchants.length > 0 ? sortedMerchants[0][0] : undefined;

    // Top category by spend
    const sortedCategories = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : undefined;

    // Top shopping merchants
    const topShoppingMerchants = Object.entries(orderMerchants)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m]) => m);

    // Build Highlights
    const highlights: string[] = [];
    if (totalSpending > 0) {
      highlights.push(`Total tracked spend: ₹${totalSpending.toLocaleString('en-IN')} (${upiCount} transactions)`);
      if (largestPurchase) {
        highlights.push(`Largest purchase: ₹${largestPurchase.amount.toLocaleString('en-IN')}${largestPurchase.merchant ? ` on ${largestPurchase.merchant}` : ''}`);
      }
    }
    if (totalOrders > 0) {
      highlights.push(`${totalOrders} orders across ${topShoppingMerchants.join(', ') || 'e-commerce stores'}`);
    }
    if (tripsCount > 0) {
      highlights.push(`${tripsCount} travel bookings & trips`);
    }
    if (documentsSaved > 0 || chatsCaptured > 0) {
      highlights.push(`${documentsSaved} documents saved & ${chatsCaptured} conversations preserved`);
    }

    // Natural language summary
    const summary = this.buildPeriodSummary({
      label,
      totalScreenshots: events.length,
      totalSpending,
      upiCount,
      topMerchant,
      totalOrders,
      tripsCount,
      documentsSaved,
      chatsCaptured,
    });

    const result: PeriodDigest = {
      periodType,
      periodLabel: label,
      dateFrom: fromDate,
      dateTo: toDate,
      totalScreenshots: events.length,
      summary,
      spending: {
        totalAmount: totalSpending,
        upiCount,
        topMerchant,
        topCategory,
        largestPurchase,
      },
      shopping: {
        totalOrders,
        topMerchants: topShoppingMerchants,
        itemsCount: totalOrders,
      },
      travel: {
        tripsCount,
        destinationsOrBookings: Array.from(travelBookings),
      },
      productivity: {
        documentsSaved,
        chatsCaptured,
        codeSnippets,
      },
      highlights,
    };

    this.periodCache.set(cacheKey, result);
    return result;
  }

  private buildPeriodSummary(params: {
    label: string;
    totalScreenshots: number;
    totalSpending: number;
    upiCount: number;
    topMerchant?: string;
    totalOrders: number;
    tripsCount: number;
    documentsSaved: number;
    chatsCaptured: number;
  }): string {
    if (params.totalScreenshots === 0) {
      return `No screenshots recorded during ${params.label}.`;
    }

    const segments: string[] = [];

    if (params.totalSpending > 0) {
      let spendText = `₹${params.totalSpending.toLocaleString('en-IN')} spent across ${params.upiCount} transactions`;
      if (params.topMerchant) {
        spendText += ` (mostly ${params.topMerchant})`;
      }
      segments.push(spendText);
    }

    if (params.totalOrders > 0) {
      segments.push(`${params.totalOrders} shopping & food order${params.totalOrders > 1 ? 's' : ''}`);
    }

    if (params.tripsCount > 0) {
      segments.push(`${params.tripsCount} travel ticket${params.tripsCount > 1 ? 's' : ''}`);
    }

    if (params.documentsSaved > 0) {
      segments.push(`${params.documentsSaved} document${params.documentsSaved > 1 ? 's' : ''}`);
    }

    if (segments.length === 0) {
      return `${params.label}: ${params.totalScreenshots} screenshots archived and organized in smart folders.`;
    }

    return `${params.label} Recap: ${segments.join(', ')}.`;
  }

  private formatDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

export const digestSummaryService = new DigestSummaryService();

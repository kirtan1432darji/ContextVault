import { memoryTimelineService } from './MemoryTimelineService';
import { FinanceInsights } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class FinanceInsightService {
  /**
   * Calculates comprehensive spending and finance insights from SQLite metadata.
   */
  async getSpendingInsights(): Promise<FinanceInsights> {
    const events = await memoryTimelineService.getAllEvents();

    let totalUpiSpending = 0;
    let upiTransactionCount = 0;
    const merchantMap: Record<string, { amount: number; count: number }> = {};
    const categoryMap: Record<string, { amount: number; count: number }> = {};
    const monthMap: Record<string, { amount: number; count: number; orderTime: number }> = {};

    let largestPurchase: {
      amount: number;
      merchant?: string;
      date: string;
      screenshotId: string;
      thumbnailUri?: string;
      filePath?: string;
    } | null = null;

    for (const evt of events) {
      if (evt.amount && evt.amount > 0) {
        totalUpiSpending += evt.amount;
        upiTransactionCount++;

        // Merchant stats
        const m = evt.merchant || 'Other Merchants';
        if (!merchantMap[m]) merchantMap[m] = { amount: 0, count: 0 };
        merchantMap[m].amount += evt.amount;
        merchantMap[m].count++;

        // Category stats
        const c = evt.categoryName || 'Finance';
        if (!categoryMap[c]) categoryMap[c] = { amount: 0, count: 0 };
        categoryMap[c].amount += evt.amount;
        categoryMap[c].count++;

        // Monthly trend stats
        const d = new Date(evt.timestamp);
        const monthKey = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        const monthOrder = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

        if (!monthMap[monthKey]) {
          monthMap[monthKey] = { amount: 0, count: 0, orderTime: monthOrder };
        }
        monthMap[monthKey].amount += evt.amount;
        monthMap[monthKey].count++;

        // Largest purchase check
        if (!largestPurchase || evt.amount > largestPurchase.amount) {
          largestPurchase = {
            amount: evt.amount,
            merchant: evt.merchant,
            date: evt.date,
            screenshotId: evt.screenshotId,
            thumbnailUri: evt.thumbnailUri,
            filePath: evt.filePath,
          };
        }
      }
    }

    // Sort top merchants by amount descending
    const topMerchants = Object.entries(merchantMap)
      .map(([merchant, stats]) => ({
        merchant,
        amount: stats.amount,
        count: stats.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate category percentages
    const categorySpending = Object.entries(categoryMap)
      .map(([category, stats]) => ({
        category,
        amount: stats.amount,
        count: stats.count,
        percentage: totalUpiSpending > 0 ? Math.round((stats.amount / totalUpiSpending) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Sort monthly trend chronologically (oldest to newest)
    const monthlySpendingTrend = Object.entries(monthMap)
      .sort((a, b) => a[1].orderTime - b[1].orderTime)
      .map(([month, stats]) => ({
        month,
        amount: stats.amount,
        count: stats.count,
      }));

    const averageTransaction =
      upiTransactionCount > 0 ? Math.round(totalUpiSpending / upiTransactionCount) : 0;

    return {
      totalUpiSpending,
      upiTransactionCount,
      topMerchants,
      categorySpending,
      monthlySpendingTrend,
      averageTransaction,
      largestPurchase,
    };
  }

  /**
   * Helper to get top merchants with optional limit.
   */
  async getTopMerchants(limit = 5): Promise<{ merchant: string; amount: number; count: number }[]> {
    const insights = await this.getSpendingInsights();
    return insights.topMerchants.slice(0, limit);
  }

  /**
   * Helper to get category spending breakdown.
   */
  async getCategoryBreakdown(): Promise<
    { category: string; amount: number; count: number; percentage: number }[]
  > {
    const insights = await this.getSpendingInsights();
    return insights.categorySpending;
  }

  /**
   * Helper to get monthly spending trend.
   */
  async getMonthlyTrend(): Promise<{ month: string; amount: number; count: number }[]> {
    const insights = await this.getSpendingInsights();
    return insights.monthlySpendingTrend;
  }
}

export const financeInsightService = new FinanceInsightService();

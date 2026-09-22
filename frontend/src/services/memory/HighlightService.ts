import { memoryTimelineService } from './MemoryTimelineService';
import { MemoryHighlight, MemoryTimelineEvent } from './types';

export class HighlightService {
  /**
   * Generates grounded AI memory highlights from SQLite screenshot metadata.
   */
  async getHighlights(): Promise<MemoryHighlight[]> {
    const events = await memoryTimelineService.getAllEvents();
    if (events.length === 0) return [];

    const highlights: MemoryHighlight[] = [];
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // 1. Biggest purchase this month
    let biggestPurchaseThisMonth: MemoryTimelineEvent | null = null;
    for (const e of events) {
      if (e.amount && e.amount > 0 && e.timestamp >= currentMonthStart) {
        if (!biggestPurchaseThisMonth || e.amount > (biggestPurchaseThisMonth.amount || 0)) {
          biggestPurchaseThisMonth = e;
        }
      }
    }

    if (biggestPurchaseThisMonth && biggestPurchaseThisMonth.amount) {
      highlights.push({
        id: 'hl_biggest_purchase',
        type: 'biggest_purchase',
        title: 'Biggest Purchase This Month',
        subtitle: biggestPurchaseThisMonth.merchant
          ? `${biggestPurchaseThisMonth.merchant} • ${biggestPurchaseThisMonth.date}`
          : biggestPurchaseThisMonth.date,
        value: `₹${biggestPurchaseThisMonth.amount.toLocaleString('en-IN')}`,
        date: biggestPurchaseThisMonth.date,
        screenshotId: biggestPurchaseThisMonth.screenshotId,
        thumbnailUri: biggestPurchaseThisMonth.thumbnailUri,
        filePath: biggestPurchaseThisMonth.filePath,
      });
    }

    // 2. Most visited merchant
    const merchantCounts: Record<string, { count: number; totalAmount: number; sample: MemoryTimelineEvent }> = {};
    for (const e of events) {
      if (e.merchant && e.merchant !== 'Other Merchants' && e.merchant !== 'General') {
        if (!merchantCounts[e.merchant]) {
          merchantCounts[e.merchant] = { count: 0, totalAmount: 0, sample: e };
        }
        merchantCounts[e.merchant].count++;
        if (e.amount) merchantCounts[e.merchant].totalAmount += e.amount;
      }
    }

    const sortedMerchants = Object.entries(merchantCounts).sort((a, b) => b[1].count - a[1].count);
    if (sortedMerchants.length > 0 && sortedMerchants[0][1].count > 1) {
      const [topName, data] = sortedMerchants[0];
      highlights.push({
        id: 'hl_top_merchant',
        type: 'most_visited_merchant',
        title: 'Most Visited Merchant',
        subtitle: data.totalAmount > 0 ? `Total ₹${data.totalAmount.toLocaleString('en-IN')} spent` : `${data.count} interactions recorded`,
        value: `${topName} (${data.count}x)`,
        date: data.sample.date,
        screenshotId: data.sample.screenshotId,
        thumbnailUri: data.sample.thumbnailUri,
        filePath: data.sample.filePath,
      });
    }

    // 3. Most active app
    const appCounts: Record<string, { count: number; sample: MemoryTimelineEvent }> = {};
    for (const e of events) {
      const app = e.detectedApp || e.sourceApp || (e.tags.includes('chat') ? 'WhatsApp' : undefined);
      if (app) {
        if (!appCounts[app]) appCounts[app] = { count: 0, sample: e };
        appCounts[app].count++;
      }
    }

    const sortedApps = Object.entries(appCounts).sort((a, b) => b[1].count - a[1].count);
    if (sortedApps.length > 0 && sortedApps[0][1].count > 1) {
      const [topApp, data] = sortedApps[0];
      highlights.push({
        id: 'hl_top_app',
        type: 'most_active_app',
        title: 'Most Active App',
        subtitle: `${data.count} screenshots captured from ${topApp}`,
        value: `${topApp}`,
        date: data.sample.date,
        screenshotId: data.sample.screenshotId,
        thumbnailUri: data.sample.thumbnailUri,
        filePath: data.sample.filePath,
      });
    }

    // 4. Most screenshots in one day
    const dayCounts: Record<string, { count: number; sample: MemoryTimelineEvent }> = {};
    for (const e of events) {
      if (!dayCounts[e.date]) dayCounts[e.date] = { count: 0, sample: e };
      dayCounts[e.date].count++;
    }

    const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1].count - a[1].count);
    if (sortedDays.length > 0 && sortedDays[0][1].count > 1) {
      const [dayStr, data] = sortedDays[0];
      highlights.push({
        id: 'hl_peak_day',
        type: 'most_screenshots_day',
        title: 'Peak Memory Day',
        subtitle: `Highest screenshot volume recorded on this date`,
        value: `${data.count} screenshots on ${dayStr}`,
        date: dayStr,
        screenshotId: data.sample.screenshotId,
        thumbnailUri: data.sample.thumbnailUri,
        filePath: data.sample.filePath,
      });
    }

    // 5. Travel memory
    const travelEvent = events.find(
      (e) =>
        e.category.includes('travel') ||
        e.tags.includes('ticket') ||
        e.tags.includes('flight') ||
        ['IRCTC', 'MakeMyTrip', 'Uber', 'Ola'].includes(e.merchant || '')
    );
    if (travelEvent) {
      highlights.push({
        id: 'hl_travel',
        type: 'travel_memory',
        title: 'Travel Memory',
        subtitle: travelEvent.summary,
        value: travelEvent.merchant || 'Trip Booking',
        date: travelEvent.date,
        screenshotId: travelEvent.screenshotId,
        thumbnailUri: travelEvent.thumbnailUri,
        filePath: travelEvent.filePath,
      });
    }

    // 6. Shopping memory
    const shoppingEvent = events.find(
      (e) =>
        e.category.includes('shopping') ||
        ['Amazon', 'Flipkart', 'Myntra', 'Meesho'].includes(e.merchant || '')
    );
    if (shoppingEvent) {
      highlights.push({
        id: 'hl_shopping',
        type: 'shopping_memory',
        title: 'Shopping Memory',
        subtitle: shoppingEvent.summary,
        value: shoppingEvent.merchant || 'Online Order',
        date: shoppingEvent.date,
        screenshotId: shoppingEvent.screenshotId,
        thumbnailUri: shoppingEvent.thumbnailUri,
        filePath: shoppingEvent.filePath,
      });
    }

    return highlights;
  }
}

export const highlightService = new HighlightService();

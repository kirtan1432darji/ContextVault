import { memoryTimelineService } from './MemoryTimelineService';
import { MerchantTimelineItem, MemoryTimelineEvent } from './types';

export class MerchantTimelineService {
  /**
   * Retrieves the full chronological timeline for a specific merchant.
   */
  async getMerchantTimeline(merchantName: string): Promise<MerchantTimelineItem | null> {
    if (!merchantName) return null;
    const cleanTarget = merchantName.trim().toLowerCase();

    const events = await memoryTimelineService.getAllEvents();
    const matchedEvents = events.filter((e) => {
      if (e.merchant && e.merchant.toLowerCase().includes(cleanTarget)) return true;
      if (e.title.toLowerCase().includes(cleanTarget)) return true;
      if (e.summary.toLowerCase().includes(cleanTarget)) return true;
      return false;
    });

    if (matchedEvents.length === 0) return null;

    let totalSpent = 0;
    for (const e of matchedEvents) {
      if (e.amount) totalSpent += e.amount;
    }

    // Sort chronologically descending
    matchedEvents.sort((a, b) => b.timestamp - a.timestamp);

    const firstSeenDate = matchedEvents[matchedEvents.length - 1].date;
    const lastSeenDate = matchedEvents[0].date;
    const canonicalMerchantName = matchedEvents[0].merchant || merchantName;

    return {
      merchant: canonicalMerchantName,
      totalSpent,
      transactionCount: matchedEvents.length,
      firstSeenDate,
      lastSeenDate,
      history: matchedEvents,
    };
  }

  /**
   * Aggregates history for all distinct merchants discovered in screenshots.
   */
  async getAllMerchants(): Promise<MerchantTimelineItem[]> {
    const events = await memoryTimelineService.getAllEvents();
    const merchantGroups: Record<string, MemoryTimelineEvent[]> = {};

    for (const evt of events) {
      if (evt.merchant && evt.merchant !== 'Other Merchants' && evt.merchant !== 'General') {
        const m = evt.merchant;
        if (!merchantGroups[m]) merchantGroups[m] = [];
        merchantGroups[m].push(evt);
      }
    }

    const items: MerchantTimelineItem[] = [];

    for (const [merchant, history] of Object.entries(merchantGroups)) {
      history.sort((a, b) => b.timestamp - a.timestamp);
      let totalSpent = 0;
      for (const e of history) {
        if (e.amount) totalSpent += e.amount;
      }

      items.push({
        merchant,
        totalSpent,
        transactionCount: history.length,
        firstSeenDate: history[history.length - 1].date,
        lastSeenDate: history[0].date,
        history,
      });
    }

    // Sort merchants by total spend descending, then by transaction count descending
    items.sort((a, b) => {
      if (b.totalSpent !== a.totalSpent) return b.totalSpent - a.totalSpent;
      return b.transactionCount - a.transactionCount;
    });

    return items;
  }

  /**
   * Returns top merchants ranked by activity and spend.
   */
  async getTopMerchants(limit = 10): Promise<MerchantTimelineItem[]> {
    const all = await this.getAllMerchants();
    return all.slice(0, limit);
  }
}

export const merchantTimelineService = new MerchantTimelineService();

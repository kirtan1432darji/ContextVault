import { memoryTimelineService } from './MemoryTimelineService';
import { InsightDomainCard, InsightDomain, MemoryTimelineEvent } from './types';

export class MemoryInsightsService {
  private cachedInsights: InsightDomainCard[] | null = null;
  private lastRefreshedAt: string | null = null;

  /**
   * Retrieves all 6 domain insight cards.
   * Cached in memory for near-instant rendering.
   */
  async getAllInsights(forceRefresh = false): Promise<InsightDomainCard[]> {
    if (!forceRefresh && this.cachedInsights) {
      return this.cachedInsights;
    }

    const events = await memoryTimelineService.getAllEvents();
    const insights: InsightDomainCard[] = [
      this.buildSpendingInsight(events),
      this.buildShoppingInsight(events),
      this.buildProductivityInsight(events),
      this.buildTravelInsight(events),
      this.buildHealthInsight(events),
      this.buildCommunicationInsight(events),
    ];

    this.cachedInsights = insights;
    this.lastRefreshedAt = new Date().toISOString();
    return insights;
  }

  /**
   * Refreshes the memory insights cache.
   */
  async refreshMemoryInsights(): Promise<InsightDomainCard[]> {
    return this.getAllInsights(true);
  }

  /**
   * Retrieves a specific domain insight card by domain name.
   */
  async getInsightDomain(domain: InsightDomain, forceRefresh = false): Promise<InsightDomainCard | null> {
    const cards = await this.getAllInsights(forceRefresh);
    return cards.find((c) => c.domain === domain) || null;
  }

  clearCache(): void {
    this.cachedInsights = null;
    this.lastRefreshedAt = null;
  }

  /**
   * Alias for refreshMemoryInsights.
   */
  async refreshInsights(): Promise<InsightDomainCard[]> {
    return this.refreshMemoryInsights();
  }

  // --- Domain Insight Builders ---

  private buildSpendingInsight(events: MemoryTimelineEvent[]): InsightDomainCard {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let thisMonthSpending = 0;
    let allTimeSpending = 0;
    const merchantMap: Record<string, { amount: number; count: number }> = {};

    for (const evt of events) {
      if (evt.amount && evt.amount > 0) {
        allTimeSpending += evt.amount;

        const d = new Date(evt.timestamp);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          thisMonthSpending += evt.amount;
        }

        const m = evt.merchant || 'Other Merchants';
        if (!merchantMap[m]) merchantMap[m] = { amount: 0, count: 0 };
        merchantMap[m].amount += evt.amount;
        merchantMap[m].count++;
      }
    }

    const sortedMerchants = Object.entries(merchantMap)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 3);

    const items = sortedMerchants.map(([m, data]) => ({
      label: m,
      value: `₹${Math.round(data.amount).toLocaleString('en-IN')}`,
      extra: `${data.count} transaction${data.count > 1 ? 's' : ''}`,
    }));

    const highlights: string[] = [];
    if (thisMonthSpending > 0) {
      highlights.push(`Spent ₹${Math.round(thisMonthSpending).toLocaleString('en-IN')} this month.`);
    }
    if (sortedMerchants.length > 0) {
      const topNames = sortedMerchants.map(([m]) => m).join(', ');
      highlights.push(`Top merchants: ${topNames}.`);
    }

    return {
      domain: 'spending',
      title: 'Spending & Finance',
      subtitle: sortedMerchants.length > 0 ? `Top: ${sortedMerchants[0][0]}` : 'Track UPI & Card Spends',
      primaryMetric: `₹${Math.round(thisMonthSpending || allTimeSpending).toLocaleString('en-IN')}`,
      secondaryMetric: thisMonthSpending > 0 ? 'this month' : 'total tracked',
      icon: 'wallet-outline',
      color: '#10B981',
      items,
      highlights,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildShoppingInsight(events: MemoryTimelineEvent[]): InsightDomainCard {
    const shoppingEvents = events.filter((e) => {
      const cat = e.category.toLowerCase();
      const m = (e.merchant || '').toLowerCase();
      return (
        cat.includes('shop') ||
        cat.includes('food') ||
        cat.includes('order') ||
        ['amazon', 'flipkart', 'myntra', 'swiggy', 'zomato', 'meesho', 'zepto', 'blinkit'].some((app) => m.includes(app))
      );
    });

    const storeFreq: Record<string, number> = {};
    let orderCount = 0;

    for (const evt of shoppingEvents) {
      const count = evt.screenshotCount || 1;
      orderCount += count;
      const store = evt.merchant || 'Online Store';
      storeFreq[store] = (storeFreq[store] || 0) + count;
    }

    const topStores = Object.entries(storeFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const items = topStores.map(([store, count]) => ({
      label: store,
      value: `${count} orders`,
    }));

    const highlights: string[] = [];
    if (orderCount > 0) {
      highlights.push(`${orderCount} purchases and orders archived.`);
    }
    if (topStores.length > 0) {
      highlights.push(`Frequent stores: ${topStores.map(([s]) => s).join(', ')}.`);
    }

    return {
      domain: 'shopping',
      title: 'Shopping & Orders',
      subtitle: topStores.length > 0 ? `${topStores[0][0]} & more` : 'Track Order Receipts',
      primaryMetric: `${orderCount} Orders`,
      secondaryMetric: 'tracked',
      icon: 'cart-outline',
      color: '#F59E0B',
      items,
      highlights,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildProductivityInsight(events: MemoryTimelineEvent[]): InsightDomainCard {
    let workCount = 0;
    let gitHubCount = 0;
    let jiraCount = 0;
    let docsCount = 0;

    for (const evt of events) {
      const cat = evt.category.toLowerCase();
      const tags = evt.tags.map((t) => t.toLowerCase());
      const text = (evt.summary + ' ' + (evt.sourceApp || '') + ' ' + (evt.detectedApp || '')).toLowerCase();

      const count = evt.screenshotCount || 1;

      if (cat.includes('work') || cat.includes('code') || cat.includes('productivity') || cat.includes('doc')) {
        workCount += count;
      }
      if (text.includes('github') || tags.includes('github')) {
        gitHubCount += count;
        workCount += count;
      }
      if (text.includes('jira') || tags.includes('jira')) {
        jiraCount += count;
        workCount += count;
      }
      if (cat.includes('doc') || tags.includes('id') || tags.includes('pdf')) {
        docsCount += count;
      }
    }

    const items = [
      { label: 'Work Screenshots', value: `${workCount}` },
      { label: 'GitHub Activity', value: `${gitHubCount}` },
      { label: 'Jira / Tasks', value: `${jiraCount}` },
    ].filter((i) => parseInt(i.value, 10) > 0);

    const highlights: string[] = [];
    if (workCount > 0) highlights.push(`${workCount} work screenshots captured.`);
    if (gitHubCount > 0) highlights.push(`${gitHubCount} GitHub screenshots.`);
    if (jiraCount > 0) highlights.push(`${jiraCount} Jira task screenshots.`);

    return {
      domain: 'productivity',
      title: 'Productivity & Work',
      subtitle: 'Code, tasks & docs',
      primaryMetric: `${workCount || docsCount} Items`,
      secondaryMetric: 'productive',
      icon: 'briefcase-outline',
      color: '#3B82F6',
      items: items.length > 0 ? items : [{ label: 'Work items', value: `${workCount}` }],
      highlights,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildTravelInsight(events: MemoryTimelineEvent[]): InsightDomainCard {
    const travelEvents = events.filter((e) => {
      const cat = e.category.toLowerCase();
      const tags = e.tags.map((t) => t.toLowerCase());
      const m = (e.merchant || '').toLowerCase();
      return (
        cat.includes('travel') ||
        cat.includes('transit') ||
        tags.includes('flight') ||
        tags.includes('ticket') ||
        tags.includes('pnr') ||
        ['irctc', 'makemytrip', 'uber', 'ola', 'indigo', 'air india'].some((app) => m.includes(app))
      );
    });

    const bookingFreq: Record<string, number> = {};
    let travelCount = 0;

    for (const evt of travelEvents) {
      const count = evt.screenshotCount || 1;
      travelCount += count;
      const provider = evt.merchant || 'Travel Booking';
      bookingFreq[provider] = (bookingFreq[provider] || 0) + count;
    }

    const items = Object.entries(bookingFreq)
      .slice(0, 3)
      .map(([b, cnt]) => ({
        label: b,
        value: `${cnt} trips`,
      }));

    const highlights: string[] = [];
    if (travelCount > 0) highlights.push(`${travelCount} travel bookings & tickets.`);

    return {
      domain: 'travel',
      title: 'Travel & Trips',
      subtitle: items.length > 0 ? items[0].label : 'Flights, trains & cabs',
      primaryMetric: `${travelCount} Trips`,
      secondaryMetric: 'booked',
      icon: 'airplane-outline',
      color: '#06B6D4',
      items,
      highlights,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildHealthInsight(events: MemoryTimelineEvent[]): InsightDomainCard {
    let prescriptionCount = 0;
    let diagnosticCount = 0;
    let totalHealth = 0;

    for (const evt of events) {
      const cat = evt.category.toLowerCase();
      const tags = evt.tags.map((t) => t.toLowerCase());
      const title = (evt.title + ' ' + evt.summary).toLowerCase();
      const count = evt.screenshotCount || 1;

      if (cat.includes('health') || tags.includes('medical') || tags.includes('doctor')) {
        totalHealth += count;
        if (title.includes('prescription') || tags.includes('prescription')) {
          prescriptionCount += count;
        } else if (title.includes('report') || title.includes('lab') || title.includes('diagnostic')) {
          diagnosticCount += count;
        }
      }
    }

    const items = [
      { label: 'Prescriptions', value: `${prescriptionCount}` },
      { label: 'Diagnostic Reports', value: `${diagnosticCount}` },
    ].filter((i) => parseInt(i.value, 10) > 0);

    const highlights: string[] = [];
    if (prescriptionCount > 0) highlights.push(`${prescriptionCount} prescriptions saved.`);
    if (diagnosticCount > 0) highlights.push(`${diagnosticCount} diagnostic reports.`);

    return {
      domain: 'health',
      title: 'Health & Medical',
      subtitle: 'Prescriptions & lab tests',
      primaryMetric: `${totalHealth} Records`,
      secondaryMetric: 'medical',
      icon: 'fitness-outline',
      color: '#EC4899',
      items: items.length > 0 ? items : [{ label: 'Medical reports', value: `${totalHealth}` }],
      highlights,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildCommunicationInsight(events: MemoryTimelineEvent[]): InsightDomainCard {
    let whatsAppCount = 0;
    let telegramCount = 0;
    let totalChats = 0;

    for (const evt of events) {
      const cat = evt.category.toLowerCase();
      const app = (evt.sourceApp || evt.detectedApp || evt.merchant || '').toLowerCase();
      const count = evt.screenshotCount || 1;

      if (cat.includes('chat') || cat.includes('social') || cat.includes('message')) {
        totalChats += count;
        if (app.includes('whatsapp')) {
          whatsAppCount += count;
        } else if (app.includes('telegram')) {
          telegramCount += count;
        }
      }
    }

    const items = [
      { label: 'WhatsApp', value: `${whatsAppCount}` },
      { label: 'Telegram', value: `${telegramCount}` },
    ].filter((i) => parseInt(i.value, 10) > 0);

    const highlights: string[] = [];
    if (whatsAppCount > 0) highlights.push(`${whatsAppCount} WhatsApp screenshots.`);
    if (totalChats > 0) highlights.push(`${totalChats} total chat memories saved.`);

    return {
      domain: 'communication',
      title: 'Communication',
      subtitle: 'WhatsApp & chats',
      primaryMetric: `${totalChats} Chats`,
      secondaryMetric: 'captured',
      icon: 'chatbubble-ellipses-outline',
      color: '#8B5CF6',
      items: items.length > 0 ? items : [{ label: 'Chats', value: `${totalChats}` }],
      highlights,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const memoryInsightsService = new MemoryInsightsService();

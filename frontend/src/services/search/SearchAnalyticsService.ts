import { databaseService } from '../../database';

export interface SearchAnalyticsData {
  totalSearches: number;
  averageLatencyMs: number;
  successRate: number; // percentage 0 - 100
  topMerchants: { name: string; count: number }[];
  topCategories: { name: string; count: number }[];
  lastSearchAt: string | null;
}

export interface SearchLogItem {
  id: string;
  query: string;
  resultCount: number;
  latencyMs: number;
  category?: string;
  merchant?: string;
  createdAt: string;
}

export class SearchAnalyticsService {
  private memoryLogs: SearchLogItem[] = [];
  private tableChecked = false;

  private async ensureTable(): Promise<void> {
    if (this.tableChecked) return;
    try {
      await databaseService.executeCommand(`
        CREATE TABLE IF NOT EXISTS search_analytics (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          result_count INTEGER DEFAULT 0,
          latency_ms INTEGER DEFAULT 0,
          category TEXT,
          merchant TEXT,
          created_at TEXT NOT NULL
        )
      `);
      this.tableChecked = true;
    } catch {
      // Ignore if table creation fails in mock environments
    }
  }

  /**
   * Records an on-device search query execution with latency and result count.
   */
  async recordSearch(
    query: string,
    resultCount: number,
    latencyMs: number,
    category?: string,
    merchant?: string
  ): Promise<void> {
    const trimmed = (query || '').trim();
    if (!trimmed) return;

    const id = `slog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const item: SearchLogItem = {
      id,
      query: trimmed,
      resultCount,
      latencyMs: Math.max(1, Math.round(latencyMs)),
      category,
      merchant,
      createdAt: now,
    };

    // Keep in-memory cache for fast sync calculations
    this.memoryLogs.unshift(item);
    if (this.memoryLogs.length > 100) {
      this.memoryLogs.pop();
    }

    try {
      await this.ensureTable();
      await databaseService.executeCommand(
        `INSERT INTO search_analytics (id, query, result_count, latency_ms, category, merchant, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, trimmed, resultCount, item.latencyMs, category || null, merchant || null, now]
      );
    } catch {
      // In-memory fallback handles logging gracefully
    }
  }

  /**
   * Calculates on-device search metrics and insights.
   */
  async getAnalytics(): Promise<SearchAnalyticsData> {
    try {
      await this.ensureTable();
      const rows = await databaseService.executeQuery(
        `SELECT query, result_count, latency_ms, category, merchant, created_at
         FROM search_analytics
         ORDER BY created_at DESC
         LIMIT 200`
      );

      if (rows && rows.length > 0) {
        return this.computeMetrics(
          rows.map((r: any) => ({
            id: '',
            query: r.query,
            resultCount: r.result_count ?? 0,
            latencyMs: r.latency_ms ?? 0,
            category: r.category,
            merchant: r.merchant,
            createdAt: r.created_at,
          }))
        );
      }
    } catch {
      // Fallback to in-memory
    }

    return this.computeMetrics(this.memoryLogs);
  }

  private computeMetrics(logs: SearchLogItem[]): SearchAnalyticsData {
    if (logs.length === 0) {
      return {
        totalSearches: 0,
        averageLatencyMs: 0,
        successRate: 100,
        topMerchants: [],
        topCategories: [],
        lastSearchAt: null,
      };
    }

    const totalSearches = logs.length;
    const totalLatency = logs.reduce((acc, curr) => acc + curr.latencyMs, 0);
    const averageLatencyMs = Math.round(totalLatency / totalSearches);

    const successfulSearches = logs.filter((l) => l.resultCount > 0).length;
    const successRate = Math.round((successfulSearches / totalSearches) * 100);

    // Top merchants frequency
    const merchantMap = new Map<string, number>();
    for (const log of logs) {
      if (log.merchant) {
        merchantMap.set(log.merchant, (merchantMap.get(log.merchant) || 0) + 1);
      }
    }
    const topMerchants = Array.from(merchantMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Top categories frequency
    const catMap = new Map<string, number>();
    for (const log of logs) {
      if (log.category) {
        catMap.set(log.category, (catMap.get(log.category) || 0) + 1);
      }
    }
    const topCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      totalSearches,
      averageLatencyMs,
      successRate,
      topMerchants,
      topCategories,
      lastSearchAt: logs[0]?.createdAt || null,
    };
  }

  /**
   * Clears all search analytics logs.
   */
  async clearAnalytics(): Promise<void> {
    this.memoryLogs = [];
    try {
      await this.ensureTable();
      await databaseService.executeCommand(`DELETE FROM search_analytics`);
    } catch {}
  }
}

export const searchAnalyticsService = new SearchAnalyticsService();

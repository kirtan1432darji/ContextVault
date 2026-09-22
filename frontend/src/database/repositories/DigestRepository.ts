import { databaseService } from '../database';

export interface DailyDigestDbRecord {
  digestDate: string; // YYYY-MM-DD
  screenshotCount: number;
  spendingTotal: number;
  merchantSummaryJson: string;
  categorySummaryJson: string;
  aiSummary: string;
  createdAt: string;
}

export interface WeeklyDigestDbRecord {
  weekKey: string; // e.g. 2026-W38
  screenshotCount: number;
  spendingTotal: number;
  aiSummary: string;
  topCategoriesJson: string;
  createdAt: string;
}

export interface MonthlyDigestDbRecord {
  monthKey: string; // e.g. 2026-09
  screenshotCount: number;
  spendingTotal: number;
  aiSummary: string;
  insightsJson: string;
  createdAt: string;
}

export class DigestRepository {
  // === Daily Digest ===
  async upsertDailyDigest(record: DailyDigestDbRecord): Promise<void> {
    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO daily_digest (
        digest_date, screenshot_count, spending_total, merchant_summary_json, category_summary_json, ai_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.digestDate,
        record.screenshotCount,
        record.spendingTotal,
        record.merchantSummaryJson || '[]',
        record.categorySummaryJson || '{}',
        record.aiSummary || '',
        record.createdAt,
      ]
    );
  }

  async getDailyDigest(dateStr: string): Promise<DailyDigestDbRecord | null> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM daily_digest WHERE digest_date = ? LIMIT 1`,
      [dateStr]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      digestDate: r.digest_date,
      screenshotCount: r.screenshot_count,
      spendingTotal: r.spending_total,
      merchantSummaryJson: r.merchant_summary_json,
      categorySummaryJson: r.category_summary_json,
      aiSummary: r.ai_summary,
      createdAt: r.created_at,
    };
  }

  async getRecentDailyDigests(limit = 7): Promise<DailyDigestDbRecord[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM daily_digest ORDER BY digest_date DESC LIMIT ?`,
      [limit]
    );
    return (rows || []).map((r: any) => ({
      digestDate: r.digest_date,
      screenshotCount: r.screenshot_count,
      spendingTotal: r.spending_total,
      merchantSummaryJson: r.merchant_summary_json,
      categorySummaryJson: r.category_summary_json,
      aiSummary: r.ai_summary,
      createdAt: r.created_at,
    }));
  }

  // === Weekly Digest ===
  async upsertWeeklyDigest(record: WeeklyDigestDbRecord): Promise<void> {
    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO weekly_digest (
        week_key, screenshot_count, spending_total, ai_summary, top_categories_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.weekKey,
        record.screenshotCount,
        record.spendingTotal,
        record.aiSummary || '',
        record.topCategoriesJson || '[]',
        record.createdAt,
      ]
    );
  }

  async getWeeklyDigest(weekKey: string): Promise<WeeklyDigestDbRecord | null> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM weekly_digest WHERE week_key = ? LIMIT 1`,
      [weekKey]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      weekKey: r.week_key,
      screenshotCount: r.screenshot_count,
      spendingTotal: r.spending_total,
      aiSummary: r.ai_summary,
      topCategoriesJson: r.top_categories_json,
      createdAt: r.created_at,
    };
  }

  // === Monthly Digest ===
  async upsertMonthlyDigest(record: MonthlyDigestDbRecord): Promise<void> {
    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO monthly_digest (
        month_key, screenshot_count, spending_total, ai_summary, insights_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.monthKey,
        record.screenshotCount,
        record.spendingTotal,
        record.aiSummary || '',
        record.insightsJson || '{}',
        record.createdAt,
      ]
    );
  }

  async getMonthlyDigest(monthKey: string): Promise<MonthlyDigestDbRecord | null> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM monthly_digest WHERE month_key = ? LIMIT 1`,
      [monthKey]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      monthKey: r.month_key,
      screenshotCount: r.screenshot_count,
      spendingTotal: r.spending_total,
      aiSummary: r.ai_summary,
      insightsJson: r.insights_json,
      createdAt: r.created_at,
    };
  }
}

export const digestRepository = new DigestRepository();

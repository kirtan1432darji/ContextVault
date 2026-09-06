import { databaseService } from '../database';
import { ClassificationCacheRecord } from '../../models';

export class ClassificationCacheRepository {
  async setCache(record: ClassificationCacheRecord): Promise<void> {
    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO classification_cache (
        id, screenshot_id, category, subcategory, tags_json, entities_json, confidence, summary, source, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.screenshotId,
        record.category,
        record.subcategory || null,
        record.tagsJson || '[]',
        record.entitiesJson || '{}',
        record.confidence,
        record.summary || null,
        record.source || 'backend',
        record.cachedAt,
      ]
    );
  }

  async getCacheByScreenshotId(screenshotId: string): Promise<ClassificationCacheRecord | null> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM classification_cache WHERE screenshot_id = ? ORDER BY cached_at DESC LIMIT 1`,
      [screenshotId]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      screenshotId: r.screenshot_id,
      category: r.category,
      subcategory: r.subcategory || undefined,
      tagsJson: r.tags_json || '[]',
      entitiesJson: r.entities_json || '{}',
      confidence: r.confidence,
      summary: r.summary || undefined,
      source: r.source,
      cachedAt: r.cached_at,
    };
  }

  async getTodaySyncedCount(): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0];
    const rows = await databaseService.executeQuery(
      `SELECT COUNT(*) as count FROM classification_cache WHERE source = 'backend' AND cached_at LIKE ?`,
      [`${todayStr}%`]
    );
    return rows.length > 0 ? rows[0].count : 0;
  }

  async getAll(): Promise<ClassificationCacheRecord[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM classification_cache ORDER BY cached_at DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      screenshotId: r.screenshot_id,
      category: r.category,
      subcategory: r.subcategory || undefined,
      tagsJson: r.tags_json || '[]',
      entitiesJson: r.entities_json || '{}',
      confidence: r.confidence,
      summary: r.summary || undefined,
      source: r.source,
      cachedAt: r.cached_at,
    }));
  }
}

export const classificationCacheRepository = new ClassificationCacheRepository();

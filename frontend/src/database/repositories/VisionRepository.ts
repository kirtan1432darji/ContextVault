import { databaseService } from '../database';
import { VisionCacheRecord, VisionStructuredOutput } from '../../vision/types';
import { classificationCacheRepository } from './classificationCacheRepository';
import { tagRepository } from './tagRepository';

export class VisionRepository {
  /**
   * Saves or replaces a vision result in the SQLite vision_cache table.
   */
  async saveVisionResult(record: VisionCacheRecord): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO vision_cache (
        screenshot_id,
        screen_type,
        application_name,
        summary,
        detected_objects,
        detected_entities,
        detected_logos,
        confidence,
        processed_at,
        model_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await databaseService.executeCommand(sql, [
      record.screenshot_id,
      record.screen_type,
      record.application_name,
      record.summary,
      record.detected_objects,
      record.detected_entities,
      record.detected_logos,
      record.confidence,
      record.processed_at,
      record.model_version,
    ]);
  }

  /**
   * Saves a structured vision output simultaneously to vision_cache and classification_cache.
   */
  async saveStructuredResult(params: {
    screenshotId: string;
    fileHash?: string;
    structured: VisionStructuredOutput;
    modelVersion?: string;
  }): Promise<void> {
    const { screenshotId, structured, modelVersion = 'local:Qwen2.5-VL-3B-Instruct' } = params;
    const now = new Date().toISOString();

    const entities = structured.entities || {};
    const tags = structured.tags || [];
    const appName =
      entities.merchant ||
      entities.platform ||
      entities.application ||
      entities.airline ||
      structured.category ||
      'Unknown';

    // 1. Save to vision_cache
    const cacheRecord: VisionCacheRecord = {
      screenshot_id: screenshotId,
      screen_type: structured.category.toLowerCase(),
      application_name: appName,
      summary: structured.summary || '',
      detected_objects: JSON.stringify(tags),
      detected_entities: JSON.stringify(entities),
      detected_logos: JSON.stringify(entities.merchant ? [entities.merchant] : []),
      confidence: structured.confidence > 1 ? structured.confidence / 100 : structured.confidence,
      processed_at: now,
      model_version: modelVersion,
    };
    await this.saveVisionResult(cacheRecord);

    // 2. Save to classification_cache so existing search and context components see it
    await classificationCacheRepository.setCache({
      id: `cache_${screenshotId}`,
      screenshotId,
      category: structured.category,
      subcategory: String(entities.merchant || entities.airline || 'General'),
      tagsJson: JSON.stringify(tags),
      entitiesJson: JSON.stringify(entities),
      confidence: structured.confidence > 1 ? structured.confidence / 100 : structured.confidence,
      summary: structured.summary,
      source: 'local',
      cachedAt: now,
    });

    // 3. Save tags into tags and screenshot_tags table (Sprint P1-B Phase 5)
    if (Array.isArray(tags) && tags.length > 0) {
      for (const t of tags) {
        if (!t || typeof t !== 'string') continue;
        const cleanTag = t.trim().toLowerCase();
        if (!cleanTag) continue;
        const tagId = `tag_${cleanTag.replace(/[^a-z0-9]/g, '_')}`;
        try {
          await tagRepository.addTag({ id: tagId, name: cleanTag, colorHex: '6366F1' });
          await tagRepository.linkScreenshotTag(screenshotId, tagId);
        } catch (tagErr) {
          console.warn(`[VisionRepository] Failed to link tag ${cleanTag}:`, tagErr);
        }
      }
    }

    // 4. Update screenshots table with confidence, detected app, and timestamp
    const normConf = structured.confidence > 1 ? structured.confidence / 100 : structured.confidence;
    try {
      await databaseService.executeCommand(
        `UPDATE screenshots SET 
          confidence = ?, 
          last_scanned_at = ?,
          detected_app = coalesce(?, detected_app),
          classification_source = 'local'
         WHERE id = ?`,
        [normConf, now, appName !== 'Unknown' ? appName : null, screenshotId]
      );
    } catch (scErr) {
      console.warn(`[VisionRepository] Failed to update screenshot row for ${screenshotId}:`, scErr);
    }
  }

  /**
   * Retrieves a vision result for a specific screenshot from the SQLite vision_cache table.
   */
  async getVisionResult(screenshotId: string): Promise<VisionCacheRecord | null> {
    const sql = `SELECT * FROM vision_cache WHERE screenshot_id = ? LIMIT 1`;
    const rows = await databaseService.executeQuery(sql, [screenshotId]);
    if (rows.length === 0) return null;
    return this.mapRowToRecord(rows[0]);
  }

  /**
   * Checks if an image with the exact same SHA-256 hash was already analyzed.
   * If so, returns the existing cached result without requiring a re-analysis.
   */
  async getByFileHash(fileHash: string): Promise<VisionCacheRecord | null> {
    if (!fileHash) return null;

    // Check if there is a pending screenshot with this hash that has a cached vision result
    const sql = `
      SELECT v.* FROM vision_cache v
      JOIN pending_screenshots p ON p.id = v.screenshot_id OR p.file_path = v.screenshot_id
      WHERE p.file_hash = ?
      ORDER BY v.processed_at DESC
      LIMIT 1
    `;
    try {
      const rows = await databaseService.executeQuery(sql, [fileHash]);
      if (rows.length > 0) {
        return this.mapRowToRecord(rows[0]);
      }
    } catch {
      // Ignore join error if table not yet initialized
    }
    return null;
  }

  /**
   * Updates an existing vision result.
   */
  async updateVisionResult(record: VisionCacheRecord): Promise<void> {
    const sql = `
      UPDATE vision_cache SET
        screen_type = ?,
        application_name = ?,
        summary = ?,
        detected_objects = ?,
        detected_entities = ?,
        detected_logos = ?,
        confidence = ?,
        processed_at = ?,
        model_version = ?
      WHERE screenshot_id = ?
    `;

    await databaseService.executeCommand(sql, [
      record.screen_type,
      record.application_name,
      record.summary,
      record.detected_objects,
      record.detected_entities,
      record.detected_logos,
      record.confidence,
      record.processed_at,
      record.model_version,
      record.screenshot_id,
    ]);
  }

  /**
   * Deletes a vision result by screenshot ID.
   */
  async deleteVisionResult(screenshotId: string): Promise<void> {
    const sql = `DELETE FROM vision_cache WHERE screenshot_id = ?`;
    await databaseService.executeCommand(sql, [screenshotId]);
  }

  /**
   * Clears the entire vision cache.
   */
  async clearCache(): Promise<void> {
    await databaseService.executeCommand('DELETE FROM vision_cache');
    try {
      await databaseService.executeCommand("DELETE FROM classification_cache WHERE source = 'local'");
    } catch {}
  }

  /**
   * Retrieves all cached vision results.
   */
  async getAllVisionResults(limit = 100): Promise<VisionCacheRecord[]> {
    const sql = `SELECT * FROM vision_cache ORDER BY processed_at DESC LIMIT ?`;
    const rows = await databaseService.executeQuery(sql, [limit]);
    return rows.map(this.mapRowToRecord);
  }

  /**
   * Retrieves statistics for the vision cache.
   */
  async getStats(): Promise<{ totalCount: number; todayCount: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    const [totalRows, todayRows] = await Promise.all([
      databaseService.executeQuery('SELECT COUNT(*) as count FROM vision_cache'),
      databaseService.executeQuery(
        'SELECT COUNT(*) as count FROM vision_cache WHERE processed_at >= ?',
        [startIso]
      ),
    ]);

    const totalCount = totalRows.length > 0 ? totalRows[0].count || 0 : 0;
    const todayCount = todayRows.length > 0 ? todayRows[0].count || 0 : 0;

    return { totalCount, todayCount };
  }

  /**
   * Helper for Context Chat: find cached analyses mentioning a keyword in summary or entities.
   */
  async findByKeyword(keyword: string): Promise<VisionCacheRecord[]> {
    const term = `%${keyword.toLowerCase()}%`;
    const sql = `
      SELECT * FROM vision_cache
      WHERE LOWER(summary) LIKE ?
         OR LOWER(detected_entities) LIKE ?
         OR LOWER(detected_objects) LIKE ?
         OR LOWER(application_name) LIKE ?
      ORDER BY processed_at DESC
      LIMIT 20
    `;
    const rows = await databaseService.executeQuery(sql, [term, term, term, term]);
    return rows.map(this.mapRowToRecord);
  }

  private mapRowToRecord(row: any): VisionCacheRecord {
    return {
      screenshot_id: row.screenshot_id,
      screen_type: row.screen_type || 'other',
      application_name: row.application_name || 'Unknown',
      summary: row.summary || '',
      detected_objects: row.detected_objects || '[]',
      detected_entities: row.detected_entities || '{}',
      detected_logos: row.detected_logos || '[]',
      confidence: Number(row.confidence) || 0.0,
      processed_at: row.processed_at || new Date().toISOString(),
      model_version: row.model_version || 'unknown',
    };
  }
}

export const visionRepository = new VisionRepository();

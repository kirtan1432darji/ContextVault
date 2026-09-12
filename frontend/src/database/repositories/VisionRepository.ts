import { databaseService } from '../database';
import { VisionCacheRecord } from '../../vision/types';

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
   * Retrieves a vision result for a specific screenshot from the SQLite vision_cache table.
   */
  async getVisionResult(screenshotId: string): Promise<VisionCacheRecord | null> {
    const sql = `SELECT * FROM vision_cache WHERE screenshot_id = ? LIMIT 1`;
    const rows = await databaseService.executeQuery(sql, [screenshotId]);
    if (rows.length === 0) return null;
    return this.mapRowToRecord(rows[0]);
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

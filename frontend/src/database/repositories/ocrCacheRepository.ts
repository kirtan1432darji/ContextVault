import { databaseService } from '../database';
import { OCRCacheRecord } from '../../models';

export class OCRCacheRepository {
  async insertOCRCache(record: OCRCacheRecord): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO ocr_cache (
        id, screenshot_id, extracted_text, normalized_text,
        processing_time, language, ocr_version, confidence,
        blocks_json, created_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await databaseService.executeCommand(sql, [
      record.id,
      record.screenshotId,
      record.extractedText,
      record.normalizedText || '',
      record.processingTime || 0,
      record.language || 'en',
      record.ocrVersion || 'MLKit-Text-16.0.0',
      record.confidence || 1.0,
      record.blocksJson || '[]',
      record.createdOn || new Date().toISOString(),
    ]);
  }

  async getByScreenshotId(screenshotId: string): Promise<OCRCacheRecord | null> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM ocr_cache WHERE screenshot_id = ? LIMIT 1',
      [screenshotId]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getById(id: string): Promise<OCRCacheRecord | null> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM ocr_cache WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getStats(): Promise<{
    totalCount: number;
    todayCount: number;
    avgProcessingTimeMs: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    const [totalRows, todayRows, avgRows] = await Promise.all([
      databaseService.executeQuery('SELECT COUNT(*) as count FROM ocr_cache'),
      databaseService.executeQuery(
        'SELECT COUNT(*) as count FROM ocr_cache WHERE created_on >= ?',
        [startIso]
      ),
      databaseService.executeQuery(
        'SELECT AVG(processing_time) as avg_time FROM ocr_cache WHERE processing_time > 0'
      ),
    ]);

    const totalCount = totalRows.length > 0 ? totalRows[0].count || 0 : 0;
    const todayCount = todayRows.length > 0 ? todayRows[0].count || 0 : 0;
    const rawAvg = avgRows.length > 0 ? avgRows[0].avg_time || 0 : 0;
    const avgProcessingTimeMs = Math.round(Number(rawAvg) || 0);

    return { totalCount, todayCount, avgProcessingTimeMs };
  }

  async getRecent(limit = 10): Promise<OCRCacheRecord[]> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM ocr_cache ORDER BY created_on DESC LIMIT ?',
      [limit]
    );
    return rows.map(this.mapRowToModel);
  }

  async deleteByScreenshotId(screenshotId: string): Promise<void> {
    await databaseService.executeCommand(
      'DELETE FROM ocr_cache WHERE screenshot_id = ?',
      [screenshotId]
    );
  }

  private mapRowToModel(row: any): OCRCacheRecord {
    return {
      id: row.id || row.screenshot_id,
      screenshotId: row.screenshot_id,
      extractedText: row.extracted_text || row.raw_text || '',
      normalizedText: row.normalized_text || '',
      processingTime: row.processing_time || 0,
      language: row.language || 'en',
      ocrVersion: row.ocr_version || 'MLKit-Text-16.0.0',
      confidence: row.confidence !== undefined ? Number(row.confidence) : 1.0,
      blocksJson: row.blocks_json || '[]',
      createdOn: row.created_on || row.created_at || new Date().toISOString(),
    };
  }
}

export const ocrCacheRepository = new OCRCacheRepository();

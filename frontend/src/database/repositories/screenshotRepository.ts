import { databaseService } from '../database';
import { ScreenshotModel, ScreenshotFilter } from '../../models';

export class ScreenshotRepository {
  async getAllScreenshots(filter: ScreenshotFilter = {}): Promise<ScreenshotModel[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.categoryId && filter.categoryId !== 'all') {
      conditions.push('category_id = ?');
      params.push(filter.categoryId);
    }

    if (filter.isFavorite) {
      conditions.push('is_favorite = 1');
    }

    if (filter.needsReview) {
      conditions.push('(is_reviewed = 0 AND (confidence < 0.70 OR category_id = "unsorted"))');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    const sql = `
      SELECT * FROM screenshots 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = await databaseService.executeQuery(sql, params);
    return rows.map(this.mapRowToModel);
  }

  async getScreenshotById(id: string): Promise<ScreenshotModel | null> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM screenshots WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async hasScreenshot(deviceAssetId?: string, filePath?: string): Promise<boolean> {
    if (deviceAssetId) {
      const rows = await databaseService.executeQuery(
        'SELECT id FROM screenshots WHERE device_asset_id = ? LIMIT 1',
        [deviceAssetId]
      );
      if (rows.length > 0) return true;
    }
    if (filePath) {
      const rows = await databaseService.executeQuery(
        'SELECT id FROM screenshots WHERE file_path = ? LIMIT 1',
        [filePath]
      );
      if (rows.length > 0) return true;
    }
    return false;
  }

  async insertScreenshot(screenshot: ScreenshotModel): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO screenshots (
        id, device_asset_id, file_path, file_name, created_at,
        width, height, file_size, category_id, category_name,
        subcategory, confidence, source_app, detected_app,
        keywords_json, is_auto_categorized, is_favorite,
        is_reviewed, is_synced, ocr_status, ocr_text,
        last_scanned_at, is_mock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await databaseService.executeCommand(sql, [
      screenshot.id,
      screenshot.deviceAssetId || '',
      screenshot.filePath,
      screenshot.fileName,
      screenshot.createdAt,
      screenshot.width,
      screenshot.height,
      screenshot.fileSize,
      screenshot.categoryId,
      screenshot.categoryName,
      screenshot.subcategory || '',
      screenshot.confidence,
      screenshot.sourceApp || null,
      screenshot.detectedApp || null,
      JSON.stringify(screenshot.keywords || []),
      screenshot.isAutoCategorized ? 1 : 0,
      screenshot.isFavorite ? 1 : 0,
      screenshot.isReviewed ? 1 : 0,
      screenshot.isSynced ? 1 : 0,
      screenshot.ocrStatus,
      screenshot.ocrText || null,
      screenshot.lastScannedAt || null,
      screenshot.isMock ? 1 : 0,
    ]);
  }

  async updateScreenshot(screenshot: ScreenshotModel): Promise<void> {
    return this.insertScreenshot(screenshot);
  }

  async deleteScreenshot(id: string): Promise<void> {
    await databaseService.executeCommand('DELETE FROM screenshots WHERE id = ?', [id]);
  }

  private mapRowToModel(row: any): ScreenshotModel {
    let keywords: string[] = [];
    try {
      if (row.keywords_json) {
        keywords = JSON.parse(row.keywords_json);
      }
    } catch {}

    return {
      id: row.id,
      deviceAssetId: row.device_asset_id || '',
      filePath: row.file_path,
      fileName: row.file_name,
      createdAt: row.created_at,
      width: row.width,
      height: row.height,
      fileSize: row.file_size,
      categoryId: row.category_id,
      categoryName: row.category_name,
      subcategory: row.subcategory || '',
      confidence: row.confidence,
      sourceApp: row.source_app,
      detectedApp: row.detected_app,
      keywords,
      isAutoCategorized: Boolean(row.is_auto_categorized),
      isFavorite: Boolean(row.is_favorite),
      isReviewed: Boolean(row.is_reviewed),
      isSynced: Boolean(row.is_synced),
      ocrStatus: row.ocr_status,
      ocrText: row.ocr_text,
      lastScannedAt: row.last_scanned_at,
      tags: [],
    };
  }
}

export const screenshotRepository = new ScreenshotRepository();

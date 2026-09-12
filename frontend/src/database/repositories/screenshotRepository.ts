import { databaseService } from '../database';
import { ScreenshotModel, ScreenshotFilter } from '../../models';

export class ScreenshotRepository {
  async getAllScreenshots(filter: ScreenshotFilter = {}): Promise<ScreenshotModel[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.isDeleted === true) {
      conditions.push('is_deleted = 1');
    } else {
      conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }

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

  async getScreenshotsForCategory(
    categoryId: string,
    categoryName?: string,
    descendantIds?: string[]
  ): Promise<ScreenshotModel[]> {
    const ids = descendantIds && descendantIds.length > 0 ? descendantIds : [categoryId];
    const placeholders = ids.map(() => '?').join(',');
    const params: any[] = [...ids];

    let query = `
      SELECT * FROM screenshots 
      WHERE (
        category_id IN (${placeholders})
    `;

    if (categoryName && categoryName.trim().length > 0) {
      const cleanName = categoryName.trim();
      query += ` OR LOWER(category_name) = LOWER(?) OR folder_path LIKE ?`;
      params.push(cleanName);
      params.push(`%"${cleanName}"%`);
    }

    query += `
      )
      AND (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY created_at DESC
    `;

    const rows = await databaseService.executeQuery(query, params);
    return rows.map(this.mapRowToModel);
  }

  async getScreenshotsByCategoryId(categoryId: string): Promise<ScreenshotModel[]> {
    return this.getScreenshotsForCategory(categoryId);
  }

  async getNeedsReviewCount(): Promise<number> {
    const rows = await databaseService.executeQuery(
      `SELECT COUNT(*) as count FROM screenshots WHERE is_reviewed = 0 AND (confidence < 0.70 OR category_id = 'unsorted') AND (is_deleted = 0 OR is_deleted IS NULL)`
    );
    return rows.length > 0 ? rows[0].count : 0;
  }

  async getDeletedScreenshots(): Promise<ScreenshotModel[]> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM screenshots WHERE is_deleted = 1 ORDER BY deleted_at DESC, created_at DESC'
    );
    return rows.map(this.mapRowToModel);
  }

  async softDeleteScreenshot(id: string): Promise<void> {
    const now = new Date().toISOString();
    await databaseService.executeCommand(
      'UPDATE screenshots SET is_deleted = 1, deleted_at = ? WHERE id = ?',
      [now, id]
    );
  }

  async restoreScreenshot(id: string): Promise<void> {
    await databaseService.executeCommand(
      'UPDATE screenshots SET is_deleted = 0, deleted_at = NULL WHERE id = ?',
      [id]
    );
  }

  async restoreAllScreenshots(): Promise<number> {
    const rows = await databaseService.executeQuery(
      'SELECT id FROM screenshots WHERE is_deleted = 1'
    );
    if (rows.length === 0) return 0;
    await databaseService.executeCommand(
      'UPDATE screenshots SET is_deleted = 0, deleted_at = NULL WHERE is_deleted = 1'
    );
    return rows.length;
  }

  async permanentDeleteScreenshot(id: string): Promise<void> {
    await databaseService.executeCommand('DELETE FROM screenshot_tags WHERE screenshot_id = ?', [id]);
    await databaseService.executeCommand('DELETE FROM ocr_cache WHERE screenshot_id = ?', [id]);
    await databaseService.executeCommand('DELETE FROM screenshots WHERE id = ?', [id]);
  }

  async emptyRecycleBin(): Promise<number> {
    const rows = await databaseService.executeQuery(
      'SELECT id FROM screenshots WHERE is_deleted = 1'
    );
    const count = rows.length;
    if (count === 0) return 0;
    await databaseService.executeCommand(
      'DELETE FROM screenshot_tags WHERE screenshot_id IN (SELECT id FROM screenshots WHERE is_deleted = 1)'
    );
    await databaseService.executeCommand(
      'DELETE FROM ocr_cache WHERE screenshot_id IN (SELECT id FROM screenshots WHERE is_deleted = 1)'
    );
    await databaseService.executeCommand('DELETE FROM screenshots WHERE is_deleted = 1');
    return count;
  }

  async getRecycleBinCount(): Promise<number> {
    const rows = await databaseService.executeQuery(
      'SELECT COUNT(*) as count FROM screenshots WHERE is_deleted = 1'
    );
    return rows[0]?.count || 0;
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
        last_scanned_at, is_mock, classification_source, folder_path,
        is_deleted, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      screenshot.classificationSource || 'local',
      screenshot.folderPath ? JSON.stringify(screenshot.folderPath) : null,
      screenshot.isDeleted ? 1 : 0,
      screenshot.deletedAt || null,
    ]);
  }

  async updateScreenshot(screenshot: ScreenshotModel): Promise<void> {
    return this.insertScreenshot(screenshot);
  }

  async updateClassification(
    id: string,
    categoryId: string,
    categoryName: string,
    subcategory: string,
    confidence: number,
    tags: string[],
    source: 'backend' | 'local' | 'manual' = 'backend',
    folderPath?: string[]
  ): Promise<void> {
    await databaseService.executeCommand(
      `UPDATE screenshots SET 
        category_id = ?, 
        category_name = ?, 
        subcategory = ?, 
        confidence = ?, 
        keywords_json = ?, 
        is_synced = 1, 
        classification_source = ?,
        folder_path = ?
       WHERE id = ?`,
      [
        categoryId,
        categoryName,
        subcategory,
        confidence,
        JSON.stringify(tags),
        source,
        folderPath ? JSON.stringify(folderPath) : null,
        id,
      ]
    );
  }

  async reclassifyScreenshot(
    id: string,
    categoryId: string,
    categoryName: string,
    subcategory: string,
    tags: string[] = [],
    folderPath?: string[]
  ): Promise<void> {
    const folderJson = folderPath
      ? JSON.stringify(folderPath)
      : JSON.stringify([categoryName, subcategory].filter(Boolean));
    await databaseService.executeCommand(
      `UPDATE screenshots SET 
        category_id = ?, 
        category_name = ?, 
        subcategory = ?, 
        confidence = 1.0, 
        keywords_json = ?, 
        is_auto_categorized = 0,
        is_reviewed = 1,
        classification_source = 'manual',
        folder_path = ?
       WHERE id = ?`,
      [
        categoryId,
        categoryName,
        subcategory,
        JSON.stringify(tags),
        folderJson,
        id,
      ]
    );
  }

  async deleteScreenshot(id: string): Promise<void> {
    await databaseService.executeCommand('DELETE FROM screenshots WHERE id = ?', [id]);
  }

  async bulkSoftDelete(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    await databaseService.executeCommand(
      `UPDATE screenshots SET is_deleted = 1, deleted_at = ? WHERE id IN (${placeholders})`,
      [now, ...ids]
    );
    return ids.length;
  }

  async bulkSetFavorite(ids: string[], isFavorite: boolean): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    await databaseService.executeCommand(
      `UPDATE screenshots SET is_favorite = ? WHERE id IN (${placeholders})`,
      [isFavorite ? 1 : 0, ...ids]
    );
    return ids.length;
  }

  async bulkUpdateCategory(
    ids: string[],
    categoryId: string,
    categoryName: string,
    subcategory = ''
  ): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    await databaseService.executeCommand(
      `UPDATE screenshots SET category_id = ?, category_name = ?, subcategory = ?, is_auto_categorized = 0 WHERE id IN (${placeholders})`,
      [categoryId, categoryName, subcategory, ...ids]
    );
    return ids.length;
  }

  private mapRowToModel = (row: any): ScreenshotModel => {
    let keywords: string[] = [];
    try {
      if (row.keywords_json) {
        keywords = JSON.parse(row.keywords_json);
      }
    } catch {}

    let folderPath: string[] | undefined;
    try {
      if (row.folder_path) {
        folderPath = JSON.parse(row.folder_path);
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
      folderPath,
      confidence: row.confidence,
      sourceApp: row.source_app,
      detectedApp: row.detected_app,
      keywords,
      isAutoCategorized: Boolean(row.is_auto_categorized),
      isFavorite: Boolean(row.is_favorite),
      isReviewed: Boolean(row.is_reviewed),
      isSynced: Boolean(row.is_synced),
      isDeleted: Boolean(row.is_deleted),
      deletedAt: row.deleted_at || undefined,
      ocrStatus: row.ocr_status,
      ocrText: row.ocr_text,
      lastScannedAt: row.last_scanned_at,
      classificationSource: row.classification_source || (row.is_synced ? 'backend' : 'local'),
      tags: keywords.slice(0, 5).map((kw) => ({
        id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
        name: kw,
        colorHex: '#6366F1',
      })),
    };
  };
}

export const screenshotRepository = new ScreenshotRepository();

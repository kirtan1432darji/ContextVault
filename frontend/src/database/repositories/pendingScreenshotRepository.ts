import { databaseService } from '../database';
import { PendingScreenshot, PendingScreenshotStatus } from '../../models';

export class PendingScreenshotRepository {
  async insertPending(screenshot: PendingScreenshot): Promise<void> {
    const localPath = screenshot.localPath || screenshot.filePath;
    const contentUri = screenshot.contentUri || (screenshot.deviceAssetId && /^\d+$/.test(screenshot.deviceAssetId) ? `content://media/external/images/media/${screenshot.deviceAssetId}` : null);
    const thumbnailUri = screenshot.thumbnailUri || null;

    const sql = `
      INSERT OR REPLACE INTO pending_screenshots (
        id, device_asset_id, file_path, local_path, content_uri,
        thumbnail_uri, file_name, file_size,
        file_hash, captured_at, status, retry_count,
        error_message, device_folder, mime_type, resolution,
        width, height, ocr_status, ocr_processing_time, extracted_text,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await databaseService.executeCommand(sql, [
      screenshot.id,
      screenshot.deviceAssetId || '',
      screenshot.filePath,
      localPath,
      contentUri,
      thumbnailUri,
      screenshot.fileName,
      screenshot.fileSize,
      screenshot.fileHash,
      screenshot.capturedAt,
      screenshot.status,
      screenshot.retryCount || 0,
      screenshot.errorMessage || null,
      screenshot.deviceFolder || '',
      screenshot.mimeType || 'image/png',
      screenshot.resolution || `${screenshot.width || 1080}x${screenshot.height || 2400}`,
      screenshot.width || 1080,
      screenshot.height || 2400,
      screenshot.ocrStatus || 'Pending',
      screenshot.ocrProcessingTime || 0,
      screenshot.extractedText || null,
      screenshot.createdAt || new Date().toISOString(),
      screenshot.updatedAt || new Date().toISOString(),
    ]);
  }

  async getByHash(hash: string): Promise<PendingScreenshot | null> {
    if (!hash) return null;
    const rows = await databaseService.executeQuery(
      'SELECT * FROM pending_screenshots WHERE file_hash = ? LIMIT 1',
      [hash]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getById(id: string): Promise<PendingScreenshot | null> {
    if (!id) return null;
    const rows = await databaseService.executeQuery(
      'SELECT * FROM pending_screenshots WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getByAssetId(assetId: string): Promise<PendingScreenshot | null> {
    if (!assetId) return null;
    const rows = await databaseService.executeQuery(
      'SELECT * FROM pending_screenshots WHERE device_asset_id = ? LIMIT 1',
      [assetId]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getByPath(filePath: string): Promise<PendingScreenshot | null> {
    if (!filePath) return null;
    const rows = await databaseService.executeQuery(
      'SELECT * FROM pending_screenshots WHERE file_path = ? LIMIT 1',
      [filePath]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async isDuplicate(assetId?: string, fileHash?: string, filePath?: string): Promise<boolean> {
    if (fileHash) {
      const pendingHashRows = await databaseService.executeQuery(
        'SELECT id FROM pending_screenshots WHERE file_hash = ? LIMIT 1',
        [fileHash]
      );
      if (pendingHashRows.length > 0) return true;
    }

    if (assetId) {
      const pendingAssetRows = await databaseService.executeQuery(
        'SELECT id FROM pending_screenshots WHERE device_asset_id = ? LIMIT 1',
        [assetId]
      );
      if (pendingAssetRows.length > 0) return true;
    }

    if (assetId) {
      const screenshotAssetRows = await databaseService.executeQuery(
        'SELECT id FROM screenshots WHERE device_asset_id = ? LIMIT 1',
        [assetId]
      );
      if (screenshotAssetRows.length > 0) return true;
    }

    if (filePath) {
      const screenshotPathRows = await databaseService.executeQuery(
        'SELECT id FROM screenshots WHERE file_path = ? LIMIT 1',
        [filePath]
      );
      if (screenshotPathRows.length > 0) return true;
    }

    return false;
  }

  async updateStatus(
    id: string,
    status: PendingScreenshotStatus,
    errorMessage?: string
  ): Promise<void> {
    const updatedAt = new Date().toISOString();
    const sql = `
      UPDATE pending_screenshots
      SET status = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `;
    await databaseService.executeCommand(sql, [
      status,
      errorMessage || null,
      updatedAt,
      id,
    ]);
  }

  async updateOCRResult(
    id: string,
    ocrStatus: PendingScreenshotStatus,
    extractedText?: string,
    processingTimeMs?: number,
    errorMessage?: string
  ): Promise<void> {
    const updatedAt = new Date().toISOString();
    const sql = `
      UPDATE pending_screenshots
      SET ocr_status = ?,
          status = ?,
          extracted_text = coalesce(?, extracted_text),
          ocr_processing_time = coalesce(?, ocr_processing_time),
          error_message = ?,
          updated_at = ?
      WHERE id = ?
    `;
    await databaseService.executeCommand(sql, [
      ocrStatus,
      ocrStatus,
      extractedText || null,
      processingTimeMs || null,
      errorMessage || null,
      updatedAt,
      id,
    ]);
  }

  async incrementRetry(id: string, errorMessage?: string): Promise<void> {
    const updatedAt = new Date().toISOString();
    const sql = `
      UPDATE pending_screenshots
      SET retry_count = retry_count + 1,
          status = 'Pending',
          ocr_status = 'Pending',
          error_message = ?,
          updated_at = ?
      WHERE id = ?
    `;
    await databaseService.executeCommand(sql, [errorMessage || null, updatedAt, id]);
  }

  async getPendingScreenshots(): Promise<PendingScreenshot[]> {
    const rows = await databaseService.executeQuery(
      "SELECT * FROM pending_screenshots WHERE status = 'Pending' OR ocr_status = 'Pending' ORDER BY created_at ASC"
    );
    return rows.map(this.mapRowToModel);
  }

  async getFailedScreenshots(): Promise<PendingScreenshot[]> {
    const rows = await databaseService.executeQuery(
      "SELECT * FROM pending_screenshots WHERE status = 'Failed' OR ocr_status = 'Failed' ORDER BY updated_at DESC"
    );
    return rows.map(this.mapRowToModel);
  }

  async getRecent(limit = 20): Promise<PendingScreenshot[]> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM pending_screenshots ORDER BY captured_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(this.mapRowToModel);
  }

  async getCounts(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    today: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    const [statusRows, todayRows] = await Promise.all([
      databaseService.executeQuery(
        'SELECT status, COUNT(*) as count FROM pending_screenshots GROUP BY status'
      ),
      databaseService.executeQuery(
        'SELECT COUNT(*) as count FROM pending_screenshots WHERE captured_at >= ?',
        [startIso]
      ),
    ]);

    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;

    for (const row of statusRows) {
      switch (row.status) {
        case 'Pending':
          pending = row.count;
          break;
        case 'Processing':
          processing = row.count;
          break;
        case 'Completed':
          completed = row.count;
          break;
        case 'Failed':
          failed = row.count;
          break;
      }
    }

    const today = todayRows.length > 0 ? todayRows[0].count : 0;

    return { pending, processing, completed, failed, today };
  }

  async deletePending(id: string): Promise<void> {
    await databaseService.executeCommand(
      'DELETE FROM pending_screenshots WHERE id = ?',
      [id]
    );
  }

  async resetStaleProcessingScreenshots(): Promise<number> {
    const res = await databaseService.executeCommand(
      "UPDATE pending_screenshots SET status = 'Pending', ocr_status = 'Pending' WHERE status = 'Processing' OR ocr_status = 'Processing'"
    );
    return res.rowsAffected || 0;
  }

  async clearCompleted(): Promise<void> {
    await databaseService.executeCommand(
      "DELETE FROM pending_screenshots WHERE status = 'Completed'"
    );
  }

  private mapRowToModel(row: any): PendingScreenshot {
    const localPath = row.local_path || row.file_path;
    let contentUri = row.content_uri;
    if (!contentUri && row.device_asset_id && /^\d+$/.test(row.device_asset_id)) {
      contentUri = `content://media/external/images/media/${row.device_asset_id}`;
    }
    const thumbnailUri = row.thumbnail_uri || undefined;

    return {
      id: row.id,
      deviceAssetId: row.device_asset_id || '',
      filePath: row.file_path,
      localPath,
      contentUri,
      thumbnailUri,
      fileName: row.file_name,
      fileSize: row.file_size || 0,
      fileHash: row.file_hash,
      capturedAt: row.captured_at,
      status: row.status as PendingScreenshotStatus,
      retryCount: row.retry_count || 0,
      errorMessage: row.error_message || undefined,
      deviceFolder: row.device_folder || undefined,
      mimeType: row.mime_type || undefined,
      resolution: row.resolution || undefined,
      width: row.width || 1080,
      height: row.height || 2400,
      ocrStatus: (row.ocr_status || row.status) as PendingScreenshotStatus,
      ocrProcessingTime: row.ocr_processing_time || 0,
      extractedText: row.extracted_text || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const pendingScreenshotRepository = new PendingScreenshotRepository();

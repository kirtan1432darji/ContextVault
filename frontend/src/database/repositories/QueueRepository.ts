import { databaseService } from '../database';
import {
  QueueItem,
  QueuePriority,
  QueueState,
  QueueStats,
  PRIORITY_WEIGHTS,
} from '../../services/background/types';
import { v4 as uuidv4 } from 'uuid';

export class QueueRepository {
  private static instance: QueueRepository | null = null;
  private tableEnsured = false;

  static getInstance(): QueueRepository {
    if (!QueueRepository.instance) {
      QueueRepository.instance = new QueueRepository();
    }
    return QueueRepository.instance;
  }

  async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await databaseService.executeCommand(`
        CREATE TABLE IF NOT EXISTS analysis_queue (
          id TEXT PRIMARY KEY,
          screenshot_id TEXT NOT NULL UNIQUE,
          state TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          priority TEXT NOT NULL DEFAULT 'medium',
          priority_order INTEGER NOT NULL DEFAULT 2,
          queued_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          error_message TEXT,
          processing_time_ms INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE
        );
      `);
      await databaseService.executeCommand(
        `CREATE INDEX IF NOT EXISTS idx_analysis_queue_state ON analysis_queue(state);`
      );
      await databaseService.executeCommand(
        `CREATE INDEX IF NOT EXISTS idx_analysis_queue_priority ON analysis_queue(priority_order DESC, queued_at ASC);`
      );
      await databaseService.executeCommand(
        `CREATE INDEX IF NOT EXISTS idx_analysis_queue_screenshot ON analysis_queue(screenshot_id);`
      );
      this.tableEnsured = true;
    } catch (err) {
      console.warn('[QueueRepository] ensureTable notice:', err);
    }
  }

  async enqueue(
    screenshotId: string,
    priority: QueuePriority = 'medium'
  ): Promise<QueueItem> {
    await this.ensureTable();

    const priorityOrder = PRIORITY_WEIGHTS[priority] ?? 2;
    const now = new Date().toISOString();

    // Check if already in queue
    const existing = await databaseService.executeQuery(
      `SELECT * FROM analysis_queue WHERE screenshot_id = ?`,
      [screenshotId]
    );

    if (existing && existing.length > 0) {
      const row = existing[0];
      // If currently processing, don't interrupt
      if (row.state === 'processing') {
        return this.mapRowToItem(row);
      }

      // Update priority if higher or reset to pending if failed / cancelled / completed
      const newOrder = Math.max(priorityOrder, row.priority_order || 0);
      const newPriority = newOrder > (row.priority_order || 0) ? priority : row.priority;

      await databaseService.executeCommand(
        `UPDATE analysis_queue
         SET state = 'pending',
             priority = ?,
             priority_order = ?,
             queued_at = ?,
             started_at = NULL,
             finished_at = NULL,
             error_message = NULL
         WHERE screenshot_id = ?`,
        [newPriority, newOrder, now, screenshotId]
      );

      return {
        id: row.id,
        screenshotId,
        state: 'pending',
        retryCount: row.retry_count || 0,
        priority: newPriority,
        priorityOrder: newOrder,
        queuedAt: now,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        processingTimeMs: row.processing_time_ms || 0,
      };
    }

    const id = `aq_${uuidv4()}`;
    await databaseService.executeCommand(
      `INSERT INTO analysis_queue (
        id, screenshot_id, state, retry_count, priority, priority_order, queued_at, processing_time_ms
      ) VALUES (?, ?, 'pending', 0, ?, ?, ?, 0)`,
      [id, screenshotId, priority, priorityOrder, now]
    );

    return {
      id,
      screenshotId,
      state: 'pending',
      retryCount: 0,
      priority,
      priorityOrder,
      queuedAt: now,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      processingTimeMs: 0,
    };
  }

  async enqueueBatch(
    items: { screenshotId: string; priority?: QueuePriority }[]
  ): Promise<number> {
    await this.ensureTable();
    let count = 0;
    for (const item of items) {
      try {
        await this.enqueue(item.screenshotId, item.priority || 'medium');
        count++;
      } catch (err) {
        console.warn(`[QueueRepository] Failed to enqueue batch item ${item.screenshotId}:`, err);
      }
    }
    return count;
  }

  async getNextPending(): Promise<QueueItem | null> {
    await this.ensureTable();
    const rows = await databaseService.executeQuery(
      `SELECT q.*,
              s.file_name,
              s.file_path,
              s.local_path,
              s.content_uri,
              s.thumbnail_uri,
              s.category_name,
              s.file_size
       FROM analysis_queue q
       LEFT JOIN screenshots s ON q.screenshot_id = s.id
       WHERE q.state = 'pending'
       ORDER BY q.priority_order DESC, q.queued_at ASC
       LIMIT 1`
    );

    if (!rows || rows.length === 0) return null;
    return this.mapRowToItem(rows[0]);
  }

  async getQueueItemById(idOrScreenshotId: string): Promise<QueueItem | null> {
    await this.ensureTable();
    const rows = await databaseService.executeQuery(
      `SELECT q.*,
              s.file_name,
              s.file_path,
              s.local_path,
              s.content_uri,
              s.thumbnail_uri,
              s.category_name,
              s.file_size
       FROM analysis_queue q
       LEFT JOIN screenshots s ON q.screenshot_id = s.id
       WHERE q.id = ? OR q.screenshot_id = ?
       LIMIT 1`,
      [idOrScreenshotId, idOrScreenshotId]
    );

    if (!rows || rows.length === 0) return null;
    return this.mapRowToItem(rows[0]);
  }

  async updateState(
    id: string,
    state: QueueState,
    errorMessage?: string | null,
    processingTimeMs?: number
  ): Promise<void> {
    await this.ensureTable();
    const now = new Date().toISOString();

    if (state === 'processing') {
      await databaseService.executeCommand(
        `UPDATE analysis_queue
         SET state = ?, started_at = ?, error_message = NULL
         WHERE id = ? OR screenshot_id = ?`,
        [state, now, id, id]
      );
    } else if (state === 'completed') {
      await databaseService.executeCommand(
        `UPDATE analysis_queue
         SET state = ?, finished_at = ?, error_message = NULL, processing_time_ms = ?
         WHERE id = ? OR screenshot_id = ?`,
        [state, now, processingTimeMs || 0, id, id]
      );
    } else if (state === 'failed') {
      await databaseService.executeCommand(
        `UPDATE analysis_queue
         SET state = ?, finished_at = ?, error_message = ?, retry_count = retry_count + 1
         WHERE id = ? OR screenshot_id = ?`,
        [state, now, errorMessage || 'Unknown error', id, id]
      );
    } else {
      await databaseService.executeCommand(
        `UPDATE analysis_queue
         SET state = ?
         WHERE id = ? OR screenshot_id = ?`,
        [state, id, id]
      );
    }
  }

  async bumpPriority(id: string, priority: QueuePriority): Promise<void> {
    await this.ensureTable();
    const priorityOrder = PRIORITY_WEIGHTS[priority] ?? 4;
    await databaseService.executeCommand(
      `UPDATE analysis_queue
       SET priority = ?, priority_order = ?
       WHERE id = ? OR screenshot_id = ?`,
      [priority, priorityOrder, id, id]
    );
  }

  async getQueueStats(): Promise<QueueStats> {
    await this.ensureTable();
    try {
      const countsRow = await databaseService.executeQuery(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN state = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN state = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN state = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          AVG(CASE WHEN state = 'completed' AND processing_time_ms > 0 THEN processing_time_ms ELSE NULL END) as avg_time
        FROM analysis_queue
      `);

      const res = countsRow && countsRow[0] ? countsRow[0] : {};
      return {
        total: Number(res.total || 0),
        pending: Number(res.pending || 0),
        processing: Number(res.processing || 0),
        completed: Number(res.completed || 0),
        failed: Number(res.failed || 0),
        cancelled: Number(res.cancelled || 0),
        averageProcessingTimeMs: Math.round(Number(res.avg_time || 0)),
      };
    } catch {
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        averageProcessingTimeMs: 0,
      };
    }
  }

  async getQueueItems(filterState?: QueueState, limit = 100): Promise<QueueItem[]> {
    await this.ensureTable();
    let sql = `
      SELECT q.*,
             s.file_name,
             s.file_path,
             s.local_path,
             s.content_uri,
             s.thumbnail_uri,
             s.category_name,
             s.file_size
      FROM analysis_queue q
      LEFT JOIN screenshots s ON q.screenshot_id = s.id
    `;
    const params: any[] = [];

    if (filterState) {
      sql += ` WHERE q.state = ?`;
      params.push(filterState);
    }

    sql += ` ORDER BY q.priority_order DESC, q.queued_at ASC LIMIT ?`;
    params.push(limit);

    const rows = await databaseService.executeQuery(sql, params);
    return (rows || []).map((r) => this.mapRowToItem(r));
  }

  async retryFailed(): Promise<number> {
    await this.ensureTable();
    const result = await databaseService.executeCommand(
      `UPDATE analysis_queue
       SET state = 'pending', started_at = NULL, finished_at = NULL, error_message = NULL
       WHERE state = 'failed'`
    );
    return result?.rowsAffected || 0;
  }

  async retryItem(id: string): Promise<boolean> {
    await this.ensureTable();
    const result = await databaseService.executeCommand(
      `UPDATE analysis_queue
       SET state = 'pending', started_at = NULL, finished_at = NULL, error_message = NULL
       WHERE id = ? OR screenshot_id = ?`,
      [id, id]
    );
    return (result?.rowsAffected || 0) > 0;
  }

  async cancelItem(id: string): Promise<boolean> {
    await this.ensureTable();
    const result = await databaseService.executeCommand(
      `UPDATE analysis_queue
       SET state = 'cancelled'
       WHERE (id = ? OR screenshot_id = ?) AND state != 'processing'`,
      [id, id]
    );
    return (result?.rowsAffected || 0) > 0;
  }

  async clearCompleted(): Promise<number> {
    await this.ensureTable();
    const result = await databaseService.executeCommand(
      `DELETE FROM analysis_queue WHERE state = 'completed'`
    );
    return result?.rowsAffected || 0;
  }

  async clearAll(): Promise<void> {
    await this.ensureTable();
    await databaseService.executeCommand(
      `DELETE FROM analysis_queue WHERE state != 'processing'`
    );
  }

  private mapRowToItem(row: any): QueueItem {
    return {
      id: row.id,
      screenshotId: row.screenshot_id,
      state: row.state as QueueState,
      retryCount: Number(row.retry_count || 0),
      priority: row.priority as QueuePriority,
      priorityOrder: Number(row.priority_order || 2),
      queuedAt: row.queued_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      errorMessage: row.error_message,
      processingTimeMs: Number(row.processing_time_ms || 0),
      fileName: row.file_name,
      filePath: row.file_path,
      localPath: row.local_path,
      contentUri: row.content_uri,
      thumbnailUri: row.thumbnail_uri,
      categoryName: row.category_name,
      fileSize: row.file_size ? Number(row.file_size) : undefined,
    };
  }
}

export const queueRepository = QueueRepository.getInstance();

import { databaseService } from '../database';
import { SyncQueueItemModel } from '../../models';

export class SyncQueueRepository {
  async addToQueue(item: SyncQueueItemModel): Promise<void> {
    await databaseService.executeCommand(
      `INSERT INTO sync_queue (id, endpoint, http_method, payload, retry_count, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.endpoint,
        item.httpMethod,
        JSON.stringify(item.payload),
        item.retryCount,
        item.status,
        item.createdAt,
      ]
    );
  }

  async getPendingQueue(): Promise<SyncQueueItemModel[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`
    );
    return rows.map((r) => ({
      id: r.id,
      endpoint: r.endpoint,
      httpMethod: r.http_method,
      payload: JSON.parse(r.payload),
      retryCount: r.retry_count,
      status: r.status,
      createdAt: r.created_at,
      lastError: r.last_error,
    }));
  }

  async markCompleted(id: string): Promise<void> {
    await databaseService.executeCommand(
      `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
      [id]
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await databaseService.executeCommand(
      `UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
      [error, id]
    );
  }
}

export const syncQueueRepository = new SyncQueueRepository();

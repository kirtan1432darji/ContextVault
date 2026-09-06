import { databaseService } from '../database';
import { FolderContextEntity } from '../../models';

export class FolderContextRepository {
  async upsertFolderContext(context: FolderContextEntity): Promise<void> {
    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO folder_context (
        folder_id, summary, entities_json, tasks_json, updated_on, version
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        context.FolderId,
        context.Summary,
        context.EntitiesJson,
        context.TasksJson,
        context.UpdatedOn,
        context.Version || 1,
      ]
    );
  }

  async getFolderContext(folderId: string): Promise<FolderContextEntity | null> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM folder_context WHERE folder_id = ?`,
      [folderId]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      FolderId: r.folder_id,
      Summary: r.summary,
      EntitiesJson: r.entities_json || '{}',
      TasksJson: r.tasks_json || '[]',
      UpdatedOn: r.updated_on,
      Version: r.version || 1,
    };
  }

  async getAllFolderContexts(): Promise<FolderContextEntity[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM folder_context ORDER BY updated_on DESC`
    );
    return rows.map((r) => ({
      FolderId: r.folder_id,
      Summary: r.summary,
      EntitiesJson: r.entities_json || '{}',
      TasksJson: r.tasks_json || '[]',
      UpdatedOn: r.updated_on,
      Version: r.version || 1,
    }));
  }

  async getRecentlyUpdated(limit = 6): Promise<FolderContextEntity[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM folder_context ORDER BY updated_on DESC LIMIT ?`,
      [limit]
    );
    return rows.map((r) => ({
      FolderId: r.folder_id,
      Summary: r.summary,
      EntitiesJson: r.entities_json || '{}',
      TasksJson: r.tasks_json || '[]',
      UpdatedOn: r.updated_on,
      Version: r.version || 1,
    }));
  }

  async getContextsGeneratedTodayCount(): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0];
    const rows = await databaseService.executeQuery(
      `SELECT COUNT(*) as count FROM folder_context WHERE updated_on LIKE ?`,
      [`${todayStr}%`]
    );
    return rows.length > 0 ? rows[0].count : 0;
  }

  async deleteFolderContext(folderId: string): Promise<void> {
    await databaseService.executeCommand(
      `DELETE FROM folder_context WHERE folder_id = ?`,
      [folderId]
    );
  }
}

export const folderContextRepository = new FolderContextRepository();

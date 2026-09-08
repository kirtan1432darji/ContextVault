import { databaseService } from '../database';
import { ChatMessageModel, ChatMessageCitation, ChatHistoryEntity } from '../../models';

export interface RecentChatFolderSummary {
  folderId: string;
  folderName: string;
  iconName?: string;
  colorHex?: string;
  lastMessage: string;
  lastMessageRole: string;
  lastUpdated: string;
  messageCount: number;
}

export class ChatRepository {
  async saveMessage(
    msg: ChatMessageModel,
    folderId?: string,
    syncStatus = 'synced'
  ): Promise<void> {
    const citationsJson = JSON.stringify(msg.citations || []);
    const createdOn = msg.createdOn || msg.createdAt || new Date().toISOString();
    const targetFolderId = folderId || msg.folderId || null;

    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO chat_history (
        id, session_id, folder_id, screenshot_id, role, message, content, citations_json, created_on, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.id,
        msg.sessionId || null,
        targetFolderId,
        msg.screenshotId || null,
        msg.role,
        msg.content,
        msg.content,
        citationsJson,
        createdOn,
        createdOn,
        syncStatus,
      ]
    );
  }

  async saveMessages(
    msgs: ChatMessageModel[],
    folderId?: string,
    syncStatus = 'synced'
  ): Promise<void> {
    for (const msg of msgs) {
      await this.saveMessage(msg, folderId, syncStatus);
    }
  }

  async getMessagesByFolder(folderId: string, limit = 100, offset = 0): Promise<ChatMessageModel[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM chat_history 
       WHERE folder_id = ? 
       ORDER BY coalesce(created_on, created_at) ASC 
       LIMIT ? OFFSET ?`,
      [folderId, limit, offset]
    );

    return rows.map(this.mapRowToModel);
  }

  async getMessagesBySession(sessionId: string): Promise<ChatMessageModel[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM chat_history 
       WHERE session_id = ? 
       ORDER BY coalesce(created_on, created_at) ASC`,
      [sessionId]
    );

    return rows.map(this.mapRowToModel);
  }

  async deleteHistoryByFolder(folderId: string): Promise<void> {
    await databaseService.executeCommand(
      `DELETE FROM chat_history WHERE folder_id = ?`,
      [folderId]
    );
  }

  async deleteHistoryBySession(sessionId: string): Promise<void> {
    await databaseService.executeCommand(
      `DELETE FROM chat_history WHERE session_id = ?`,
      [sessionId]
    );
  }

  async getLatestMessage(folderId: string): Promise<ChatMessageModel | null> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM chat_history 
       WHERE folder_id = ? 
       ORDER BY coalesce(created_on, created_at) DESC 
       LIMIT 1`,
      [folderId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getRecentChatFolders(limit = 6): Promise<RecentChatFolderSummary[]> {
    const rows = await databaseService.executeQuery(
      `SELECT 
         ch.folder_id,
         c.name as folder_name,
         c.icon_name,
         c.color_hex,
         ch.message as last_message,
         ch.role as last_role,
         ch.created_on as last_updated,
         count_tbl.msg_count
       FROM chat_history ch
       INNER JOIN (
         SELECT folder_id, MAX(coalesce(created_on, created_at)) as max_created, COUNT(id) as msg_count
         FROM chat_history
         WHERE folder_id IS NOT NULL AND folder_id != ''
         GROUP BY folder_id
       ) count_tbl ON ch.folder_id = count_tbl.folder_id AND coalesce(ch.created_on, ch.created_at) = count_tbl.max_created
       LEFT JOIN categories c ON ch.folder_id = c.id
       ORDER BY ch.created_on DESC
       LIMIT ?`,
      [limit]
    );

    return rows.map((r) => ({
      folderId: r.folder_id,
      folderName: r.folder_name || r.folder_id || 'Smart Folder',
      iconName: r.icon_name || 'folder-outline',
      colorHex: r.color_hex || '#6366F1',
      lastMessage: r.last_message || 'Conversation started',
      lastMessageRole: r.last_role || 'assistant',
      lastUpdated: r.last_updated,
      messageCount: r.msg_count || 1,
    }));
  }

  private mapRowToModel(r: any): ChatMessageModel {
    let citations: ChatMessageCitation[] = [];
    if (r.citations_json) {
      try {
        citations = JSON.parse(r.citations_json);
      } catch {
        citations = [];
      }
    }

    return {
      id: r.id,
      sessionId: r.session_id || undefined,
      folderId: r.folder_id || undefined,
      screenshotId: r.screenshot_id || undefined,
      role: r.role as any,
      content: r.message || r.content || '',
      citations,
      createdAt: r.created_on || r.created_at || new Date().toISOString(),
      createdOn: r.created_on,
      syncStatus: (r.sync_status as any) || 'synced',
    };
  }
}

export const chatRepository = new ChatRepository();

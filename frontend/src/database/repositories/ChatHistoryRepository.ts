import { databaseService } from '../database';
import { ChatMessageCitation } from '../../models';

export interface ChatHistoryRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  referenced_screenshot_ids?: string[];
  timestamp: string;
  response_time_ms?: number;
  sessionId?: string;
  folderId?: string;
  citations?: ChatMessageCitation[];
}

export class ChatHistoryRepository {
  private static instance: ChatHistoryRepository | null = null;
  private columnsEnsured = false;

  static getInstance(): ChatHistoryRepository {
    if (!ChatHistoryRepository.instance) {
      ChatHistoryRepository.instance = new ChatHistoryRepository();
    }
    return ChatHistoryRepository.instance;
  }

  /**
   * Ensures new columns (referenced_screenshot_ids, response_time_ms) exist in chat_history.
   */
  async ensureColumns(): Promise<void> {
    if (this.columnsEnsured) return;
    try {
      await databaseService.executeCommand(
        `ALTER TABLE chat_history ADD COLUMN referenced_screenshot_ids TEXT;`
      ).catch(() => {});
      await databaseService.executeCommand(
        `ALTER TABLE chat_history ADD COLUMN response_time_ms INTEGER DEFAULT 0;`
      ).catch(() => {});
      this.columnsEnsured = true;
    } catch {
      // Columns may already exist
      this.columnsEnsured = true;
    }
  }

  /**
   * Saves a message record into the chat_history SQLite table.
   */
  async saveMessage(record: ChatHistoryRecord): Promise<void> {
    await this.ensureColumns();
    const referencedIdsJson = JSON.stringify(record.referenced_screenshot_ids || []);
    const citationsJson = JSON.stringify(record.citations || []);
    const responseTime = record.response_time_ms || 0;
    const ts = record.timestamp || new Date().toISOString();

    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO chat_history (
        id, session_id, folder_id, role, message, content, citations_json,
        referenced_screenshot_ids, response_time_ms, created_on, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.sessionId || null,
        record.folderId || null,
        record.role,
        record.message,
        record.message,
        citationsJson,
        referencedIdsJson,
        responseTime,
        ts,
        ts,
        'synced',
      ]
    );
  }

  /**
   * Retrieves conversation history sorted chronologically.
   */
  async getRecentMessages(limit = 50, sessionId?: string, folderId?: string): Promise<ChatHistoryRecord[]> {
    await this.ensureColumns();
    const conditions: string[] = [];
    const params: any[] = [];

    if (sessionId) {
      conditions.push('session_id = ?');
      params.push(sessionId);
    }
    if (folderId) {
      conditions.push('folder_id = ?');
      params.push(folderId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM chat_history ${whereClause} ORDER BY coalesce(created_on, created_at) ASC LIMIT ?`;
    params.push(limit);

    const rows = await databaseService.executeQuery(sql, params);
    return rows.map(this.mapRowToRecord);
  }

  /**
   * Clears chat history for a session, folder, or entirely.
   */
  async clearAllHistory(sessionId?: string, folderId?: string): Promise<void> {
    await this.ensureColumns();
    if (sessionId) {
      await databaseService.executeCommand(`DELETE FROM chat_history WHERE session_id = ?`, [sessionId]);
    } else if (folderId) {
      await databaseService.executeCommand(`DELETE FROM chat_history WHERE folder_id = ?`, [folderId]);
    } else {
      await databaseService.executeCommand(`DELETE FROM chat_history`);
    }
  }

  /**
   * Returns total count of messages in chat_history.
   */
  async getHistoryCount(): Promise<number> {
    await this.ensureColumns();
    try {
      const rows = await databaseService.executeQuery(`SELECT COUNT(*) as cnt FROM chat_history`);
      return rows[0]?.cnt || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Returns average AI response time in milliseconds.
   */
  async getAverageResponseTime(): Promise<number> {
    await this.ensureColumns();
    try {
      const rows = await databaseService.executeQuery(
        `SELECT AVG(response_time_ms) as avg_time FROM chat_history WHERE role = 'assistant' AND response_time_ms > 0`
      );
      const avg = rows[0]?.avg_time;
      return avg ? Math.round(Number(avg)) : 0;
    } catch {
      return 0;
    }
  }

  private mapRowToRecord(r: any): ChatHistoryRecord {
    let referencedIds: string[] = [];
    if (r.referenced_screenshot_ids) {
      try {
        referencedIds = JSON.parse(r.referenced_screenshot_ids);
      } catch {
        referencedIds = [];
      }
    }

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
      role: r.role,
      message: r.message || r.content || '',
      referenced_screenshot_ids: referencedIds,
      timestamp: r.created_on || r.created_at || new Date().toISOString(),
      response_time_ms: r.response_time_ms || 0,
      citations,
    };
  }
}

export const chatHistoryRepository = ChatHistoryRepository.getInstance();

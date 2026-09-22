/**
 * ChatSessionRepository.ts
 * Manages chat_sessions SQLite persistence for ContextVault Context Chat AI.
 * Stores conversation metadata, rolling summaries, and last message previews.
 */

import { databaseService } from '../database';

export interface ChatSessionRecord {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_preview?: string;
  summary?: string;
}

export class ChatSessionRepository {
  private static instance: ChatSessionRepository | null = null;
  private inMemorySessions: Map<string, ChatSessionRecord> = new Map();

  static getInstance(): ChatSessionRepository {
    if (!ChatSessionRepository.instance) {
      ChatSessionRepository.instance = new ChatSessionRepository();
    }
    return ChatSessionRepository.instance;
  }

  /**
   * Creates a new chat session.
   */
  async createSession(title = 'New Conversation', customId?: string): Promise<ChatSessionRecord> {
    const id = customId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: ChatSessionRecord = {
      id,
      title,
      created_at: now,
      updated_at: now,
      last_message_preview: '',
      summary: '',
    };

    this.inMemorySessions.set(id, { ...record });

    try {
      await databaseService.executeCommand(
        `INSERT OR REPLACE INTO chat_sessions (id, title, created_at, updated_at, last_message_preview, summary)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [record.id, record.title, record.created_at, record.updated_at, record.last_message_preview || '', record.summary || '']
      );
    } catch (err) {
      // In-memory fallback handles non-native / test execution
    }

    return record;
  }

  /**
   * Retrieves a chat session by ID.
   */
  async getSession(id: string): Promise<ChatSessionRecord | null> {
    try {
      const rows = await databaseService.executeQuery(
        `SELECT * FROM chat_sessions WHERE id = ? LIMIT 1`,
        [id]
      );
      if (rows && rows.length > 0) {
        const row = rows[0];
        const record: ChatSessionRecord = {
          id: row.id,
          title: row.title,
          created_at: row.created_at,
          updated_at: row.updated_at,
          last_message_preview: row.last_message_preview || undefined,
          summary: row.summary || undefined,
        };
        this.inMemorySessions.set(id, record);
        return record;
      }
    } catch {
      // Fall through to in-memory
    }

    return this.inMemorySessions.get(id) || null;
  }

  /**
   * Lists all chat sessions sorted by latest activity descending.
   */
  async listSessions(limit = 50): Promise<ChatSessionRecord[]> {
    try {
      const rows = await databaseService.executeQuery(
        `SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT ?`,
        [limit]
      );
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          created_at: r.created_at,
          updated_at: r.updated_at,
          last_message_preview: r.last_message_preview || undefined,
          summary: r.summary || undefined,
        }));
      }
    } catch {
      // Fall through to in-memory
    }

    return Array.from(this.inMemorySessions.values())
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }

  /**
   * Updates fields of a chat session.
   */
  async updateSession(id: string, updates: Partial<ChatSessionRecord>): Promise<void> {
    const existing = await this.getSession(id);
    if (!existing) {
      // If doesn't exist, create it with updates
      const created = await this.createSession(updates.title || 'Conversation', id);
      Object.assign(created, updates);
      this.inMemorySessions.set(id, created);
      return;
    }

    const updated: ChatSessionRecord = {
      ...existing,
      ...updates,
      updated_at: updates.updated_at || new Date().toISOString(),
    };

    this.inMemorySessions.set(id, updated);

    try {
      await databaseService.executeCommand(
        `UPDATE chat_sessions 
         SET title = ?, updated_at = ?, last_message_preview = ?, summary = ?
         WHERE id = ?`,
        [
          updated.title,
          updated.updated_at,
          updated.last_message_preview || '',
          updated.summary || '',
          id,
        ]
      );
    } catch {
      // In-memory fallback
    }
  }

  /**
   * Deletes a session and cascading messages.
   */
  async deleteSession(id: string): Promise<void> {
    this.inMemorySessions.delete(id);
    try {
      await databaseService.executeCommand(`DELETE FROM chat_messages WHERE session_id = ?`, [id]);
      await databaseService.executeCommand(`DELETE FROM chat_sessions WHERE id = ?`, [id]);
    } catch {
      // In-memory fallback
    }
  }

  /**
   * Clears all sessions and messages (used for reset/tests).
   */
  async clearAllSessions(): Promise<void> {
    this.inMemorySessions.clear();
    try {
      await databaseService.executeCommand(`DELETE FROM chat_messages`);
      await databaseService.executeCommand(`DELETE FROM chat_sessions`);
    } catch {
      // In-memory fallback
    }
  }
}

export const chatSessionRepository = ChatSessionRepository.getInstance();

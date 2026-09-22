/**
 * ChatMessageRepository.ts
 * Manages chat_messages SQLite persistence for ContextVault Context Chat AI.
 * Stores individual user and assistant messages, citations, and referenced screenshot IDs.
 */

import { databaseService } from '../database';
import { ChatMessageCitation } from '../../models';

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations_json?: string;
  screenshot_ids_json?: string;
  created_at: string;
  citations?: ChatMessageCitation[];
  screenshot_ids?: string[];
}

export class ChatMessageRepository {
  private static instance: ChatMessageRepository | null = null;
  private inMemoryMessages: Map<string, ChatMessageRecord[]> = new Map();

  static getInstance(): ChatMessageRepository {
    if (!ChatMessageRepository.instance) {
      ChatMessageRepository.instance = new ChatMessageRepository();
    }
    return ChatMessageRepository.instance;
  }

  /**
   * Saves a message record into the chat_messages table.
   */
  async saveMessage(msg: ChatMessageRecord): Promise<void> {
    const citationsJson = msg.citations_json || JSON.stringify(msg.citations || []);
    const screenshotIdsJson = msg.screenshot_ids_json || JSON.stringify(msg.screenshot_ids || []);
    const ts = msg.created_at || new Date().toISOString();

    const normalized: ChatMessageRecord = {
      ...msg,
      citations_json: citationsJson,
      screenshot_ids_json: screenshotIdsJson,
      created_at: ts,
    };

    // Store in-memory
    const sessionList = this.inMemoryMessages.get(msg.session_id) || [];
    const existingIdx = sessionList.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      sessionList[existingIdx] = normalized;
    } else {
      sessionList.push(normalized);
    }
    this.inMemoryMessages.set(msg.session_id, sessionList);

    try {
      await databaseService.executeCommand(
        `INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, citations_json, screenshot_ids_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          normalized.session_id,
          normalized.role,
          normalized.content,
          citationsJson,
          screenshotIdsJson,
          ts,
        ]
      );
    } catch {
      // In-memory fallback handles non-native / test execution
    }
  }

  /**
   * Retrieves messages for a session in chronological order.
   */
  async getMessagesBySession(sessionId: string, limit = 100): Promise<ChatMessageRecord[]> {
    try {
      const rows = await databaseService.executeQuery(
        `SELECT * FROM chat_messages 
         WHERE session_id = ? 
         ORDER BY created_at ASC 
         LIMIT ?`,
        [sessionId, limit]
      );
      if (rows && rows.length > 0) {
        return rows.map(this.mapRowToRecord);
      }
    } catch {
      // Fall through to in-memory
    }

    const list = this.inMemoryMessages.get(sessionId) || [];
    return [...list]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, limit);
  }

  /**
   * Returns total message count for a session.
   */
  async getMessageCount(sessionId: string): Promise<number> {
    try {
      const rows = await databaseService.executeQuery(
        `SELECT COUNT(*) as cnt FROM chat_messages WHERE session_id = ?`,
        [sessionId]
      );
      if (rows && rows.length > 0) {
        return Number(rows[0].cnt || 0);
      }
    } catch {
      // Fall through to in-memory
    }

    return (this.inMemoryMessages.get(sessionId) || []).length;
  }

  /**
   * Deletes all messages in a session.
   */
  async deleteMessagesBySession(sessionId: string): Promise<void> {
    this.inMemoryMessages.delete(sessionId);
    try {
      await databaseService.executeCommand(
        `DELETE FROM chat_messages WHERE session_id = ?`,
        [sessionId]
      );
    } catch {
      // In-memory fallback
    }
  }

  /**
   * Clears all messages across all sessions (used for test resets).
   */
  async clearAllMessages(): Promise<void> {
    this.inMemoryMessages.clear();
    try {
      await databaseService.executeCommand(`DELETE FROM chat_messages`);
    } catch {
      // In-memory fallback
    }
  }

  private mapRowToRecord(r: any): ChatMessageRecord {
    let citations: ChatMessageCitation[] = [];
    if (r.citations_json) {
      try {
        citations = JSON.parse(r.citations_json);
      } catch {
        citations = [];
      }
    }

    let screenshotIds: string[] = [];
    if (r.screenshot_ids_json) {
      try {
        screenshotIds = JSON.parse(r.screenshot_ids_json);
      } catch {
        screenshotIds = [];
      }
    }

    return {
      id: r.id,
      session_id: r.session_id,
      role: r.role,
      content: r.content,
      citations_json: r.citations_json,
      screenshot_ids_json: r.screenshot_ids_json,
      created_at: r.created_at,
      citations,
      screenshot_ids: screenshotIds,
    };
  }
}

export const chatMessageRepository = ChatMessageRepository.getInstance();

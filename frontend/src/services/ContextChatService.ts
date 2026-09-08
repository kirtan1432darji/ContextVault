import { apiClient } from '../api/apiClient';
import { chatRepository } from '../database/repositories/chatRepository';
import { folderContextRepository } from '../database/repositories/folderContextRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { searchService } from './searchService';
import {
  ChatMessageModel,
  ChatMessageCitation,
  ChatSuggestionsModel,
  ScreenshotModel,
} from '../models';

const formatFolderPath = (fp?: string | string[]): string | undefined => {
  if (!fp) return undefined;
  if (Array.isArray(fp)) return fp.join('/');
  return fp;
};

export interface SendMessageParams {
  folderId: string;
  folderName?: string;
  content: string;
  sessionId?: string;
  screenshotId?: string;
}

export class ContextChatService {
  /**
   * Sends a user message to Context AI.
   * Handles /search quick commands, online backend grounding,
   * offline local fallback, and persists every message locally in SQLite.
   */
  async sendMessage({
    folderId,
    folderName = 'Smart Folder',
    content,
    sessionId,
    screenshotId,
  }: SendMessageParams): Promise<{ userMessage: ChatMessageModel; assistantMessage: ChatMessageModel }> {
    const trimmed = content.trim();
    const now = new Date().toISOString();
    const effectiveSessionId = sessionId || `session_${folderId}`;

    // 1. Create and persist User Message
    const userMessage: ChatMessageModel = {
      id: `msg_usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: effectiveSessionId,
      folderId,
      screenshotId,
      role: 'user',
      content: trimmed,
      citations: [],
      createdAt: now,
      createdOn: now,
      syncStatus: 'synced',
    };

    await chatRepository.saveMessage(userMessage, folderId, 'synced');

    // 2. Check for quick command: /search <query>
    if (trimmed.toLowerCase().startsWith('/search')) {
      const searchQuery = trimmed.replace(/^\/search\s*/i, '').trim();
      const searchResultAssistant = await this.handleQuickSearch(
        searchQuery,
        folderId,
        effectiveSessionId
      );
      await chatRepository.saveMessage(searchResultAssistant, folderId, 'synced');
      return { userMessage, assistantMessage: searchResultAssistant };
    }

    // 3. Try Online Backend AI Response
    try {
      const response = await apiClient.sendChatMessage({
        sessionId: sessionId || undefined,
        folderId,
        screenshotId,
        content: trimmed,
      });

      if (response.isSuccess && response.data) {
        const d = response.data;
        const citations: ChatMessageCitation[] = (d.citations || []).map((c: any) => ({
          screenshotId: c.screenshotId,
          fileName: c.fileName || 'Screenshot',
          snippet: c.snippet || undefined,
          thumbnailPath: c.thumbnailPath || undefined,
          folderPath: c.folderPath || undefined,
          confidence: c.confidence || 0.95,
        }));

        const assistantMessage: ChatMessageModel = {
          id: d.id || `msg_ast_${Date.now()}`,
          sessionId: d.sessionId || effectiveSessionId,
          folderId,
          screenshotId,
          role: 'assistant',
          content: d.content || d.reply || 'Here is what I found in this folder.',
          citations,
          createdAt: d.createdAt || new Date().toISOString(),
          createdOn: d.createdAt || new Date().toISOString(),
          suggestedFollowUps: d.suggestedFollowUps || [],
          promptTokens: d.promptTokens,
          completionTokens: d.completionTokens,
          syncStatus: 'synced',
        };

        // Cache assistant message locally
        await chatRepository.saveMessage(assistantMessage, folderId, 'synced');
        return { userMessage, assistantMessage };
      }
    } catch (err) {
      console.warn('[ContextChatService] Backend request failed, utilizing offline grounding:', err);
    }

    // 4. Offline Fallback Grounding Engine
    const offlineAssistant = await this.generateOfflineResponse({
      folderId,
      folderName,
      query: trimmed,
      sessionId: effectiveSessionId,
      screenshotId,
    });

    await chatRepository.saveMessage(offlineAssistant, folderId, 'offline');
    return { userMessage, assistantMessage: offlineAssistant };
  }

  /**
   * Loads chat history for a folder.
   * Tries backend first; caches into SQLite; on failure/offline, loads SQLite cache.
   */
  async loadHistory(folderId: string, sessionId?: string): Promise<ChatMessageModel[]> {
    try {
      const res = await apiClient.fetchChatHistory(folderId, {
        sessionId,
        page: 1,
        pageSize: 50,
      });

      if (res.isSuccess && res.data && Array.isArray(res.data.messages)) {
        const backendMessages: ChatMessageModel[] = res.data.messages.map((m: any) => ({
          id: m.id,
          sessionId: m.sessionId,
          folderId: m.folderId || folderId,
          screenshotId: m.screenshotId,
          role: m.role,
          content: m.content,
          citations: (m.citations || []).map((c: any) => ({
            screenshotId: c.screenshotId,
            fileName: c.fileName,
            snippet: c.snippet,
            thumbnailPath: c.thumbnailPath,
            confidence: c.confidence || 0.9,
          })),
          createdAt: m.createdAt,
          createdOn: m.createdAt,
          suggestedFollowUps: m.suggestedFollowUps || [],
          syncStatus: 'synced',
        }));

        // Upsert into local SQLite cache
        if (backendMessages.length > 0) {
          await chatRepository.saveMessages(backendMessages, folderId, 'synced');
        }

        return backendMessages;
      }
    } catch (e) {
      console.warn('[ContextChatService] Offline mode: loading chat from local SQLite cache.');
    }

    // Load from local SQLite cache
    return await chatRepository.getMessagesByFolder(folderId);
  }

  /**
   * Fetches dynamic suggested questions.
   */
  async loadSuggestions(folderId: string, folderName = 'Smart Folder'): Promise<string[]> {
    try {
      const res = await apiClient.fetchChatSuggestions(folderId);
      if (res.isSuccess && res.data && Array.isArray(res.data.suggestions) && res.data.suggestions.length > 0) {
        return res.data.suggestions;
      }
    } catch (e) {
      // Offline fallback
    }

    // Heuristic contextual suggestions based on folder type and context
    return this.getFallbackSuggestions(folderName);
  }

  /**
   * Clears conversation history locally and on backend.
   */
  async deleteHistory(folderId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      try {
        await apiClient.deleteChatSession(sessionId);
      } catch {}
      await chatRepository.deleteHistoryBySession(sessionId);
    }
    await chatRepository.deleteHistoryByFolder(folderId);
  }

  /**
   * Handles `/search <query>` quick commands directly inside the chat.
   */
  private async handleQuickSearch(
    query: string,
    folderId: string,
    sessionId: string
  ): Promise<ChatMessageModel> {
    if (!query) {
      return {
        id: `msg_ast_${Date.now()}`,
        sessionId,
        folderId,
        role: 'assistant',
        content: 'Please provide a search term. Example: `/search invoice` or `/search payment`.',
        citations: [],
        createdAt: new Date().toISOString(),
        syncStatus: 'synced',
      };
    }

    // Execute local multi-field search
    const searchRes = await searchService.searchScreenshots(query, folderId);
    const localResults: ScreenshotModel[] =
      searchRes.isSuccess && searchRes.data ? searchRes.data.slice(0, 5) : [];

    if (localResults.length === 0) {
      return {
        id: `msg_ast_${Date.now()}`,
        sessionId,
        folderId,
        role: 'assistant',
        content: `No screenshots found matching **"${query}"** in this folder. Try another keyword or scan new screenshots.`,
        citations: [],
        createdAt: new Date().toISOString(),
        syncStatus: 'synced',
      };
    }

    const citations: ChatMessageCitation[] = localResults.map((s: ScreenshotModel) => ({
      screenshotId: s.id,
      fileName: s.fileName,
      snippet: s.ocrText ? s.ocrText.substring(0, 120) + '...' : undefined,
      folderPath: formatFolderPath(s.folderPath) || `/${s.categoryName}`,
      confidence: s.confidence,
    }));

    return {
      id: `msg_ast_${Date.now()}`,
      sessionId,
      folderId,
      role: 'assistant',
      content: `Found **${localResults.length}** screenshot${localResults.length > 1 ? 's' : ''} matching **"${query}"** in this folder:`,
      citations,
      createdAt: new Date().toISOString(),
      syncStatus: 'synced',
    };
  }

  /**
   * Synthesizes an intelligent offline response using local folder context and OCR data.
   */
  private async generateOfflineResponse({
    folderId,
    folderName,
    query,
    sessionId,
    screenshotId,
  }: {
    folderId: string;
    folderName: string;
    query: string;
    sessionId: string;
    screenshotId?: string;
  }): Promise<ChatMessageModel> {
    const qLower = query.toLowerCase();

    // 1. Fetch local folder context from SQLite
    const folderCtx = await folderContextRepository.getFolderContext(folderId);
    const screenshots = await screenshotRepository.getScreenshotsByCategoryId(folderId);

    const citations: ChatMessageCitation[] = screenshots.slice(0, 4).map((s: ScreenshotModel) => ({
      screenshotId: s.id,
      fileName: s.fileName,
      snippet: s.ocrText ? s.ocrText.substring(0, 100) + '...' : undefined,
      folderPath: formatFolderPath(s.folderPath) || `/${folderName}`,
      confidence: s.confidence || 0.9,
    }));

    let reply = '';

    if (qLower.includes('summar') || qLower.includes('overview') || qLower.includes('about')) {
      if (folderCtx?.Summary) {
        reply = `**${folderName} Summary (Offline Context):**\n\n${folderCtx.Summary}\n\n*Analyzed across ${screenshots.length} local screenshots.*`;
      } else {
        reply = `**${folderName} Overview:**\nThis folder currently contains **${screenshots.length} screenshots**. Key extracted topics relate to receipts, work items, and documents.`;
      }
    } else if (qLower.includes('task') || qLower.includes('action') || qLower.includes('todo') || qLower.includes('pending')) {
      let tasks: any[] = [];
      try {
        if (folderCtx?.TasksJson) tasks = JSON.parse(folderCtx.TasksJson);
      } catch {}

      if (tasks.length > 0) {
        const taskLines = tasks.map((t: any) => `- [${t.isCompleted ? 'x' : ' '}] **${t.title}** (${t.dueDate || 'No due date'})`).join('\n');
        reply = `**Action Items for ${folderName}:**\n\n${taskLines}`;
      } else {
        reply = `No pending action items were identified in **${folderName}**. All screenshots have been cataloged.`;
      }
    } else if (qLower.includes('pay') || qLower.includes('amount') || qLower.includes('cost') || qLower.includes('invoic') || qLower.includes('total')) {
      const match = screenshots.filter((s) => s.ocrText && (s.ocrText.includes('₹') || s.ocrText.includes('$') || s.ocrText.toLowerCase().includes('total') || s.ocrText.toLowerCase().includes('paid')));
      if (match.length > 0) {
        reply = `Found **${match.length}** financial/transaction records in **${folderName}**. Tap the citations below to review invoice details.`;
      } else {
        reply = `No specific financial totals or invoices were found in **${folderName}**.`;
      }
    } else if (qLower.includes('timeline') || qLower.includes('when') || qLower.includes('date')) {
      const sorted = [...screenshots].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (sorted.length > 0) {
        const latest = sorted[0];
        const oldest = sorted[sorted.length - 1];
        reply = `**Timeline Range for ${folderName}:**\n- Latest captured: **${new Date(latest.createdAt).toLocaleDateString()}**\n- Oldest captured: **${new Date(oldest.createdAt).toLocaleDateString()}**\n- Total activity points: ${sorted.length}`;
      } else {
        reply = `No timeline data available for this folder.`;
      }
    } else {
      reply = `Based on offline analysis of **${screenshots.length} screenshots** in **${folderName}**, here are the relevant records. You can ask for a summary, pending tasks, or specific amounts.`;
    }

    return {
      id: `msg_ast_${Date.now()}`,
      sessionId,
      folderId,
      screenshotId,
      role: 'assistant',
      content: reply,
      citations,
      createdAt: new Date().toISOString(),
      createdOn: new Date().toISOString(),
      suggestedFollowUps: [
        `Summarize ${folderName}`,
        'Show pending tasks',
        'Find key amounts or totals',
      ],
      syncStatus: 'offline',
    };
  }

  /**
   * Generates intelligent fallback suggestion chips based on folder category.
   */
  private getFallbackSuggestions(folderName: string): string[] {
    const fLower = folderName.toLowerCase();
    if (fLower.includes('receipt') || fLower.includes('bill') || fLower.includes('invoic') || fLower.includes('financ')) {
      return [
        'Summarize this folder',
        'Find total amount spent',
        'Find invoices and receipts',
        'Show payment dates',
      ];
    }
    if (fLower.includes('project') || fLower.includes('work') || fLower.includes('task')) {
      return [
        'Summarize this project',
        'Show pending action items',
        'Show project timeline',
        'List deliverables',
      ];
    }
    if (fLower.includes('shop') || fLower.includes('order')) {
      return [
        'Summarize shopping items',
        'List items and prices',
        'Find order status and delivery',
      ];
    }
    return [
      'Summarize this folder',
      'Show pending tasks',
      'Find key amounts or totals',
      'Show timeline of events',
    ];
  }
}

export const contextChatService = new ContextChatService();

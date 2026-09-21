/**
 * ContextChatService.ts
 * Flagship Context Chat Service for ContextVault.
 * Answers natural-language questions using on-device SQLite, OCR text, and Vision AI metadata.
 * Only invokes the Local Vision AI Server if online and metadata is missing.
 * Falls back gracefully to 100% offline metadata answering with "Offline metadata response." banner.
 * Never displays "Network Error" and keeps conversations entirely on-device.
 */

import { chatHistoryRepository, ChatHistoryRecord } from '../../database/repositories/ChatHistoryRepository';
import { categoryRepository } from '../../database/repositories/categoryRepository';
import { ChatMessageCitation, ChatMessageModel, ScreenshotModel } from '../../models';
import { visionAIService } from '../visionAIService';
import { ContextRetrievalService, RetrievedScreenshotContext, contextRetrievalService } from './ContextRetrievalService';
import { QueryIntentParser, ParsedQueryIntent } from './QueryIntentParser';
import { ContextPromptBuilder } from './ContextPromptBuilder';

export interface ChatAnswerResult {
  answer: string;
  citedScreenshots: ScreenshotModel[];
  citations: ChatMessageCitation[];
  isOfflineResponse: boolean;
  bannerMessage?: string;
  responseTimeMs: number;
  userMessageId: string;
  assistantMessageId: string;
  matchedIntent?: ParsedQueryIntent;
}

export interface ChatOptions {
  folderId?: string;
  sessionId?: string;
  forceOffline?: boolean;
}

export class ContextChatService {
  private static instance: ContextChatService | null = null;

  static getInstance(): ContextChatService {
    if (!ContextChatService.instance) {
      ContextChatService.instance = new ContextChatService();
    }
    return ContextChatService.instance;
  }

  /**
   * Primary Entry Point: Asks a natural-language question against personal screenshots.
   */
  async askQuestion(question: string, options?: ChatOptions): Promise<ChatAnswerResult> {
    const startTime = Date.now();
    const trimmed = (question || '').trim();
    const sessionId = options?.sessionId || (options?.folderId ? `session_${options.folderId}` : 'session_global');
    const now = new Date().toISOString();

    const userMessageId = `msg_usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Persist User Message to SQLite immediately
    await chatHistoryRepository.saveMessage({
      id: userMessageId,
      role: 'user',
      message: trimmed,
      sessionId,
      folderId: options?.folderId,
      timestamp: now,
    });

    // 2. Parse Query Intent
    const intent = QueryIntentParser.parse(trimmed);

    // 3. Retrieve and Rank Candidate Screenshots (up to 20)
    const contexts = await contextRetrievalService.retrieveContext(
      trimmed,
      options?.folderId,
      intent
    );

    // 4. Check Vision Server Status (Optional Enrichment)
    let visionOnline = false;
    if (!options?.forceOffline) {
      try {
        const ping = await visionAIService.pingVisionServer();
        visionOnline = Boolean(ping.online);
      } catch {
        visionOnline = false;
      }
    }

    // 5. Generate Grounded AI Answer
    const { answer, isOffline, banner } = await this.generateContextAnswer(
      trimmed,
      contexts,
      intent,
      visionOnline
    );

    const responseTimeMs = Date.now() - startTime;
    const assistantMessageId = `msg_ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const citedScreenshots = contexts.slice(0, 10).map((c) => c.screenshot);
    const citations: ChatMessageCitation[] = contexts.slice(0, 10).map((c) => ({
      screenshotId: c.screenshot.id,
      fileName: c.screenshot.fileName,
      snippet: c.visionSummary || c.ocrText.substring(0, 120),
      thumbnailPath: c.screenshot.thumbnailUri || c.screenshot.contentUri || c.screenshot.filePath,
      folderPath: c.screenshot.folderPath ? c.screenshot.folderPath.join('/') : c.category,
      confidence: c.screenshot.confidence,
    }));

    const citedIds = citedScreenshots.map((s) => s.id);

    // 6. Persist Assistant Response locally
    await chatHistoryRepository.saveMessage({
      id: assistantMessageId,
      role: 'assistant',
      message: answer,
      referenced_screenshot_ids: citedIds,
      timestamp: new Date().toISOString(),
      response_time_ms: responseTimeMs,
      sessionId,
      folderId: options?.folderId,
      citations,
    });

    return {
      answer,
      citedScreenshots,
      citations,
      isOfflineResponse: isOffline,
      bannerMessage: banner,
      responseTimeMs,
      userMessageId,
      assistantMessageId,
      matchedIntent: intent,
    };
  }

  /**
   * Generates a grounded, factual answer based strictly on retrieved contexts.
   */
  async generateContextAnswer(
    question: string,
    contexts: RetrievedScreenshotContext[],
    intent?: ParsedQueryIntent,
    visionOnline = false
  ): Promise<{ answer: string; isOffline: boolean; banner?: string }> {
    const isOffline = !visionOnline;
    const banner = isOffline ? 'Offline metadata response.' : undefined;

    if (contexts.length === 0) {
      return {
        answer: `I searched your screenshots in ContextVault, but couldn't find any matching records for "${question}".\n\nTip: You can ask about payments (e.g. "payments above ₹500"), food orders ("Swiggy receipts"), travel tickets, or documents like Aadhaar.`,
        isOffline,
        banner,
      };
    }

    // Synthesis based on recognized intent domain
    const activeIntent = intent || QueryIntentParser.parse(question);

    switch (activeIntent.domain) {
      case 'finance':
        return {
          answer: this.synthesizeFinanceAnswer(contexts, activeIntent),
          isOffline,
          banner,
        };

      case 'food_delivery':
        return {
          answer: this.synthesizeFoodAnswer(contexts, activeIntent),
          isOffline,
          banner,
        };

      case 'travel':
        return {
          answer: this.synthesizeTravelAnswer(contexts, activeIntent),
          isOffline,
          banner,
        };

      case 'documents':
        return {
          answer: this.synthesizeDocumentAnswer(contexts, activeIntent),
          isOffline,
          banner,
        };

      case 'chats':
        return {
          answer: this.synthesizeChatAnswer(contexts, activeIntent),
          isOffline,
          banner,
        };

      default:
        return {
          answer: this.synthesizeGeneralAnswer(contexts, question),
          isOffline,
          banner,
        };
    }
  }

  // ===========================================================================
  // Specialized Domain Synthesizers (Factual, grounded in SQLite metadata)
  // ===========================================================================

  private synthesizeFinanceAnswer(
    contexts: RetrievedScreenshotContext[],
    intent: ParsedQueryIntent
  ): string {
    let totalSum = 0;
    const items: string[] = [];

    contexts.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const m = ctx.merchants[0] || s.subcategory || 'Payment';
      const amtStr = ctx.amounts[0];
      const amt = amtStr ? parseFloat(amtStr) : 0;
      if (amt > 0) totalSum += amt;

      const dateStr = ctx.date ? ctx.date.split('T')[0] : '';
      items.push(`• **${m}**: ₹${amt > 0 ? amt.toLocaleString('en-IN') : 'N/A'}${dateStr ? ` on ${dateStr}` : ''} (${s.fileName})`);
    });

    let header = `Found **${contexts.length}** payment screenshot(s)`;
    if (intent.merchant) header += ` for **${intent.merchant}**`;
    if (intent.minAmount !== undefined) header += ` above **₹${intent.minAmount}**`;
    if (intent.maxAmount !== undefined) header += ` below **₹${intent.maxAmount}**`;
    header += ':\n\n';

    let summary = header + items.join('\n');
    if (totalSum > 0) {
      summary += `\n\n**Total Estimated Amount**: ₹${totalSum.toLocaleString('en-IN')}`;
    }

    return summary;
  }

  private synthesizeFoodAnswer(
    contexts: RetrievedScreenshotContext[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    contexts.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const m = ctx.merchants[0] || 'Food Order';
      const amt = ctx.amounts[0] ? `₹${ctx.amounts[0]}` : '';
      const dateStr = ctx.date ? ctx.date.split('T')[0] : '';
      items.push(`• **${m}** ${amt ? `(${amt})` : ''}${dateStr ? ` • ${dateStr}` : ''}: ${ctx.visionSummary || s.fileName}`);
    });

    const merchantLabel = intent.merchant || 'Food Delivery';
    return `Found **${contexts.length}** ${merchantLabel} order(s) in your screenshots:\n\n${items.join('\n')}`;
  }

  private synthesizeTravelAnswer(
    contexts: RetrievedScreenshotContext[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    contexts.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const m = ctx.merchants[0] || 'Booking';
      const pnrTag = ctx.tags.find((t) => t.startsWith('pnr_'));
      const flightTag = ctx.tags.find((t) => /^(6e|ai|uk|sg|qp|ix)\d+/i.test(t));
      const details = [pnrTag ? `PNR: ${pnrTag.replace('pnr_', '')}` : '', flightTag ? `Flight: ${flightTag.toUpperCase()}` : '']
        .filter(Boolean)
        .join(', ');

      items.push(`• **${m}**${details ? ` (${details})` : ''}: ${ctx.visionSummary || s.fileName}`);
    });

    return `Found **${contexts.length}** travel ticket(s) or booking screenshot(s):\n\n${items.join('\n')}`;
  }

  private synthesizeDocumentAnswer(
    contexts: RetrievedScreenshotContext[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    contexts.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const sub = s.subcategory && s.subcategory !== 'General' ? s.subcategory : 'Government ID / Document';
      items.push(`• **${sub}**: ${s.fileName}${ctx.visionSummary ? ` — ${ctx.visionSummary}` : ''}`);
    });

    const docTypeLabel = intent.documentType ? intent.documentType.toUpperCase() : 'Official Document';
    return `Found **${contexts.length}** ${docTypeLabel} screenshot(s):\n\n${items.join('\n')}\n\n*All document data remains securely stored on your local device.*`;
  }

  private synthesizeChatAnswer(
    contexts: RetrievedScreenshotContext[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    contexts.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const app = intent.appFilter || s.subcategory || 'Messaging';
      items.push(`• **${app}**: ${s.fileName}${ctx.visionSummary ? ` — ${ctx.visionSummary}` : ''}`);
    });

    return `Found **${contexts.length}** chat/messaging screenshot(s):\n\n${items.join('\n')}`;
  }

  private synthesizeGeneralAnswer(
    contexts: RetrievedScreenshotContext[],
    question: string
  ): string {
    const items: string[] = [];
    contexts.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const cat = s.categoryName || ctx.category;
      items.push(`• **${cat}** (${s.fileName}): ${ctx.visionSummary || ctx.ocrText.substring(0, 80) || 'Screenshot saved in vault'}`);
    });

    return `Here is what I found across **${contexts.length}** relevant screenshot(s) for "${question}":\n\n${items.join('\n')}`;
  }

  // ===========================================================================
  // Public Convenience Methods
  // ===========================================================================

  async summarizeFolder(folderId: string): Promise<ChatAnswerResult> {
    return this.askQuestion(`Summarize screenshots in folder ${folderId}`, { folderId });
  }

  async summarizeToday(): Promise<ChatAnswerResult> {
    return this.askQuestion('Summarize screenshots from today');
  }

  async summarizeMerchant(merchant: string): Promise<ChatAnswerResult> {
    return this.askQuestion(`Show screenshots and receipts from ${merchant}`);
  }

  async summarizePayments(minAmount = 0): Promise<ChatAnswerResult> {
    return this.askQuestion(`Show payments above ₹${minAmount}`);
  }

  async findTravelTickets(): Promise<ChatAnswerResult> {
    return this.askQuestion('Find flight and train tickets');
  }

  async findDocuments(docType?: string): Promise<ChatAnswerResult> {
    return this.askQuestion(docType ? `Find ${docType} screenshots` : 'Find official documents');
  }

  // ===========================================================================
  // History & Store Support APIs (Backward compatibility with useChatStore)
  // ===========================================================================

  async loadHistory(folderId?: string, sessionId?: string): Promise<ChatMessageModel[]> {
    const records = await chatHistoryRepository.getRecentMessages(50, sessionId, folderId);
    return records.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      folderId: r.folderId,
      role: r.role as any,
      content: r.message,
      citations: r.citations || [],
      createdAt: r.timestamp,
      createdOn: r.timestamp,
      syncStatus: 'synced',
    }));
  }

  async clearHistory(folderId?: string, sessionId?: string): Promise<void> {
    await chatHistoryRepository.clearAllHistory(sessionId, folderId);
  }

  async deleteHistory(folderId?: string, sessionId?: string): Promise<void> {
    return this.clearHistory(folderId, sessionId);
  }

  /**
   * Generates dynamic suggested question chips based on actual SQLite metadata.
   */
  async loadSuggestions(folderId?: string, folderName?: string): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      const allCats = await categoryRepository.getAllCategories();
      const catIds = allCats
        .filter((c) => (c.screenshotCount || 0) > 0)
        .map((c) => c.id.toLowerCase());

      if (catIds.includes('finance')) {
        suggestions.push('Show payments above ₹500');
        suggestions.push('Find PhonePe receipts');
      }
      if (catIds.includes('food_delivery')) {
        suggestions.push('Find Swiggy orders');
      }
      if (catIds.includes('documents')) {
        suggestions.push('Show Aadhaar screenshots');
      }
      if (catIds.includes('travel')) {
        suggestions.push('Find flight tickets');
      }
      if (catIds.includes('shopping')) {
        suggestions.push('Find Amazon receipts');
      }
      if (catIds.includes('chats')) {
        suggestions.push('Show WhatsApp screenshots');
      }
    } catch {
      // Default suggestions if category lookup fails
    }

    if (suggestions.length === 0) {
      return [
        'Show payments above ₹500',
        'Find Swiggy orders',
        'Show Aadhaar screenshots',
        'Summarize today\'s screenshots',
      ];
    }

    suggestions.push('Summarize today\'s screenshots');
    return Array.from(new Set(suggestions)).slice(0, 6);
  }

  /**
   * Legacy sendMessage method preserving useChatStore compatibility.
   */
  async sendMessage(params: {
    folderId: string;
    folderName?: string;
    content: string;
    sessionId?: string;
    screenshotId?: string;
  }): Promise<{ userMessage: ChatMessageModel; assistantMessage: ChatMessageModel }> {
    const result = await this.askQuestion(params.content, {
      folderId: params.folderId,
      sessionId: params.sessionId,
    });

    const userMessage: ChatMessageModel = {
      id: result.userMessageId,
      sessionId: params.sessionId,
      folderId: params.folderId,
      screenshotId: params.screenshotId,
      role: 'user',
      content: params.content,
      citations: [],
      createdAt: new Date().toISOString(),
      syncStatus: 'synced',
    };

    const assistantMessage: ChatMessageModel = {
      id: result.assistantMessageId,
      sessionId: params.sessionId,
      folderId: params.folderId,
      screenshotId: params.screenshotId,
      role: 'assistant',
      content: result.answer,
      citations: result.citations,
      createdAt: new Date().toISOString(),
      syncStatus: result.isOfflineResponse ? 'offline' : 'synced',
    };

    return { userMessage, assistantMessage };
  }
}

export const contextChatService = ContextChatService.getInstance();

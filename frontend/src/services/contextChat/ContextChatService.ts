/**
 * ContextChatService.ts
 * Flagship Context Chat Service for ContextVault Context Chat AI (Sprint P3-B).
 * Answers natural-language questions using on-device SQLite, Vision AI metadata,
 * Memory Timeline events, Daily/Weekly Digests, and Smart Folder summaries.
 * 
 * Pipeline:
 * 1. User Question -> SQLite chat_messages persistence
 * 2. Hybrid Context Retrieval (Screenshots, Timeline, Digests, Folders, Session Summary)
 * 3. Grounded Prompt Builder
 * 4. Local Vision AI Server Query (when online) or Local Grounded Synthesis Fallback
 * 5. Structured Citation Extraction (tappable screenshots)
 * 6. Progressive Status Updates & Three-Level Conversation Memory (20-message summary)
 * 7. Dynamic Suggestion Chips
 */

import { chatSessionRepository, ChatSessionRecord } from '../../database/repositories/ChatSessionRepository';
import { chatMessageRepository, ChatMessageRecord } from '../../database/repositories/ChatMessageRepository';
import { chatHistoryRepository } from '../../database/repositories/ChatHistoryRepository';
import { categoryRepository } from '../../database/repositories/categoryRepository';
import { ChatMessageCitation, ChatMessageModel, ScreenshotModel } from '../../models';
import { visionAIService } from '../visionAIService';
import { BackendConnectionManager } from '../BackendConnectionManager';
import {
  ContextRetrievalService,
  RetrievedScreenshotContext,
  RankedRetrievalContext,
  contextRetrievalService,
} from './ContextRetrievalService';
import { QueryIntentParser, ParsedQueryIntent } from './QueryIntentParser';
import { contextPromptBuilderService } from './ContextPromptBuilderService';
import axios from 'axios';

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
  suggestedFollowUps?: string[];
}

export interface ChatOptions {
  folderId?: string;
  sessionId?: string;
  forceOffline?: boolean;
  onStatusChange?: (status: string) => void;
  onProgress?: (partial: string) => void;
}

export class ContextChatService {
  private static instance: ContextChatService | null = null;

  static getInstance(): ContextChatService {
    if (!ContextChatService.instance) {
      ContextChatService.instance = new ContextChatService();
    }
    return ContextChatService.instance;
  }

  // ===========================================================================
  // Session Management APIs
  // ===========================================================================

  /**
   * Creates a new conversation session.
   */
  async createSession(title = 'New Conversation', customId?: string): Promise<ChatSessionRecord> {
    return chatSessionRepository.createSession(title, customId);
  }

  /**
   * Lists active conversation sessions sorted by most recent activity.
   */
  async listSessions(limit = 30): Promise<ChatSessionRecord[]> {
    return chatSessionRepository.listSessions(limit);
  }

  /**
   * Loads a specific conversation session and its messages.
   */
  async loadSession(sessionId: string): Promise<{ session: ChatSessionRecord | null; messages: ChatMessageRecord[] }> {
    const [session, messages] = await Promise.all([
      chatSessionRepository.getSession(sessionId),
      chatMessageRepository.getMessagesBySession(sessionId, 100),
    ]);
    return { session, messages };
  }

  /**
   * Renames a chat session.
   */
  async renameSession(sessionId: string, newTitle: string): Promise<void> {
    await chatSessionRepository.updateSession(sessionId, { title: newTitle });
  }

  /**
   * Deletes a chat session and all associated messages.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await chatMessageRepository.deleteMessagesBySession(sessionId);
    await chatSessionRepository.deleteSession(sessionId);
  }

  // ===========================================================================
  // Primary Entry Point: Ask Question / Send Message
  // ===========================================================================

  /**
   * Primary Entry Point: Asks a natural-language question against personal screenshots.
   */
  async askQuestion(question: string, options?: ChatOptions): Promise<ChatAnswerResult> {
    const startTime = Date.now();
    const trimmed = (question || '').trim();
    const sessionId = options?.sessionId || (options?.folderId ? `session_${options.folderId}` : 'session_global');
    const now = new Date().toISOString();

    options?.onStatusChange?.('Initializing conversation...');

    // Ensure session exists in SQLite
    let session = await chatSessionRepository.getSession(sessionId);
    if (!session) {
      const title = trimmed.length > 30 ? `${trimmed.substring(0, 30)}...` : trimmed;
      session = await chatSessionRepository.createSession(title || 'Conversation', sessionId);
    }

    const userMessageId = `msg_usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Persist User Message to SQLite (chat_messages & legacy chat_history)
    const userMsgRecord: ChatMessageRecord = {
      id: userMessageId,
      session_id: sessionId,
      role: 'user',
      content: trimmed,
      created_at: now,
    };
    await chatMessageRepository.saveMessage(userMsgRecord);

    await chatHistoryRepository.saveMessage({
      id: userMessageId,
      role: 'user',
      message: trimmed,
      sessionId,
      folderId: options?.folderId,
      timestamp: now,
    }).catch(() => {});

    // Update session last preview
    await chatSessionRepository.updateSession(sessionId, {
      last_message_preview: trimmed,
      updated_at: now,
    });

    // 2. Parse Query Intent
    options?.onStatusChange?.('Parsing question intent...');
    const intent = QueryIntentParser.parse(trimmed);

    // 3. Multi-Source Hybrid Context Retrieval
    options?.onStatusChange?.('Retrieving memories & timeline...');
    const hybridContext = await contextRetrievalService.retrieveHybridContext(trimmed, {
      folderId: options?.folderId,
      sessionId,
      customIntent: intent,
    });

    // 4. Build Grounded Prompt
    options?.onStatusChange?.('Building grounded context...');
    const recentMessages = await chatMessageRepository.getMessagesBySession(sessionId, 6);
    const prompt = contextPromptBuilderService.buildGroundedPrompt(
      trimmed,
      hybridContext,
      recentMessages,
      { maxContextScreenshots: 10 }
    );

    // 5. Query Local AI Server or Local Grounded Synthesis Fallback
    options?.onStatusChange?.('Generating assistant response...');
    let answer = '';
    let isOffline = true;
    let banner: string | undefined = undefined;

    if (!options?.forceOffline) {
      try {
        const ping = await visionAIService.pingVisionServer();
        if (ping.online) {
          // Attempt chat endpoint on Vision AI gateway proxy (Qwen on RTX 4050)
          const visionChatUrl = `${BackendConnectionManager.getApiUrl()}/vision/chat`;
          const response = await axios.post(
            visionChatUrl,
            {
              sessionId,
              content: trimmed,
              prompt,
            },
            { timeout: 30000 }
          );

          if (response.data && response.data.content) {
            answer = response.data.content;
            isOffline = false;
          } else if (response.data && response.data.data && response.data.data.content) {
            answer = response.data.data.content;
            isOffline = false;
          }
        }
      } catch {
        // Fall back gracefully to on-device grounded synthesis
        isOffline = true;
      }
    }

    if (!answer) {
      // Local Grounded Offline Synthesis
      const synth = await this.generateContextAnswer(
        trimmed,
        hybridContext,
        intent,
        !isOffline
      );
      answer = synth.answer;
      isOffline = true;
      banner = 'Offline metadata response.';
    }

    options?.onProgress?.(answer);

    const responseTimeMs = Date.now() - startTime;
    const assistantMessageId = `msg_ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 6. Build Rich Citations
    const citedScreenshots = hybridContext.screenshots.map((c) => c.screenshot);
    const citations: ChatMessageCitation[] = hybridContext.screenshots.map((c) => {
      const s = c.screenshot;
      const amtStr = c.amounts[0];
      const amt = amtStr ? parseFloat(amtStr) : undefined;
      return {
        screenshotId: s.id,
        fileName: s.fileName,
        snippet: c.visionSummary || c.ocrText.substring(0, 120),
        thumbnailPath: s.thumbnailUri || s.contentUri || s.filePath,
        folderPath: s.categoryName || c.category,
        confidence: s.confidence,
        merchant: c.merchants[0] || s.subcategory,
        amount: !isNaN(amt as any) ? amt : undefined,
        date: c.date ? c.date.split('T')[0] : undefined,
      };
    });

    const citedIds = citedScreenshots.map((s) => s.id);

    // 7. Persist Assistant Message
    const assistantMsgRecord: ChatMessageRecord = {
      id: assistantMessageId,
      session_id: sessionId,
      role: 'assistant',
      content: answer,
      citations_json: JSON.stringify(citations),
      screenshot_ids_json: JSON.stringify(citedIds),
      created_at: new Date().toISOString(),
      citations,
      screenshot_ids: citedIds,
    };
    await chatMessageRepository.saveMessage(assistantMsgRecord);

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
    }).catch(() => {});

    // Update session
    await chatSessionRepository.updateSession(sessionId, {
      last_message_preview: answer.substring(0, 80),
      updated_at: new Date().toISOString(),
    });

    // 8. Progressive Conversation Memory Summarization (Every 20 messages)
    this.checkAndSummarizeSession(sessionId).catch(() => {});

    // 9. Generate Contextual Follow-up Suggestions
    const suggestedFollowUps = this.generateContextualSuggestions(intent, hybridContext);

    options?.onStatusChange?.('Complete');

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
      suggestedFollowUps,
    };
  }

  /**
   * Regenerates response for the latest user message in a session.
   */
  async regenerateResponse(sessionId: string, options?: ChatOptions): Promise<ChatAnswerResult> {
    const messages = await chatMessageRepository.getMessagesBySession(sessionId, 10);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');

    if (!lastUserMsg) {
      throw new Error('No user question found in this session to regenerate.');
    }

    return this.askQuestion(lastUserMsg.content, {
      ...options,
      sessionId,
    });
  }

  /**
   * Checks message count in session and synthesizes a progressive summary every 20 messages.
   */
  private async checkAndSummarizeSession(sessionId: string): Promise<void> {
    try {
      const count = await chatMessageRepository.getMessageCount(sessionId);
      if (count > 0 && count % 20 === 0) {
        const allMsgs = await chatMessageRepository.getMessagesBySession(sessionId, 40);
        const userQuestions = allMsgs
          .filter((m) => m.role === 'user')
          .map((m) => m.content)
          .slice(-10);

        const summary = `Session topics covered: ${userQuestions.join('; ')}. Focus on recent user queries regarding transactions, travel, and documents.`;
        await chatSessionRepository.updateSession(sessionId, { summary });
      }
    } catch {
      // Ignored non-fatal summary check
    }
  }

  // ===========================================================================
  // Grounded On-Device Synthesis (Pure SQLite Metadata)
  // ===========================================================================

  async generateContextAnswer(
    question: string,
    context: RankedRetrievalContext | RetrievedScreenshotContext[],
    intent?: ParsedQueryIntent,
    visionOnline = false
  ): Promise<{ answer: string; isOffline: boolean; banner?: string }> {
    const isOffline = !visionOnline;
    const banner = isOffline ? 'Offline metadata response.' : undefined;

    const hybrid: RankedRetrievalContext = Array.isArray(context)
      ? {
          screenshots: context,
          timelineEvents: [],
          digestSummaries: [],
          folderContexts: [],
          query: question,
        }
      : context;

    const { screenshots, timelineEvents, digestSummaries } = hybrid;

    if (screenshots.length === 0 && timelineEvents.length === 0 && digestSummaries.length === 0) {
      return {
        answer: `I searched your screenshots in ContextVault, but couldn't find any matching records for "${question}".\n\nTip: You can ask about payments (e.g. "Google Pay payments this month"), orders ("Amazon receipts"), travel ("Delhi flight"), or summaries ("Summarize today's screenshots").`,
        isOffline,
        banner,
      };
    }

    const activeIntent = intent || QueryIntentParser.parse(question);
    const qLower = question.toLowerCase();

    // Check if query specifically targets daily/weekly digests
    if (qLower.includes('today') && (qLower.includes('summary') || qLower.includes('summarize'))) {
      return {
        answer: this.synthesizeTodaySummary(hybrid),
        isOffline,
        banner,
      };
    }

    if (qLower.includes('week') && (qLower.includes('spend') || qLower.includes('spending') || qLower.includes('total'))) {
      return {
        answer: this.synthesizeWeeklySpending(hybrid, activeIntent),
        isOffline,
        banner,
      };
    }

    // Synthesis based on recognized intent domain
    switch (activeIntent.domain) {
      case 'finance':
        return {
          answer: this.synthesizeFinanceAnswer(screenshots, timelineEvents, activeIntent),
          isOffline,
          banner,
        };

      case 'food_delivery':
        return {
          answer: this.synthesizeFoodAnswer(screenshots, timelineEvents, activeIntent),
          isOffline,
          banner,
        };

      case 'travel':
        return {
          answer: this.synthesizeTravelAnswer(screenshots, timelineEvents, activeIntent),
          isOffline,
          banner,
        };

      case 'shopping':
        return {
          answer: this.synthesizeShoppingAnswer(screenshots, timelineEvents, activeIntent),
          isOffline,
          banner,
        };

      case 'documents':
        return {
          answer: this.synthesizeDocumentAnswer(screenshots, activeIntent),
          isOffline,
          banner,
        };

      case 'chats':
        return {
          answer: this.synthesizeChatAnswer(screenshots, activeIntent),
          isOffline,
          banner,
        };

      default:
        return {
          answer: this.synthesizeGeneralAnswer(hybrid, question),
          isOffline,
          banner,
        };
    }
  }

  // ===========================================================================
  // Domain Answer Synthesizers
  // ===========================================================================

  private synthesizeTodaySummary(hybrid: RankedRetrievalContext): string {
    const todayDigest = hybrid.digestSummaries.find((d) => d.type === 'daily');
    const items: string[] = [];

    if (hybrid.screenshots.length === 0 && (!todayDigest || todayDigest.screenshotCount === 0)) {
      return `I searched your screenshots in ContextVault, but couldn't find any matching records for today.\n\nTip: Take or import new screenshots to generate today's summary.`;
    }

    hybrid.screenshots.slice(0, 6).forEach((ctx) => {
      const m = ctx.merchants[0] || ctx.screenshot.categoryName || 'Screenshot';
      const amt = ctx.amounts[0] ? ` • ₹${ctx.amounts[0]}` : '';
      items.push(`• **${m}**${amt}: ${ctx.visionSummary || ctx.screenshot.fileName}`);
    });

    let header = `### Today's Screenshot Summary\n`;
    if (todayDigest) {
      header += `${todayDigest.summary}\n\n`;
      if (todayDigest.spendingTotal && todayDigest.spendingTotal > 0) {
        header += `**Total Spent Today**: ₹${todayDigest.spendingTotal.toLocaleString('en-IN')}\n\n`;
      }
    } else {
      header += `Found **${hybrid.screenshots.length}** screenshot(s) captured today:\n\n`;
    }

    return header + (items.length > 0 ? items.join('\n') : 'No new screenshots recorded for today.');
  }

  private synthesizeWeeklySpending(hybrid: RankedRetrievalContext, intent: ParsedQueryIntent): string {
    const weeklyDigest = hybrid.digestSummaries.find((d) => d.type === 'weekly');
    const targetMerchant = intent.merchant?.toLowerCase();

    let totalSum = 0;
    const items: string[] = [];

    hybrid.screenshots.forEach((ctx) => {
      const m = ctx.merchants[0] || ctx.screenshot.subcategory || 'Expense';
      if (targetMerchant && !m.toLowerCase().includes(targetMerchant) && !ctx.ocrText.toLowerCase().includes(targetMerchant)) {
        return;
      }
      const amtStr = ctx.amounts[0];
      const amt = amtStr ? parseFloat(amtStr) : 0;
      if (amt > 0) totalSum += amt;
      const dateStr = ctx.date ? ctx.date.split('T')[0] : '';
      items.push(`• **${m}**: ₹${amt > 0 ? amt.toLocaleString('en-IN') : 'N/A'}${dateStr ? ` on ${dateStr}` : ''}`);
    });

    let header = `### Spending This Week`;
    if (intent.merchant) header += ` on ${intent.merchant}`;
    header += '\n\n';

    if (items.length > 0) {
      header += items.join('\n') + `\n\n**Total Amount**: ₹${totalSum.toLocaleString('en-IN')}`;
    } else if (weeklyDigest && weeklyDigest.spendingTotal) {
      header += `Total spending this week recorded in vault: **₹${weeklyDigest.spendingTotal.toLocaleString('en-IN')}** across ${weeklyDigest.screenshotCount} transactions.`;
    } else {
      header += `No recorded spending found for this week matching "${intent.merchant || 'expenses'}".`;
    }

    return header;
  }

  private synthesizeFinanceAnswer(
    screenshots: RetrievedScreenshotContext[],
    timelineEvents: any[],
    intent: ParsedQueryIntent
  ): string {
    let totalSum = 0;
    const items: string[] = [];

    screenshots.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const m = ctx.merchants[0] || s.subcategory || 'Payment';
      const amtStr = ctx.amounts[0];
      const amt = amtStr ? parseFloat(amtStr) : 0;
      if (amt > 0) totalSum += amt;

      const dateStr = ctx.date ? ctx.date.split('T')[0] : '';
      items.push(`• **${m}**: ₹${amt > 0 ? amt.toLocaleString('en-IN') : 'N/A'}${dateStr ? ` on ${dateStr}` : ''} (${s.fileName})`);
    });

    let header = `Found **${screenshots.length}** payment screenshot(s)`;
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
    screenshots: RetrievedScreenshotContext[],
    timelineEvents: any[],
    intent: ParsedQueryIntent
  ): string {
    let totalSum = 0;
    const items: string[] = [];
    screenshots.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const m = ctx.merchants[0] || 'Food Order';
      const amtStr = ctx.amounts[0];
      const amt = amtStr ? parseFloat(amtStr) : 0;
      if (amt > 0) totalSum += amt;
      const dateStr = ctx.date ? ctx.date.split('T')[0] : '';
      items.push(`• **${m}** ${amt > 0 ? `(₹${amt.toLocaleString('en-IN')})` : ''}${dateStr ? ` • ${dateStr}` : ''}: ${ctx.visionSummary || s.fileName}`);
    });

    const merchantLabel = intent.merchant || 'Food Delivery';
    let res = `Found **${screenshots.length}** ${merchantLabel} order(s) in your screenshots:\n\n${items.join('\n')}`;
    if (totalSum > 0) {
      res += `\n\n**Total Food Outlay**: ₹${totalSum.toLocaleString('en-IN')}`;
    }
    return res;
  }

  private synthesizeTravelAnswer(
    screenshots: RetrievedScreenshotContext[],
    timelineEvents: any[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    screenshots.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const m = ctx.merchants[0] || 'Travel Booking';
      const destination = (s.entities as any)?.destination || (s.entities as any)?.to;
      const origin = (s.entities as any)?.origin || (s.entities as any)?.from;
      const route = origin && destination ? `${origin} to ${destination}` : destination ? `to ${destination}` : '';
      const pnrTag = ctx.tags.find((t) => t.startsWith('pnr_'));
      const flightTag = ctx.tags.find((t) => /^(6e|ai|uk|sg|qp|ix)\d+/i.test(t));
      const details = [
        route,
        pnrTag ? `PNR: ${pnrTag.replace('pnr_', '')}` : '',
        flightTag ? `Flight: ${flightTag.toUpperCase()}` : '',
      ]
        .filter(Boolean)
        .join(', ');

      const dateStr = ctx.date ? ` • ${ctx.date.split('T')[0]}` : '';
      items.push(`• **${m}**${details ? ` (${details})` : ''}${dateStr}: ${ctx.visionSummary || s.fileName}`);
    });

    return `Found **${screenshots.length}** travel ticket(s) or booking screenshot(s):\n\n${items.join('\n')}`;
  }

  private synthesizeShoppingAnswer(
    screenshots: RetrievedScreenshotContext[],
    timelineEvents: any[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    screenshots.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const m = ctx.merchants[0] || 'Shopping';
      const amtStr = ctx.amounts[0];
      const amt = amtStr ? ` • ₹${parseFloat(amtStr).toLocaleString('en-IN')}` : '';
      const dateStr = ctx.date ? ` • ${ctx.date.split('T')[0]}` : '';
      items.push(`• **${m}**${amt}${dateStr}: ${ctx.visionSummary || s.fileName}`);
    });

    const label = intent.merchant || 'Shopping';
    return `Found **${screenshots.length}** ${label} invoice(s) or order screenshot(s):\n\n${items.join('\n')}`;
  }

  private synthesizeDocumentAnswer(
    screenshots: RetrievedScreenshotContext[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    screenshots.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const sub = s.subcategory && s.subcategory !== 'General' ? s.subcategory : 'Government ID / Document';
      items.push(`• **${sub}**: ${s.fileName}${ctx.visionSummary ? ` — ${ctx.visionSummary}` : ''}`);
    });

    const docTypeLabel = intent.documentType ? intent.documentType.toUpperCase() : 'Official Document';
    return `Found **${screenshots.length}** ${docTypeLabel} screenshot(s):\n\n${items.join('\n')}\n\n*All document data remains securely stored on your local device.*`;
  }

  private synthesizeChatAnswer(
    screenshots: RetrievedScreenshotContext[],
    intent: ParsedQueryIntent
  ): string {
    const items: string[] = [];
    screenshots.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const app = intent.appFilter || s.subcategory || 'Messaging';
      items.push(`• **${app}**: ${s.fileName}${ctx.visionSummary ? ` — ${ctx.visionSummary}` : ''}`);
    });

    return `Found **${screenshots.length}** chat/messaging screenshot(s):\n\n${items.join('\n')}`;
  }

  private synthesizeGeneralAnswer(
    hybrid: RankedRetrievalContext,
    question: string
  ): string {
    const items: string[] = [];

    hybrid.screenshots.slice(0, 8).forEach((ctx) => {
      const s = ctx.screenshot;
      const cat = s.categoryName || ctx.category;
      items.push(`• **${cat}** (${s.fileName}): ${ctx.visionSummary || ctx.ocrText.substring(0, 80) || 'Screenshot saved in vault'}`);
    });

    if (items.length === 0 && hybrid.timelineEvents.length > 0) {
      hybrid.timelineEvents.slice(0, 5).forEach((evt) => {
        items.push(`• [Timeline] **${evt.title}** (${evt.date}): ${evt.summary}`);
      });
    }

    return `Here is what I found across your memories for "${question}":\n\n${items.join('\n')}`;
  }

  // ===========================================================================
  // Suggestions & Follow-ups
  // ===========================================================================

  private generateContextualSuggestions(intent: ParsedQueryIntent, hybrid: RankedRetrievalContext): string[] {
    const suggestions: string[] = [];

    if (intent.domain === 'finance') {
      suggestions.push('Show Google Pay payments this month');
      suggestions.push('Top expenses this week');
    } else if (intent.domain === 'shopping') {
      suggestions.push('Show Amazon orders');
      suggestions.push('Find headphone invoices');
    } else if (intent.domain === 'travel') {
      suggestions.push('Find Delhi flight tickets');
      suggestions.push('Show train bookings');
    } else if (intent.domain === 'documents') {
      suggestions.push('Find Aadhaar screenshots');
      suggestions.push('Show PAN cards');
    } else {
      suggestions.push("Summarize today's screenshots");
      suggestions.push('Spending this week');
      suggestions.push('Show travel memories');
    }

    return suggestions.slice(0, 4);
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
        suggestions.push('Show payments this month');
        suggestions.push('Google Pay transactions');
      }
      if (catIds.includes('food_delivery')) {
        suggestions.push('Find Swiggy orders');
        suggestions.push('Swiggy orders this week');
      }
      if (catIds.includes('travel')) {
        suggestions.push('Find Delhi flight ticket');
        suggestions.push('Train reservations');
      }
      if (catIds.includes('documents')) {
        suggestions.push('Find Aadhaar card');
      }
      if (catIds.includes('chats')) {
        suggestions.push('Show WhatsApp screenshots');
      }
    } catch {
      // Default suggestions if category lookup fails
    }

    if (suggestions.length === 0) {
      return [
        "Summarize today's screenshots",
        'Show payments this month',
        'Find Amazon orders',
        'Find flight tickets',
      ];
    }

    suggestions.unshift("Summarize today's screenshots");
    return Array.from(new Set(suggestions)).slice(0, 6);
  }

  // ===========================================================================
  // Legacy Store Support & Backward Compatibility
  // ===========================================================================

  async loadHistory(folderId?: string, sessionId?: string): Promise<ChatMessageModel[]> {
    const sId = sessionId || (folderId ? `session_${folderId}` : 'session_global');
    const records = await chatMessageRepository.getMessagesBySession(sId, 50);

    return records.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      folderId,
      role: r.role as any,
      content: r.content,
      citations: r.citations || [],
      createdAt: r.created_at,
      createdOn: r.created_at,
      syncStatus: 'synced',
    }));
  }

  async clearHistory(folderId?: string, sessionId?: string): Promise<void> {
    const sId = sessionId || (folderId ? `session_${folderId}` : 'session_global');
    await chatMessageRepository.deleteMessagesBySession(sId);
    await chatHistoryRepository.clearAllHistory(sId, folderId);
  }

  async deleteHistory(folderId?: string, sessionId?: string): Promise<void> {
    return this.clearHistory(folderId, sessionId);
  }

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

  async sendMessage(params: {
    folderId?: string;
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

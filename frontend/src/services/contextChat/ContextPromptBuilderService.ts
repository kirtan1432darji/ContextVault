/**
 * ContextPromptBuilderService.ts
 * Builds structured, grounded, and deduplicated prompts for ContextVault Context Chat (Sprint P3-B).
 * Consolidates:
 * 1. User Question
 * 2. Relevant Memories (Top Screenshots with Vision AI metadata & OCR snippets)
 * 3. Timeline Events (Memory Timeline events)
 * 4. Folder Context (Category / Smart Folder summaries)
 * 5. Digest Summaries (Daily & Weekly rollups)
 * 6. Session Progressive Summary & Rolling History turns
 * 7. Output Instructions (Grounded citations, INR currency formatting, zero raw SQL or internal IDs)
 */

import { RankedRetrievalContext, RetrievedScreenshotContext } from './ContextRetrievalService';
import { ChatMessageRecord } from '../../database/repositories/ChatMessageRepository';

export interface PromptBuildOptions {
  maxContextScreenshots?: number;
  maxTimelineEvents?: number;
  maxDigests?: number;
  maxOcrLengthPerItem?: number;
  includeHistory?: boolean;
  maxHistoryTurns?: number;
}

export class ContextPromptBuilderService {
  private static instance: ContextPromptBuilderService | null = null;

  static getInstance(): ContextPromptBuilderService {
    if (!ContextPromptBuilderService.instance) {
      ContextPromptBuilderService.instance = new ContextPromptBuilderService();
    }
    return ContextPromptBuilderService.instance;
  }

  /**
   * Constructs an optimized, grounded prompt from ranked multi-source retrieval context.
   */
  buildGroundedPrompt(
    question: string,
    context: RankedRetrievalContext | RetrievedScreenshotContext[],
    history: ChatMessageRecord[] = [],
    options: PromptBuildOptions = {}
  ): string {
    const maxScreenshots = options.maxContextScreenshots || 10;
    const maxTimeline = options.maxTimelineEvents || 5;
    const maxDigests = options.maxDigests || 3;
    const maxOcrLen = options.maxOcrLengthPerItem || 200;
    const maxTurns = options.maxHistoryTurns || 6;

    // Normalize context
    const isHybrid = !Array.isArray(context);
    const screenshots: RetrievedScreenshotContext[] = isHybrid
      ? (context as RankedRetrievalContext).screenshots.slice(0, maxScreenshots)
      : (context as RetrievedScreenshotContext[]).slice(0, maxScreenshots);

    const timelineEvents = isHybrid ? (context as RankedRetrievalContext).timelineEvents.slice(0, maxTimeline) : [];
    const digestSummaries = isHybrid ? (context as RankedRetrievalContext).digestSummaries.slice(0, maxDigests) : [];
    const folderContexts = isHybrid ? (context as RankedRetrievalContext).folderContexts || [] : [];
    const sessionSummary = isHybrid ? (context as RankedRetrievalContext).sessionSummary : undefined;

    // 1. Format Relevant Screenshots
    const seenOcr = new Set<string>();
    const screenshotLines: string[] = [];

    screenshots.forEach((ctx, idx) => {
      const s = ctx.screenshot;
      const num = idx + 1;

      let cleanOcr = '';
      if (ctx.ocrText) {
        const sig = ctx.ocrText.substring(0, 50).toLowerCase();
        if (!seenOcr.has(sig)) {
          seenOcr.add(sig);
          cleanOcr = ctx.ocrText.replace(/\s+/g, ' ').trim().substring(0, maxOcrLen);
        }
      }

      const merchantStr = ctx.merchants.length > 0 ? ctx.merchants.join(', ') : 'Unknown';
      const amountStr = ctx.amounts.length > 0 ? ctx.amounts.map((a) => `₹${a}`).join(', ') : 'None';
      const tagsStr = ctx.tags.slice(0, 4).join(', ');
      const dateStr = ctx.date ? ctx.date.split('T')[0] : 'Unknown';

      screenshotLines.push(
        `[Memory ${num}]\n` +
        `- File: ${s.fileName}\n` +
        `- Category: ${s.categoryName || ctx.category}${ctx.subcategory ? ` / ${ctx.subcategory}` : ''}\n` +
        `- Date: ${dateStr}\n` +
        `- Merchant: ${merchantStr}\n` +
        `- Amount: ${amountStr}\n` +
        (ctx.visionSummary ? `- Vision Summary: ${ctx.visionSummary}\n` : '') +
        (cleanOcr ? `- Extracted Text: ${cleanOcr}\n` : '') +
        (tagsStr ? `- Tags: ${tagsStr}\n` : '')
      );
    });

    const screenshotBlock =
      screenshotLines.length > 0
        ? screenshotLines.join('\n')
        : 'No direct screenshot matches found.';

    // 2. Format Timeline Events
    let timelineBlock = '';
    if (timelineEvents.length > 0) {
      const lines = timelineEvents.map((evt, idx) => {
        const amtStr = evt.amount ? ` • ₹${evt.amount.toLocaleString('en-IN')}` : '';
        const merchStr = evt.merchant ? ` (${evt.merchant})` : '';
        return `• [${evt.date}] ${evt.title}${merchStr}${amtStr}: ${evt.summary}`;
      });
      timelineBlock = `\nTimeline Events (${timelineEvents.length} event(s)):\n${lines.join('\n')}\n`;
    }

    // 3. Format Digest Summaries
    let digestBlock = '';
    if (digestSummaries.length > 0) {
      const lines = digestSummaries.map((d) => {
        const spendStr = d.spendingTotal ? ` • Spending: ₹${d.spendingTotal.toLocaleString('en-IN')}` : '';
        return `• ${d.title} [${d.screenshotCount} screenshots${spendStr}]: ${d.summary}`;
      });
      digestBlock = `\nDigest Summaries:\n${lines.join('\n')}\n`;
    }

    // 4. Format Folder Context
    let folderBlock = '';
    if (folderContexts.length > 0) {
      const lines = folderContexts.map((fc) => `• ${fc.folderName}: ${fc.summary}`);
      folderBlock = `\nSmart Folder Context:\n${lines.join('\n')}\n`;
    }

    // 5. Session Long-Term Summary & Rolling History
    let historyBlock = '';
    if (sessionSummary) {
      historyBlock += `\nPrior Conversation Summary:\n${sessionSummary}\n`;
    }

    if (options.includeHistory !== false && history.length > 0) {
      const recentHistory = history.slice(-maxTurns);
      const lines = recentHistory.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`);
      historyBlock += `\nRecent Turns:\n${lines.join('\n')}\n`;
    }

    return (
      `System: You are ContextVault AI, a privacy-first conversational assistant for personal screenshots.\n` +
      `Answer the user's question accurately using ONLY the provided memories, timeline events, and digests below.\n` +
      `Strict Instructions:\n` +
      `- Ground your answer strictly in the evidence. Never speculate or hallucinate.\n` +
      `- If information is missing, explicitly inform the user.\n` +
      `- Format all financial amounts in Indian Rupees (₹).\n` +
      `- Cite specific files, merchants, and dates in your answer.\n` +
      `- NEVER expose database schema, internal UUIDs, or raw query details.\n\n` +
      `Relevant Memories (${screenshots.length} item(s)):\n` +
      `${screenshotBlock}\n` +
      `${timelineBlock}` +
      `${digestBlock}` +
      `${folderBlock}` +
      `${historyBlock}\n` +
      `User Question: ${question}\n` +
      `Assistant Response:`
    );
  }
}

export const contextPromptBuilderService = ContextPromptBuilderService.getInstance();

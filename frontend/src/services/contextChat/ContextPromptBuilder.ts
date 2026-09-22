/**
 * ContextPromptBuilder.ts
 * Builds compact, structured, and deduplicated prompts for Context Chat inference.
 * Limits token sizes, truncates long OCR text, and avoids duplicate OCR blocks.
 */

import { RetrievedScreenshotContext } from './ContextRetrievalService';
import { ChatHistoryRecord } from '../../database/repositories/ChatHistoryRepository';

import { PromptBuildOptions } from './ContextPromptBuilderService';


export class ContextPromptBuilder {
  /**
   * Constructs an optimized, grounded prompt from ranked screenshot contexts.
   */
  static buildPrompt(
    question: string,
    contexts: RetrievedScreenshotContext[],
    history: ChatHistoryRecord[] = [],
    options: PromptBuildOptions = {}
  ): string {
    const maxItems = options.maxContextScreenshots || 10;
    const maxOcrLen = options.maxOcrLengthPerItem || 200;
    const maxTurns = options.maxHistoryTurns || 4;

    const seenOcrSignatures = new Set<string>();
    const contextLines: string[] = [];

    const topContexts = contexts.slice(0, maxItems);

    topContexts.forEach((ctx, index) => {
      const s = ctx.screenshot;
      const num = index + 1;

      // Deduplicate OCR lines
      let cleanOcr = '';
      if (ctx.ocrText) {
        const ocrSig = ctx.ocrText.substring(0, 60).toLowerCase();
        if (!seenOcrSignatures.has(ocrSig)) {
          seenOcrSignatures.add(ocrSig);
          cleanOcr = ctx.ocrText
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, maxOcrLen);
        }
      }

      const merchantStr = ctx.merchants.length > 0 ? ctx.merchants.join(', ') : 'Unknown';
      const amountStr = ctx.amounts.length > 0 ? ctx.amounts.map((a) => `₹${a}`).join(', ') : 'None';
      const tagsStr = ctx.tags.slice(0, 4).join(', ');
      const dateStr = ctx.date ? ctx.date.split('T')[0] : 'Unknown';

      contextLines.push(
        `[Screenshot ${num}] (ID: ${s.id})\n` +
        `- File: ${s.fileName}\n` +
        `- Category: ${s.categoryName || ctx.category}${ctx.subcategory ? ` / ${ctx.subcategory}` : ''}\n` +
        `- Date: ${dateStr}\n` +
        `- Merchant: ${merchantStr}\n` +
        `- Amount: ${amountStr}\n` +
        (ctx.visionSummary ? `- Vision Summary: ${ctx.visionSummary}\n` : '') +
        (cleanOcr ? `- OCR Text: ${cleanOcr}\n` : '') +
        (tagsStr ? `- Tags: ${tagsStr}\n` : '')
      );
    });

    const contextBlock =
      contextLines.length > 0
        ? contextLines.join('\n')
        : 'No relevant screenshot context found in local database.';

    // Recent conversation turns
    const historyLines: string[] = [];
    if (options.includeHistory !== false && history.length > 0) {
      const recentHistory = history.slice(-maxTurns);
      recentHistory.forEach((h) => {
        historyLines.push(`${h.role === 'user' ? 'User' : 'Assistant'}: ${h.message}`);
      });
    }

    const historyBlock =
      historyLines.length > 0
        ? `\nRecent Conversation:\n${historyLines.join('\n')}\n`
        : '';

    return (
      `System: You are ContextVault AI, an intelligent, privacy-first assistant for personal screenshots.\n` +
      `Answer the user's question using ONLY the provided screenshot context below. If the answer is not present, state that clearly.\n` +
      `Format currency in Indian Rupees (₹) and reference specific screenshot file names or IDs when relevant.\n\n` +
      `Screenshot Context (${topContexts.length} item(s)):\n` +
      `${contextBlock}\n` +
      `${historyBlock}\n` +
      `User Question: ${question}\n` +
      `Assistant Response:`
    );
  }
}

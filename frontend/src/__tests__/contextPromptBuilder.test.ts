/**
 * contextPromptBuilder.test.ts
 * Unit tests for ContextPromptBuilderService grounded prompt generation (Sprint P3-B).
 */

import { contextPromptBuilderService } from '../services/contextChat/ContextPromptBuilderService';
import { RankedRetrievalContext } from '../services/contextChat/ContextRetrievalService';
import { ChatMessageRecord } from '../database/repositories/ChatMessageRepository';

describe('Sprint P3-B — ContextPromptBuilderService Test Suite', () => {
  const mockHybridContext: RankedRetrievalContext = {
    query: 'Show my Google Pay payments this month',
    screenshots: [
      {
        screenshot: {
          id: 'sc_gpay_101',
          deviceAssetId: 'asset_gpay_101',
          width: 1080,
          height: 1920,
          fileSize: 1024,
          tags: [],
          fileName: 'gpay_electricity.png',
          categoryId: 'finance',
          categoryName: 'Finance',
          subcategory: 'Google Pay',
          confidence: 0.98,
          filePath: '/path/gpay_electricity.png',
          createdAt: '2026-09-15T11:00:00Z',
          ocrText: 'Google Pay Bill Payment Adani Electricity ₹2,450 Successful',
          keywords: ['google pay', 'bill', 'electricity'],
          isFavorite: false,
          isReviewed: true,
          isSynced: true,
          ocrStatus: 'completed',
        },
        ocrText: 'Google Pay Bill Payment Adani Electricity ₹2,450 Successful',
        visionSummary: 'Electricity bill payment of ₹2,450 via Google Pay',
        tags: ['google pay', 'electricity', 'bill'],
        merchants: ['Google Pay', 'Adani Electricity'],
        amounts: ['2450'],
        category: 'finance',
        subcategory: 'Google Pay',
        date: '2026-09-15T11:00:00Z',
        score: 85,
        matchReasons: ['Merchant match: Google Pay'],
      },
    ],
    timelineEvents: [
      {
        id: 'evt_1',
        screenshotId: 'sc_gpay_101',
        screenshotIds: ['sc_gpay_101'],
        date: '2026-09-15',
        timestamp: Date.now() - 500000,
        timeStr: '11:00',
        category: 'finance',
        categoryName: 'Finance',
        title: 'Electricity Bill Payment',
        summary: 'Paid ₹2,450 to Adani Electricity via Google Pay',
        merchant: 'Google Pay',
        amount: 2450,
        currency: 'INR',
        screenshotCount: 1,
        filePath: '/path/gpay_electricity.png',
        period: 'earlier_this_month',
        periodGroup: 'Earlier This Month',
        tags: ['electricity', 'google pay'],
      },
    ],
    digestSummaries: [
      {
        type: 'weekly',
        key: '2026-W37',
        title: 'Weekly Digest (Sep 14 - Sep 20)',
        summary: 'Total spending ₹12,850 across 5 payments.',
        screenshotCount: 8,
        spendingTotal: 12850,
        topMerchants: ['Google Pay', 'Swiggy'],
        score: 40,
      },
    ],
    folderContexts: [
      {
        folderId: 'finance',
        folderName: 'Finance & Payments',
        summary: 'Tracks UPI transactions, bank receipts, and bill payments.',
        score: 50,
      },
    ],
    sessionSummary: 'User previously inquired about September expenses.',
  };

  const mockHistory: ChatMessageRecord[] = [
    {
      id: 'msg_h1',
      session_id: 'sess_1',
      role: 'user',
      content: 'Hello, what can you do?',
      created_at: '2026-09-22T10:00:00Z',
    },
    {
      id: 'msg_h2',
      session_id: 'sess_1',
      role: 'assistant',
      content: 'I can help summarize and search your screenshots.',
      created_at: '2026-09-22T10:00:02Z',
    },
  ];

  it('generates a complete structured prompt with all 6 required sections', () => {
    const prompt = contextPromptBuilderService.buildGroundedPrompt(
      'Show my Google Pay payments this month',
      mockHybridContext,
      mockHistory
    );

    expect(prompt).toContain('User Question: Show my Google Pay payments this month');
    expect(prompt).toContain('Relevant Memories (1 item(s))');
    expect(prompt).toContain('Timeline Events (1 event(s))');
    expect(prompt).toContain('Digest Summaries');
    expect(prompt).toContain('Smart Folder Context');
    expect(prompt).toContain('Prior Conversation Summary');
    expect(prompt).toContain('Recent Turns');
    expect(prompt).toContain('Strict Instructions');
  });

  it('formats amounts in Indian Rupees (₹) and preserves merchant names', () => {
    const prompt = contextPromptBuilderService.buildGroundedPrompt(
      'How much did I pay?',
      mockHybridContext
    );

    expect(prompt).toContain('₹2450');
    expect(prompt).toContain('Google Pay');
    expect(prompt).toContain('Adani Electricity');
  });

  it('truncates long OCR text to prevent prompt token bloat', () => {
    const longContext: RankedRetrievalContext = {
      ...mockHybridContext,
      screenshots: [
        {
          ...mockHybridContext.screenshots[0],
          ocrText: 'A'.repeat(500),
        },
      ],
    };

    const prompt = contextPromptBuilderService.buildGroundedPrompt(
      'Details',
      longContext,
      [],
      { maxOcrLengthPerItem: 100 }
    );

    // Should not contain the full 500 'A' characters
    expect(prompt).not.toContain('A'.repeat(200));
    expect(prompt).toContain('A'.repeat(100));
  });

  it('never leaks internal database schema or SQL queries into user instructions', () => {
    const prompt = contextPromptBuilderService.buildGroundedPrompt(
      'Test query',
      mockHybridContext
    );

    expect(prompt).not.toContain('SELECT * FROM');
    expect(prompt).not.toContain('CREATE TABLE');
    expect(prompt).toContain('NEVER expose database schema');
  });
});

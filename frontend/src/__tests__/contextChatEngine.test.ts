jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Alert: { alert: jest.fn() },
}));

/**
 * contextChatEngine.test.ts
 * End-to-end unit tests for ContextChatService flagship chat engine (Sprint P3-B).
 */

import { contextChatService } from '../services/contextChat/ContextChatService';
import { chatSessionRepository } from '../database/repositories/ChatSessionRepository';
import { chatMessageRepository } from '../database/repositories/ChatMessageRepository';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';
import { visionAIService } from '../services/visionAIService';

describe('Sprint P3-B — ContextChatService Engine Suite', () => {
  const mockScreenshots: ScreenshotModel[] = [
    {
      id: 'sc_gpay_1',
      deviceAssetId: 'a1',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/gpay_rent.png',
      localPath: '/storage/gpay_rent.png',
      fileName: 'gpay_rent.png',
      createdAt: '2026-09-22T10:00:00Z',
      categoryId: 'finance',
      categoryName: 'Finance',
      subcategory: 'Google Pay',
      confidence: 0.99,
      ocrText: 'Google Pay Paid to Landlord ₹18,000 Successful UPI ID 9821389',
      keywords: ['google pay', 'payment', 'rent', 'upi'],
      entities: { merchant: 'Google Pay', amount: '18000' } as any,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
    {
      id: 'sc_swiggy_1',
      deviceAssetId: 'a2',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/swiggy_biryani.png',
      localPath: '/storage/swiggy_biryani.png',
      fileName: 'swiggy_biryani.png',
      createdAt: '2026-09-22T13:00:00Z',
      categoryId: 'food_delivery',
      categoryName: 'Food Delivery',
      subcategory: 'Swiggy',
      confidence: 0.96,
      ocrText: 'Swiggy Order Total ₹580 Meghana Foods Biryani Paid',
      keywords: ['swiggy', 'biryani', 'food', 'order'],
      entities: { merchant: 'Swiggy', amount: '580' } as any,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
    {
      id: 'sc_amazon_invoice',
      deviceAssetId: 'a3',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/amazon_headphone_invoice.png',
      localPath: '/storage/amazon_headphone_invoice.png',
      fileName: 'amazon_headphone_invoice.png',
      createdAt: '2026-09-21T15:00:00Z',
      categoryId: 'shopping',
      categoryName: 'Shopping',
      subcategory: 'Amazon',
      confidence: 0.98,
      ocrText: 'Amazon Tax Invoice Sony WH-1000XM5 ₹24,990 Shipped',
      keywords: ['amazon', 'headphone', 'invoice', 'sony'],
      entities: { merchant: 'Amazon', amount: '24990' } as any,
      isFavorite: true,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
    {
      id: 'sc_delhi_flight',
      deviceAssetId: 'a4',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/delhi_boarding_pass.png',
      localPath: '/storage/delhi_boarding_pass.png',
      fileName: 'delhi_boarding_pass.png',
      createdAt: '2026-09-20T08:00:00Z',
      categoryId: 'travel',
      categoryName: 'Travel',
      subcategory: 'IndiGo',
      confidence: 0.97,
      ocrText: 'IndiGo Delhi Flight 6E 204 BOM to DEL PNR W9KZ7Q Date 20-Sep-2026',
      keywords: ['indigo', 'delhi', 'flight', 'boarding pass', 'pnr_w9kz7q'],
      entities: { merchant: 'IndiGo', destination: 'Delhi' } as any,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
  ];

  beforeEach(async () => {
    jest.spyOn(visionAIService, 'pingVisionServer').mockResolvedValue({
      online: false,
      latencyMs: 10,
      status: 'offline',
    });
    await chatSessionRepository.clearAllSessions();
    await chatMessageRepository.clearAllMessages();
    useScreenshotStore.setState({ screenshots: mockScreenshots });
  });

  describe('Session Management', () => {
    it('creates, renames, lists, and deletes conversation sessions', async () => {
      const session = await contextChatService.createSession('Shopping Queries', 'sess_test_1');
      expect(session.id).toBe('sess_test_1');
      expect(session.title).toBe('Shopping Queries');

      await contextChatService.renameSession('sess_test_1', 'Electronics Purchases');
      const loaded = await contextChatService.loadSession('sess_test_1');
      expect(loaded.session?.title).toBe('Electronics Purchases');

      const all = await contextChatService.listSessions(10);
      expect(all.length).toBe(1);

      await contextChatService.deleteSession('sess_test_1');
      const afterDel = await contextChatService.loadSession('sess_test_1');
      expect(afterDel.session).toBeNull();
    });
  });

  describe('Question Answering Pipeline', () => {
    it('answers finance payment queries with grounded totals and citations', async () => {
      const statuses: string[] = [];
      const result = await contextChatService.askQuestion('Show my Google Pay payments this month', {
        sessionId: 'sess_finance',
        onStatusChange: (s) => statuses.push(s),
      });

      expect(result).toBeDefined();
      expect(result.answer).toContain('Google Pay');
      expect(result.answer).toContain('18,000');
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations[0].merchant).toBe('Google Pay');
      expect(result.citations[0].screenshotId).toBe('sc_gpay_1');
      expect(result.isOfflineResponse).toBe(true);
      expect(result.bannerMessage).toBe('Offline metadata response.');
      expect(statuses.length).toBeGreaterThan(0);

      // Verify messages were persisted in database
      const msgs = await chatMessageRepository.getMessagesBySession('sess_finance');
      expect(msgs.length).toBe(2);
      expect(msgs[0].role).toBe('user');
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].citations?.length).toBeGreaterThan(0);
    });

    it('answers food delivery queries with Swiggy orders and outlay totals', async () => {
      const result = await contextChatService.askQuestion('How much did I spend on Swiggy this week?');
      expect(result.answer).toContain('Swiggy');
      expect(result.answer).toContain('580');
      expect(result.citations.some((c) => c.screenshotId === 'sc_swiggy_1')).toBe(true);
    });

    it('answers shopping queries and cites Amazon headphone invoice', async () => {
      const result = await contextChatService.askQuestion('Find my Amazon headphone invoice');
      expect(result.answer).toContain('Amazon');
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations[0].fileName).toBe('amazon_headphone_invoice.png');
    });

    it('answers travel queries and finds Delhi flight ticket details', async () => {
      const result = await contextChatService.askQuestion('When did I book my Delhi flight?');
      expect(result.answer).toContain('IndiGo');
      expect(result.answer).toContain('Delhi');
      expect(result.citations.some((c) => c.screenshotId === 'sc_delhi_flight')).toBe(true);
    });

    it('regenerates response for the latest question in a session', async () => {
      const sessionId = 'sess_regen';
      await contextChatService.askQuestion('Show my Google Pay payments', { sessionId });

      const regenerated = await contextChatService.regenerateResponse(sessionId);
      expect(regenerated.answer).toContain('Google Pay');
      expect(regenerated.citations.length).toBeGreaterThan(0);
    });
  });
});

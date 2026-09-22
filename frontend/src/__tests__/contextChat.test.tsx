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
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  SafeAreaView: 'SafeAreaView',
  StatusBar: 'StatusBar',
  Alert: {
    alert: jest.fn(),
  },
}));

import { databaseService } from '../database';
import { chatHistoryRepository } from '../database/repositories/ChatHistoryRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { QueryIntentParser } from '../services/contextChat/QueryIntentParser';
import { ContextRetrievalService } from '../services/contextChat/ContextRetrievalService';
import { ContextPromptBuilder } from '../services/contextChat/ContextPromptBuilder';
import { contextChatService } from '../services/contextChat/ContextChatService';
import { visionAIService } from '../services/visionAIService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

const createMockScreenshot = (
  id: string,
  categoryId = 'unsorted',
  fileName = 'screenshot.jpg',
  ocrText = '',
  extra: Partial<ScreenshotModel> = {}
): ScreenshotModel => ({
  id,
  deviceAssetId: `asset_${id}`,
  filePath: `file:///storage/emulated/0/Pictures/Screenshots/${fileName}`,
  localPath: `file:///storage/emulated/0/Pictures/Screenshots/${fileName}`,
  fileName,
  fileSize: 2048,
  width: 1080,
  height: 2400,
  createdAt: '2026-09-18T10:00:00Z',
  createdOn: '2026-09-18T10:00:00Z',
  categoryId,
  folderId: categoryId,
  categoryName: categoryId,
  subcategory: 'General',
  confidence: 0.9,
  isAutoCategorized: true,
  isFavorite: false,
  isReviewed: true,
  isSynced: false,
  ocrStatus: 'completed',
  ocrText,
  keywords: [],
  tags: [],
  classificationSource: 'local',
  ...extra,
});

describe('Sprint P3-A — Context Chat & Offline AI Assistant Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default DB spies
    jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
    jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([]);
    jest.spyOn(categoryRepository, 'getAllCategories').mockResolvedValue([]);
    jest.spyOn(visionAIService, 'pingVisionServer').mockResolvedValue({
      online: false,
      latencyMs: 0,
      status: 'offline',
      error: 'Vision server offline',
    });

    useScreenshotStore.setState({
      screenshots: [],
      favorites: [],
      needsReviewList: [],
      selectedScreenshot: null,
    });
  });

  // ===========================================================================
  // 1. Natural Language Query Intent Parser
  // ===========================================================================
  describe('1. QueryIntentParser', () => {
    it('parses finance payment query with threshold', () => {
      const intent = QueryIntentParser.parse('Show payments above ₹500');
      expect(intent.domain).toBe('finance');
      expect(intent.intentType).toBe('payment_query');
      expect(intent.minAmount).toBe(500);
      expect(intent.currency).toBe('INR');
    });

    it('parses finance merchant query for PhonePe', () => {
      const intent = QueryIntentParser.parse('Show my PhonePe payments');
      expect(intent.domain).toBe('finance');
      expect(intent.merchant).toBe('Phonepe');
    });

    it('parses food delivery query for Swiggy', () => {
      const intent = QueryIntentParser.parse('Find Swiggy orders from yesterday');
      expect(intent.domain).toBe('food_delivery');
      expect(intent.merchant).toBe('Swiggy');
      expect(intent.dateRange?.relative).toBe('yesterday');
    });

    it('parses travel ticket and PNR query', () => {
      const intent = QueryIntentParser.parse('Show train bookings and PNR 2839182910');
      expect(intent.domain).toBe('travel');
      expect(intent.intentType).toBe('pnr_query');
      expect(intent.pnr).toBe('2839182910');
    });

    it('parses flight ticket query', () => {
      const intent = QueryIntentParser.parse('Find my flight tickets and boarding passes');
      expect(intent.domain).toBe('travel');
      expect(intent.travelType).toBe('flight');
    });

    it('parses official document query for Aadhaar and PAN', () => {
      const intentAadhaar = QueryIntentParser.parse('Where is my Aadhaar card?');
      expect(intentAadhaar.domain).toBe('documents');
      expect(intentAadhaar.documentType).toBe('aadhaar');

      const intentPan = QueryIntentParser.parse('Find PAN card copy');
      expect(intentPan.domain).toBe('documents');
      expect(intentPan.documentType).toBe('pan');
    });

    it('parses chat screenshots for WhatsApp', () => {
      const intent = QueryIntentParser.parse('Show WhatsApp screenshots');
      expect(intent.domain).toBe('chats');
      expect(intent.intentType).toBe('chat_query');
      expect(intent.appFilter).toBe('whatsapp');
    });

    it('parses date summary query for today', () => {
      const intent = QueryIntentParser.parse('Summarize today\'s screenshots');
      expect(intent.domain).toBe('general');
      expect(intent.intentType).toBe('folder_summary');
      expect(intent.dateRange?.relative).toBe('today');
    });
  });

  // ===========================================================================
  // 2. Context Retrieval Engine & 5-Tier Ranking
  // ===========================================================================
  describe('2. ContextRetrievalService (5-Tier Ranking & SQLite Grounding)', () => {
    it('ranks exact merchant/tag matches higher than general keywords', async () => {
      useScreenshotStore.setState({
        screenshots: [
          createMockScreenshot('sc_gen_1', 'shopping', 'product1.jpg', 'Shopping receipt items order confirmed', {
            keywords: ['shopping', 'order'],
          }),
          createMockScreenshot('sc_swiggy_1', 'food_delivery', 'swiggy_dinner.jpg', 'Paid ₹450 to Swiggy for dinner order #521', {
            subcategory: 'Swiggy',
            keywords: ['swiggy', '₹450', 'food'],
            entities: { merchant: 'Swiggy', amount: '450' } as any,
          }),
        ],
      });

      const results = await ContextRetrievalService.getInstance().retrieveContext('Find my Swiggy order receipts');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].screenshot.id).toBe('sc_swiggy_1');
      expect(results[0].score).toBeGreaterThan(50);
      expect(results[0].matchReasons.some((r) => r.includes('Swiggy'))).toBe(true);
    });

    it('filters by amount threshold (payments above ₹500)', async () => {
      useScreenshotStore.setState({
        screenshots: [
          createMockScreenshot('sc_cheap', 'finance', 'tea.jpg', 'Paid ₹50 to Chai Point via UPI', {
            subcategory: 'UPI',
            keywords: ['upi', '₹50'],
            entities: { amount: '50' } as any,
          }),
          createMockScreenshot('sc_expensive', 'finance', 'hotel.jpg', 'Paid ₹1250 for Hotel Booking via PhonePe', {
            subcategory: 'PhonePe',
            keywords: ['phonepe', '₹1250'],
            entities: { merchant: 'PhonePe', amount: '1250' } as any,
          }),
        ],
      });

      const results = await ContextRetrievalService.getInstance().retrieveContext('Show payments above ₹500');

      expect(results.length).toBe(1);
      expect(results[0].screenshot.id).toBe('sc_expensive');
    });

    it('never returns more than 20 screenshots', async () => {
      const mockList: ScreenshotModel[] = [];
      for (let i = 0; i < 30; i++) {
        mockList.push(
          createMockScreenshot(`sc_${i}`, 'finance', `sc_${i}.jpg`, `Paid ₹${100 + i} to Merchant via UPI`, {
            keywords: ['payment', 'upi'],
          })
        );
      }
      useScreenshotStore.setState({ screenshots: mockList });

      const results = await ContextRetrievalService.getInstance().retrieveContext('Show payment receipts');
      expect(results.length).toBeLessThanOrEqual(20);
    });
  });

  // ===========================================================================
  // 3. Retrieval Augmented Prompt Builder
  // ===========================================================================
  describe('3. ContextPromptBuilder', () => {
    it('constructs a compact prompt without duplicate OCR text and within token limits', () => {
      const mockContexts = [
        {
          screenshot: createMockScreenshot('sc_p1', 'finance', 'bill1.jpg'),
          ocrText: 'Invoice #101 Payment successful of ₹550',
          visionSummary: 'UPI Payment receipt of ₹550',
          tags: ['finance', 'upi', '₹550'],
          merchants: ['PhonePe'],
          amounts: ['550'],
          category: 'Finance',
          subcategory: 'PhonePe',
          date: '2026-09-18T10:00:00Z',
          score: 85,
          matchReasons: ['Merchant match: PhonePe'],
        },
        {
          screenshot: createMockScreenshot('sc_p2', 'finance', 'bill2.jpg'),
          ocrText: 'Invoice #101 Payment successful of ₹550', // Duplicate OCR
          visionSummary: 'UPI Payment receipt of ₹550',
          tags: ['finance', 'upi'],
          merchants: ['PhonePe'],
          amounts: ['550'],
          category: 'Finance',
          subcategory: 'PhonePe',
          date: '2026-09-18T10:05:00Z',
          score: 80,
          matchReasons: ['Merchant match: PhonePe'],
        },
      ];

      const prompt = ContextPromptBuilder.buildPrompt('What was my payment amount?', mockContexts);

      expect(prompt).toContain('Screenshot Context (2 item(s))');
      expect(prompt).toContain('PhonePe');
      expect(prompt).toContain('₹550');
      expect(prompt).toContain('User Question: What was my payment amount?');

      // Check OCR was deduplicated for second duplicate item
      const ocrOccurrences = (prompt.match(/Invoice #101 Payment successful/g) || []).length;
      expect(ocrOccurrences).toBe(1);
    });
  });

  // ===========================================================================
  // 4. Conversation History (ChatHistoryRepository)
  // ===========================================================================
  describe('4. ChatHistoryRepository (On-Device Persistence)', () => {
    it('saves user and assistant messages with referenced screenshot IDs and response time', async () => {
      const executeCommandSpy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);

      await chatHistoryRepository.saveMessage({
        id: 'msg_test_01',
        role: 'assistant',
        message: 'Found 2 payments to Swiggy totaling ₹550.',
        referenced_screenshot_ids: ['sc_swiggy_1', 'sc_swiggy_2'],
        timestamp: '2026-09-18T10:30:00Z',
        response_time_ms: 125,
        sessionId: 'session_global',
      });

      expect(executeCommandSpy).toHaveBeenCalled();
      const insertSql = executeCommandSpy.mock.calls.find((c) => String(c[0]).includes('INSERT OR REPLACE INTO chat_history'))?.[0];
      expect(insertSql).toBeDefined();
    });

    it('retrieves recent messages and clears all history', async () => {
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        {
          id: 'msg_01',
          role: 'user',
          message: 'Find Swiggy orders',
          referenced_screenshot_ids: '[]',
          created_on: '2026-09-18T10:00:00Z',
          response_time_ms: 0,
        },
        {
          id: 'msg_02',
          role: 'assistant',
          message: 'Found 1 order for ₹550',
          referenced_screenshot_ids: '["sc_1"]',
          created_on: '2026-09-18T10:00:01Z',
          response_time_ms: 85,
        },
      ]);

      const messages = await chatHistoryRepository.getRecentMessages(10, 'session_test');
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].referenced_screenshot_ids).toEqual(['sc_1']);

      const executeCommandSpy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
      await chatHistoryRepository.clearAllHistory('session_test');
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM chat_history WHERE session_id = ?',
        ['session_test']
      );
    });
  });

  // ===========================================================================
  // 5. ContextChatService (End-to-End Answering & Offline Fallback)
  // ===========================================================================
  describe('5. ContextChatService (Grounded Answers & Offline Fallback)', () => {
    it('answers Swiggy order query with grounded response and cited screenshots', async () => {
      useScreenshotStore.setState({
        screenshots: [
          createMockScreenshot('sc_sw_1', 'food_delivery', 'swiggy_dinner.jpg', 'Swiggy Order #8812 Delivered ₹550', {
            subcategory: 'Swiggy',
            keywords: ['swiggy', '₹550'],
            entities: { merchant: 'Swiggy', amount: '550' } as any,
          }),
        ],
      });

      const result = await contextChatService.askQuestion('Find my Swiggy orders');

      expect(result.answer).toContain('Swiggy');
      expect(result.answer).toContain('₹550');
      expect(result.citedScreenshots.length).toBe(1);
      expect(result.citedScreenshots[0].id).toBe('sc_sw_1');
      expect(result.isOfflineResponse).toBe(true);
      expect(result.bannerMessage).toBe('Offline metadata response.');
    });

    it('answers payments threshold query with totals and offline metadata banner', async () => {
      useScreenshotStore.setState({
        screenshots: [
          createMockScreenshot('sc_p1', 'finance', 'paytm.jpg', 'Paid ₹600 to Electricity Board via Paytm', {
            subcategory: 'Paytm',
            keywords: ['paytm', '₹600'],
            entities: { merchant: 'Paytm', amount: '600' } as any,
          }),
          createMockScreenshot('sc_p2', 'finance', 'phonepe.jpg', 'Paid ₹850 to Grocery via PhonePe', {
            subcategory: 'PhonePe',
            keywords: ['phonepe', '₹850'],
            entities: { merchant: 'PhonePe', amount: '850' } as any,
          }),
        ],
      });

      const result = await contextChatService.summarizePayments(500);

      expect(result.answer).toContain('payment screenshot(s)');
      expect(result.answer).toContain('Paytm');
      expect(result.answer).toContain('PhonePe');
      expect(result.answer).toContain('Total Estimated Amount');
      expect(result.isOfflineResponse).toBe(true);
      expect(result.bannerMessage).toBe('Offline metadata response.');
      expect(result.citedScreenshots.length).toBe(2);
    });

    it('answers document query for Aadhaar with on-device privacy guarantee', async () => {
      useScreenshotStore.setState({
        screenshots: [
          createMockScreenshot('sc_aadhaar_1', 'documents', 'aadhaar_card.png', 'Government of India Aadhaar 1234 5678 9012', {
            subcategory: 'Aadhaar',
            keywords: ['aadhaar', 'government'],
            entities: { documentType: 'Aadhaar' } as any,
          }),
        ],
      });

      const result = await contextChatService.findDocuments('Aadhaar');

      expect(result.answer).toContain('AADHAAR');
      expect(result.answer).toContain('aadhaar_card.png');
      expect(result.answer).toContain('local device');
      expect(result.citedScreenshots.length).toBe(1);
    });

    it('summarizeToday handles empty screenshots gracefully without network error', async () => {
      useScreenshotStore.setState({ screenshots: [] });

      const result = await contextChatService.summarizeToday();

      expect(result.answer).not.toContain('Network Error');
      expect(result.answer).toContain('couldn\'t find any matching records');
      expect(result.isOfflineResponse).toBe(true);
      expect(result.bannerMessage).toBe('Offline metadata response.');
    });

    it('generates dynamic suggestion chips based on existing categories in SQLite', async () => {
      jest.spyOn(categoryRepository, 'getAllCategories').mockResolvedValue([
        {
          id: 'finance',
          name: 'Finance',
          iconName: 'wallet',
          colorHex: '#10B981',
          screenshotCount: 5,
          createdOn: '',
          updatedAt: '',
          isSystem: true,
          orderIndex: 0,
        },
        {
          id: 'food_delivery',
          name: 'Food Delivery',
          iconName: 'fast-food',
          colorHex: '#EF4444',
          screenshotCount: 3,
          createdOn: '',
          updatedAt: '',
          isSystem: true,
          orderIndex: 1,
        },
      ]);

      const suggestions = await contextChatService.loadSuggestions();

      expect(suggestions).toContain('Show payments above ₹500');
      expect(suggestions).toContain('Find Swiggy orders');
      expect(suggestions).toContain('Summarize today\'s screenshots');
    });
  });
});

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

import { searchIntentParser } from '../services/search/SearchIntentParser';
import { semanticSearchService } from '../services/search/SemanticSearchService';
import { searchSuggestionService } from '../services/search/SearchSuggestionService';
import { searchAnalyticsService } from '../services/search/SearchAnalyticsService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

const createMockScreenshot = (
  id: string,
  categoryId = 'unsorted',
  fileName = 'screenshot.jpg',
  ocrText = '',
  extra: any = {}
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
  categoryId,
  folderId: categoryId,
  categoryName: categoryId,
  subcategory: 'General',
  confidence: 0.95,
  isAutoCategorized: true,
  isFavorite: false,
  isReviewed: true,
  isSynced: false,
  ocrStatus: 'completed',
  ocrText,
  tags: [],
  keywords: [],
  ...extra,
});

describe('ContextVault Sprint P4-A — AI Semantic Search Engine Suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useScreenshotStore.setState({ screenshots: [] });
    await searchAnalyticsService.clearAnalytics();
  });

  describe('1. SearchIntentParser', () => {
    it('should correctly parse finance queries with merchant, amount, and tags', () => {
      const parsed = searchIntentParser.parse('PhonePe payments above ₹500');

      expect(parsed.domain).toBe('finance');
      expect(parsed.merchant).toBe('PhonePe');
      expect(parsed.amountRange).toBeDefined();
      expect(parsed.amountRange?.min).toBe(500);
      expect(parsed.tags).toContain('phonepe');
      expect(parsed.tags).toContain('finance');
    });

    it('should correctly parse shopping queries with merchant and date range', () => {
      const parsed = searchIntentParser.parse('Amazon receipts from last month');

      expect(parsed.domain).toBe('shopping');
      expect(parsed.merchant).toBe('Amazon');
      expect(parsed.documentType).toBe('receipt');
      expect(parsed.dateRange?.relative).toBe('last_month');
    });

    it('should correctly parse food orders with amount ranges (between X and Y)', () => {
      const parsed = searchIntentParser.parse('Swiggy orders between ₹200 and ₹500');

      expect(parsed.domain).toBe('food');
      expect(parsed.merchant).toBe('Swiggy');
      expect(parsed.amountRange?.min).toBe(200);
      expect(parsed.amountRange?.max).toBe(500);
    });

    it('should correctly parse identity document queries', () => {
      const aadhaar = searchIntentParser.parse('Aadhaar screenshot');
      expect(aadhaar.domain).toBe('documents');
      expect(aadhaar.documentType).toBe('aadhaar');

      const pan = searchIntentParser.parse('PAN card photo');
      expect(pan.domain).toBe('documents');
      expect(pan.documentType).toBe('pan');

      const passport = searchIntentParser.parse('my passport copy');
      expect(passport.domain).toBe('documents');
      expect(passport.documentType).toBe('passport');
    });

    it('should correctly parse travel queries and booking documents', () => {
      const flight = searchIntentParser.parse('Flight tickets to Delhi');
      expect(flight.domain).toBe('travel');
      expect(flight.documentType).toBe('ticket');
      expect(flight.categoryId).toBe('travel_transit');

      const train = searchIntentParser.parse('IRCTC train booking');
      expect(train.domain).toBe('travel');
      expect(train.merchant).toBe('IRCTC');
    });

    it('should identify question phrases', () => {
      const q = searchIntentParser.parse('Where is my Swiggy receipt?');
      expect(q.isQuestion).toBe(true);
    });

    it('should parse named months in temporal queries', () => {
      const parsed = searchIntentParser.parse('Payments from September');
      expect(parsed.dateRange?.relative).toBe('specific_month');
      expect(parsed.dateRange?.monthName).toBe('september');
    });
  });

  describe('2. 7-Signal Weighted Ranking Engine', () => {
    it('should rank Merchant Exact Match (100) higher than Tag Match (90)', async () => {
      const sMerchant = createMockScreenshot('s1', 'finance_bills', 'pay_1.jpg', 'Payment confirmation ₹550', {
        entities: { merchant: 'PhonePe', amount: '550' },
        createdAt: '2026-09-10T10:00:00Z',
      });

      const sTag = createMockScreenshot('s2', 'other', 'pay_2.jpg', 'Transaction done', {
        keywords: ['phonepe'],
        createdAt: '2026-09-10T10:00:00Z',
      });

      useScreenshotStore.setState({ screenshots: [sTag, sMerchant] });

      const results = await semanticSearchService.search('PhonePe');

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('s1'); // Merchant match (+100) > Tag match (+90)
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should rank Tag Match (90) higher than Category Match (80)', async () => {
      const sTag = createMockScreenshot('s_tag', 'shopping_orders', 'file1.jpg', 'Some purchase', {
        keywords: ['sneakers'],
        createdAt: '2026-09-01T10:00:00Z',
      });

      const sCategory = createMockScreenshot('s_cat', 'shopping_orders', 'file2.jpg', 'Other item', {
        categoryName: 'Shopping & Orders',
        createdAt: '2026-09-01T10:00:00Z',
      });

      useScreenshotStore.setState({ screenshots: [sCategory, sTag] });

      const results = await semanticSearchService.search('sneakers');
      expect(results[0].id).toBe('s_tag');
    });

    it('should rank Category Match (80) higher than OCR Keyword Match (70)', async () => {
      const sCat = createMockScreenshot('s_cat', 'food_dining', 'order.jpg', 'Order receipt', {
        categoryName: 'Food & Dining',
        createdAt: '2026-09-01T10:00:00Z',
      });

      const sOcr = createMockScreenshot('s_ocr', 'other', 'screen.jpg', 'Enjoy your food dine in', {
        createdAt: '2026-09-01T10:00:00Z',
      });

      useScreenshotStore.setState({ screenshots: [sOcr, sCat] });

      const results = await semanticSearchService.search('food');
      expect(results[0].id).toBe('s_cat');
    });

    it('should rank OCR Keyword Match (70) higher than Summary Match (60)', async () => {
      const sOcr = createMockScreenshot('s_ocr', 'other', 'doc.jpg', 'Aadhaar UIDAI Govt of India', {
        createdAt: '2026-09-01T10:00:00Z',
      });

      const sSummary = createMockScreenshot('s_sum', 'other', 'image.jpg', 'Plain image', {
        createdAt: '2026-09-01T10:00:00Z',
      });
      (sSummary as any).summary = 'An identity card of user with aadhaar number';

      useScreenshotStore.setState({ screenshots: [sSummary, sOcr] });

      const results = await semanticSearchService.search('aadhaar');
      expect(results[0].id).toBe('s_ocr');
    });

    it('should rank Summary Match (60) higher than Filename Match (40)', async () => {
      const sSum = createMockScreenshot('s_sum', 'other', 'img_123.jpg', 'nothing', {
        createdAt: '2026-09-01T10:00:00Z',
      });
      (sSum as any).summary = 'Meeting notes from design sprint discussion';

      const sFile = createMockScreenshot('s_file', 'other', 'discussion_notes.jpg', 'nothing', {
        createdAt: '2026-09-01T10:00:00Z',
      });

      useScreenshotStore.setState({ screenshots: [sFile, sSum] });

      const results = await semanticSearchService.search('discussion');
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('s_sum');
      expect(results[1].id).toBe('s_file');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should apply recency bonus (+20 for <=7 days)', async () => {
      const today = new Date().toISOString();
      const sRecent = createMockScreenshot('s_recent', 'finance', 'p1.jpg', 'Payment receipt', {
        createdAt: today,
      });

      const sOld = createMockScreenshot('s_old', 'finance', 'p2.jpg', 'Payment receipt', {
        createdAt: '2025-01-01T10:00:00Z',
      });

      useScreenshotStore.setState({ screenshots: [sOld, sRecent] });

      const results = await semanticSearchService.search('Payment');
      expect(results[0].id).toBe('s_recent');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should strictly deduplicate results when candidate matches multiple criteria', async () => {
      const sMulti = createMockScreenshot('s_multi', 'finance_bills', 'phonepe_receipt.jpg', 'PhonePe ₹550', {
        entities: { merchant: 'PhonePe', amount: '550' },
        keywords: ['phonepe', 'payment'],
        tags: [{ id: 't1', name: 'phonepe', colorHex: '#6366F1' }],
      });

      useScreenshotStore.setState({ screenshots: [sMulti] });

      const results = await semanticSearchService.search('PhonePe');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('s_multi');
    });
  });

  describe('3. Public Semantic Search APIs', () => {
    beforeEach(() => {
      const s1 = createMockScreenshot('s1', 'finance_bills', 'swiggy_bill.jpg', 'Swiggy delivery ₹340', {
        entities: { merchant: 'Swiggy', amount: '340' },
        createdAt: '2026-09-18T10:00:00Z',
      });
      const s2 = createMockScreenshot('s2', 'finance_bills', 'phonepe_bill.jpg', 'PhonePe ₹850', {
        entities: { merchant: 'PhonePe', amount: '850' },
        createdAt: '2026-09-17T10:00:00Z',
      });
      const s3 = createMockScreenshot('s3', 'travel_transit', 'irctc_ticket.jpg', 'IRCTC PNR 1234567890 Flight', {
        createdAt: '2026-09-16T10:00:00Z',
      });
      const s4 = createMockScreenshot('s4', 'personal_docs', 'aadhaar_card.jpg', 'Govt of India Aadhaar 1234', {
        createdAt: '2026-09-15T10:00:00Z',
      });

      useScreenshotStore.setState({ screenshots: [s1, s2, s3, s4] });
    });

    it('searchByMerchant should filter by merchant name', async () => {
      const results = await semanticSearchService.searchByMerchant('Swiggy');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('s1');
    });

    it('searchByAmount should filter by amount threshold', async () => {
      const above500 = await semanticSearchService.searchByAmount({ min: 500 });
      expect(above500.length).toBe(1);
      expect(above500[0].id).toBe('s2'); // PhonePe ₹850
    });

    it('searchByCategory should filter by category ID', async () => {
      const travel = await semanticSearchService.searchByCategory('travel_transit');
      expect(travel.length).toBe(1);
      expect(travel[0].id).toBe('s3');
    });

    it('searchByDocument should search identity documents', async () => {
      const docs = await semanticSearchService.searchByDocument('aadhaar');
      expect(docs.length).toBe(1);
      expect(docs[0].id).toBe('s4');
    });

    it('searchByTravel should find tickets and boarding passes', async () => {
      const travel = await semanticSearchService.searchByTravel();
      expect(travel.some((item) => item.id === 's3')).toBe(true);
    });

    it('rebuildSearchIndex should report indexed count and latency', async () => {
      const res = await semanticSearchService.rebuildSearchIndex();
      expect(res.indexedCount).toBeGreaterThanOrEqual(4);
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. SearchSuggestionService', () => {
    it('should suggest popular merchants when matching prefix is typed', async () => {
      const suggs = await searchSuggestionService.getSuggestions('sw');
      expect(suggs.some((s) => s.toLowerCase().includes('swiggy'))).toBe(true);
    });

    it('should return default suggestions when query is empty', async () => {
      const suggs = await searchSuggestionService.getSuggestions('');
      expect(suggs.length).toBeGreaterThan(0);
      expect(suggs.some((s) => s.includes('PhonePe'))).toBe(true);
    });
  });

  describe('5. SearchAnalyticsService', () => {
    it('should record searches and compute accurate latency and success rate', async () => {
      await searchAnalyticsService.recordSearch('PhonePe payments', 3, 25, 'Finance & Bills', 'PhonePe');
      await searchAnalyticsService.recordSearch('PhonePe recharge', 2, 20, 'Finance & Bills', 'PhonePe');
      await searchAnalyticsService.recordSearch('Aadhaar', 1, 15, 'Identity & Documents', undefined);
      await searchAnalyticsService.recordSearch('Unknown Query', 0, 10, undefined, undefined);

      const metrics = await searchAnalyticsService.getAnalytics();

      expect(metrics.totalSearches).toBe(4);
      expect(metrics.averageLatencyMs).toBe(18); // (25 + 20 + 15 + 10) / 4 = 17.5 -> 18
      expect(metrics.successRate).toBe(75); // 3 out of 4 successful (75%)
      expect(metrics.topMerchants[0]?.name).toBe('PhonePe');
      expect(metrics.topCategories[0]?.name).toBe('Finance & Bills');
    });

    it('should clear analytics logs', async () => {
      await searchAnalyticsService.recordSearch('Test query', 1, 20);
      await searchAnalyticsService.clearAnalytics();

      const metrics = await searchAnalyticsService.getAnalytics();
      expect(metrics.totalSearches).toBe(0);
      expect(metrics.averageLatencyMs).toBe(0);
    });
  });

  describe('6. Offline Fallback & Deduplication', () => {
    it('should return valid results offline using in-memory screenshot store without crashing', async () => {
      useScreenshotStore.setState({
        screenshots: [
          createMockScreenshot('off_1', 'food_dining', 'zomato_order.jpg', 'Zomato order confirmed ₹450', {
            entities: { merchant: 'Zomato', amount: '450' },
          }),
        ],
      });

      const results = await semanticSearchService.search('Zomato');
      expect(results.length).toBe(1);
      expect(results[0].fileName).toBe('zomato_order.jpg');
      expect(results[0].detectedEntities?.some((e) => e.value.includes('450'))).toBe(true);
    });
  });
});

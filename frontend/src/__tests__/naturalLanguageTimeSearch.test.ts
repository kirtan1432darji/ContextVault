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

import { searchService } from '../services/searchService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

const createMockScreenshot = (
  id: string,
  categoryId: string,
  categoryName: string,
  createdAt: string,
  extra: any = {}
): ScreenshotModel => ({
  id,
  deviceAssetId: `asset_${id}`,
  filePath: `file:///storage/emulated/0/Pictures/Screenshots/${id}.jpg`,
  localPath: `file:///storage/emulated/0/Pictures/Screenshots/${id}.jpg`,
  fileName: `${id}.jpg`,
  fileSize: 2048,
  width: 1080,
  height: 2400,
  createdAt,
  createdOn: createdAt,
  categoryId,
  folderId: categoryId,
  categoryName,
  subcategory: extra.subcategory || 'General',
  confidence: 0.95,
  isAutoCategorized: true,
  isFavorite: false,
  isReviewed: true,
  isSynced: false,
  ocrStatus: 'completed',
  ocrText: extra.ocrText || '',
  tags: (extra.tags || []).map((t: string) => ({ id: `tag_${t}`, name: t, colorHex: '#6366F1' })),
  keywords: extra.tags || [],
  entities: extra.entities,
  sourceApp: extra.sourceApp,
  detectedApp: extra.detectedApp,
  ...extra,
});

describe('Sprint P3-A: Natural Language Time & Intent Search', () => {
  describe('parseNaturalLanguageTimeFilters', () => {
    it('parses relative time keywords: today, yesterday, this week, last week, this month, last month', () => {
      const todayRes = searchService.parseNaturalLanguageTimeFilters('show me today receipts');
      expect(todayRes.period).toBe('today');
      expect(todayRes.dateFrom).toBeDefined();
      expect(todayRes.dateTo).toBe(todayRes.dateFrom);

      const yestRes = searchService.parseNaturalLanguageTimeFilters('yesterday upi transactions');
      expect(yestRes.period).toBe('yesterday');
      expect(yestRes.dateFrom).toBeDefined();

      const weekRes = searchService.parseNaturalLanguageTimeFilters('this week tickets');
      expect(weekRes.period).toBe('this_week');

      const lastWeekRes = searchService.parseNaturalLanguageTimeFilters('last week spent');
      expect(lastWeekRes.period).toBe('last_week');

      const thisMonthRes = searchService.parseNaturalLanguageTimeFilters('this month groceries');
      expect(thisMonthRes.period).toBe('this_month');

      const lastMonthRes = searchService.parseNaturalLanguageTimeFilters('last month bills');
      expect(lastMonthRes.period).toBe('last_month');
    });

    it('parses month names like September, August, October', () => {
      const sepRes = searchService.parseNaturalLanguageTimeFilters('September payments');
      expect(sepRes.period).toBe('specific_month');
      expect(sepRes.monthName).toBe('september');
      expect(sepRes.dateFrom).toContain('-09-01');
      expect(sepRes.dateTo).toContain('-09-30');
      expect(sepRes.detectedIntent?.domain).toBe('finance');
      expect(sepRes.detectedIntent?.categoryId).toBe('finance_bills');
    });

    it('detects user intents for salary, amazon, swiggy, flight tickets', () => {
      const salaryRes = searchService.parseNaturalLanguageTimeFilters('salary credited');
      expect(salaryRes.detectedIntent?.domain).toBe('finance');
      expect(salaryRes.detectedIntent?.tags).toContain('salary');

      const amazonRes = searchService.parseNaturalLanguageTimeFilters('amazon order');
      expect(amazonRes.detectedIntent?.merchant).toBe('Amazon');
      expect(amazonRes.detectedIntent?.domain).toBe('shopping');

      const swiggyRes = searchService.parseNaturalLanguageTimeFilters('swiggy lunch');
      expect(swiggyRes.detectedIntent?.merchant).toBe('Swiggy');
      expect(swiggyRes.detectedIntent?.domain).toBe('food');

      const flightRes = searchService.parseNaturalLanguageTimeFilters('flight tickets');
      expect(flightRes.detectedIntent?.domain).toBe('travel');
      expect(flightRes.detectedIntent?.categoryId).toBe('travel_transit');
    });
  });

  describe('searchWithFilters with Natural Language Queries', () => {
    const now = new Date();
    const formatLocalDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const todayStr = formatLocalDate(now);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterday);

    beforeEach(() => {
      useScreenshotStore.getState().setScreenshots([]);
    });

    it('filters screenshots by detected time and domain intent in fallback', async () => {
      const sTodayPay = createMockScreenshot(
        'sc_td_pay',
        'finance_bills',
        'Finance & Bills',
        `${todayStr}T10:00:00Z`,
        { ocrText: 'Payment of ₹500 via PhonePe successful', entities: { amount: 500, merchant: 'PhonePe' } }
      );
      const sYestChat = createMockScreenshot(
        'sc_yd_chat',
        'social_chat',
        'Chats & Social',
        `${yesterdayStr}T15:00:00Z`,
        { ocrText: 'Hey see you tomorrow', sourceApp: 'WhatsApp' }
      );

      useScreenshotStore.getState().setScreenshots([sTodayPay, sYestChat]);

      // Search "today payments"
      const res = await searchService.searchWithFilters({ query: 'today payments' });
      expect(res.isSuccess).toBe(true);
      if (res.isSuccess) {
        expect(res.data.length).toBe(1);
        expect(res.data[0].id).toBe('sc_td_pay');
      }
    });

    it('filters screenshots by merchant intent', async () => {
      const sAmazon = createMockScreenshot(
        'sc_amz',
        'shopping_orders',
        'Shopping & Orders',
        `${todayStr}T11:00:00Z`,
        { ocrText: 'Amazon Order #402-1293847-928374', entities: { merchant: 'Amazon' } }
      );
      const sFlipkart = createMockScreenshot(
        'sc_flp',
        'shopping_orders',
        'Shopping & Orders',
        `${todayStr}T12:00:00Z`,
        { ocrText: 'Flipkart SuperCoins Used', entities: { merchant: 'Flipkart' } }
      );

      useScreenshotStore.getState().setScreenshots([sAmazon, sFlipkart]);

      const res = await searchService.searchWithFilters({ query: 'Amazon orders' });
      expect(res.isSuccess).toBe(true);
      if (res.isSuccess) {
        expect(res.data.length).toBe(1);
        expect(res.data[0].id).toBe('sc_amz');
      }
    });
  });
});

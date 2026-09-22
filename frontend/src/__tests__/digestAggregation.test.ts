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

import { digestAggregationService } from '../services/memory/DigestAggregationService';
import { memoryTimelineService } from '../services/memory/MemoryTimelineService';
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

describe('Sprint P3-A: Digest Aggregation Service', () => {
  const now = new Date();
  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  beforeEach(async () => {
    useScreenshotStore.getState().setScreenshots([]);
    await memoryTimelineService.clearAll();
  });

  it('generates weekly digest with YYYY-Www key format and aggregation metrics', async () => {
    const todayStr = formatLocalDate(now);
    const s1 = createMockScreenshot(
      'sc_w1',
      'finance_bills',
      'Finance & Bills',
      `${todayStr}T10:00:00Z`,
      {
        entities: { amount: 800, merchant: 'Swiggy' },
        sourceApp: 'Swiggy',
      }
    );
    const s2 = createMockScreenshot(
      'sc_w2',
      'travel_transit',
      'Travel & Transit',
      `${todayStr}T11:00:00Z`,
      {
        sourceApp: 'IRCTC',
        tags: ['travel', 'ticket'],
      }
    );

    useScreenshotStore.getState().setScreenshots([s1, s2]);
    await memoryTimelineService.rebuildTimeline();

    const weekly = await digestAggregationService.getWeeklyDigest(0, true);

    expect(weekly.weekKey).toMatch(/^\d{4}-W\d{2}$/);
    expect(weekly.totalScreenshots).toBeGreaterThanOrEqual(2);
    expect(weekly.totalSpending).toBe(800);
    expect(weekly.summary).toContain('This Week');
  });

  it('generates monthly digest with YYYY-MM key format and category spending breakdown', async () => {
    const todayStr = formatLocalDate(now);
    const s1 = createMockScreenshot(
      'sc_m1',
      'finance_bills',
      'Finance & Bills',
      `${todayStr}T10:00:00Z`,
      {
        entities: { amount: 2500, merchant: 'Amazon' },
        sourceApp: 'Amazon',
      }
    );

    useScreenshotStore.getState().setScreenshots([s1]);
    await memoryTimelineService.rebuildTimeline();

    const monthly = await digestAggregationService.getMonthlyDigest(0, true);

    expect(monthly.monthKey).toMatch(/^\d{4}-\d{2}$/);
    expect(monthly.totalScreenshots).toBeGreaterThanOrEqual(1);
    expect(monthly.totalSpending).toBe(2500);
  });

  it('calculates screenshot capture streaks accurately across consecutive days', async () => {
    const today = new Date();
    const day1 = formatLocalDate(today);
    const day2 = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
    const day3 = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2));

    const sToday = createMockScreenshot('sc_strk_1', 'finance_bills', 'Finance', `${day1}T10:00:00Z`);
    const sYest = createMockScreenshot('sc_strk_2', 'social_chat', 'Social', `${day2}T10:00:00Z`);
    const s2DaysAgo = createMockScreenshot('sc_strk_3', 'shopping_orders', 'Shopping', `${day3}T10:00:00Z`);

    useScreenshotStore.getState().setScreenshots([sToday, sYest, s2DaysAgo]);
    await memoryTimelineService.rebuildTimeline();

    const streak = await digestAggregationService.calculateScreenshotStreak(true);
    expect(streak).toBe(3);
  });

  it('generates yearly highlights with top merchant, biggest spend, and active month', async () => {
    const year = now.getFullYear();
    const s1 = createMockScreenshot(
      'sc_y1',
      'finance_bills',
      'Finance & Bills',
      `${year}-05-10T12:00:00Z`,
      {
        entities: { amount: 12000, merchant: 'Flight Booking' },
        sourceApp: 'MakeMyTrip',
      }
    );
    const s2 = createMockScreenshot(
      'sc_y2',
      'shopping_orders',
      'Shopping & Orders',
      `${year}-05-12T14:00:00Z`,
      {
        entities: { amount: 3000, merchant: 'Flipkart' },
        sourceApp: 'Flipkart',
      }
    );

    useScreenshotStore.getState().setScreenshots([s1, s2]);
    await memoryTimelineService.rebuildTimeline();

    const highlights = await digestAggregationService.getYearlyHighlights(year);

    expect(highlights.year).toBe(year);
    expect(highlights.totalScreenshots).toBe(2);
    expect(highlights.totalSpending).toBe(15000);
    expect(highlights.biggestPurchase?.amount).toBe(12000);
    expect(highlights.topCategory).toBe('Finance & Bills');
  });
});

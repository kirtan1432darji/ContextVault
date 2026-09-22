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

import { dailyDigestService } from '../services/memory/DailyDigestService';
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

describe('Sprint P3-A: Daily Digest Engine', () => {
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

  beforeEach(async () => {
    useScreenshotStore.getState().setScreenshots([]);
    await memoryTimelineService.clearAll();
  });

  it('generates today digest with spending, merchants, and categories', async () => {
    const s1 = createMockScreenshot(
      'sc_p1',
      'finance_bills',
      'Finance & Bills',
      `${todayStr}T10:00:00Z`,
      {
        entities: { amount: 650, merchant: 'PhonePe' },
        sourceApp: 'PhonePe',
        tags: ['payment', 'upi'],
      }
    );
    const s2 = createMockScreenshot(
      'sc_p2',
      'shopping_orders',
      'Shopping & Orders',
      `${todayStr}T12:00:00Z`,
      {
        entities: { amount: 1200, merchant: 'Amazon' },
        sourceApp: 'Amazon',
        tags: ['shopping', 'amazon'],
      }
    );
    const s3 = createMockScreenshot(
      'sc_p3',
      'social_chat',
      'Chats & Social',
      `${todayStr}T15:00:00Z`,
      {
        sourceApp: 'WhatsApp',
        tags: ['chat'],
      }
    );

    useScreenshotStore.getState().setScreenshots([s1, s2, s3]);
    await memoryTimelineService.rebuildTimeline();

    const digest = await dailyDigestService.getTodayDigest(true);

    expect(digest.date).toBe(todayStr);
    expect(digest.totalScreenshots).toBe(3);
    expect(digest.spendingTotal).toBe(1850); // 650 + 1200
    expect(digest.payments.count).toBe(1);
    expect(digest.payments.totalAmount).toBe(650);
    expect(digest.orders.count).toBe(1);
    expect(digest.chats.count).toBe(1);
    expect(digest.highlights.length).toBeGreaterThanOrEqual(1);
    expect(digest.summary).toContain('Today in ContextVault:');
  });

  it('generates yesterday digest with accurate statistics and breakdown', async () => {
    const s1 = createMockScreenshot(
      'sc_yest_1',
      'finance_bills',
      'Finance & Bills',
      `${yesterdayStr}T09:30:00Z`,
      {
        entities: { amount: 1500, merchant: 'Google Pay' },
        sourceApp: 'Google Pay',
      }
    );

    useScreenshotStore.getState().setScreenshots([s1]);
    await memoryTimelineService.rebuildTimeline();

    const digest = await dailyDigestService.getDigestForDate(yesterdayStr, true);

    expect(digest.date).toBe(yesterdayStr);
    expect(digest.totalScreenshots).toBe(1);
    expect(digest.spendingTotal).toBe(1500);
    expect(digest.payments.totalAmount).toBe(1500);
    expect(digest.payments.merchants).toContain('Google Pay');
  });

  it('updates daily digest and invalidates cache when a new screenshot arrives', async () => {
    const s1 = createMockScreenshot(
      'sc_new',
      'finance_bills',
      'Finance & Bills',
      `${todayStr}T18:00:00Z`,
      { entities: { amount: 300, merchant: 'Paytm' } }
    );

    useScreenshotStore.getState().setScreenshots([s1]);
    await memoryTimelineService.rebuildTimeline();

    const updated = await dailyDigestService.updateDailyDigest(s1.createdAt);
    expect(updated).not.toBeNull();
    expect(updated?.spendingTotal).toBe(300);
    expect(updated?.totalScreenshots).toBe(1);
  });
});

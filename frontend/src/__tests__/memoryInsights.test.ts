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

import { memoryInsightsService } from '../services/memory/MemoryInsightsService';
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

describe('Sprint P3-A: Memory Insights Service', () => {
  const now = new Date();
  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatLocalDate(now);

  beforeEach(async () => {
    useScreenshotStore.getState().setScreenshots([]);
    await memoryTimelineService.clearAll();
    memoryInsightsService.clearCache();
  });

  it('generates all 6 domain cards (spending, shopping, productivity, travel, health, communication)', async () => {
    const s1 = createMockScreenshot(
      'sc_ins_1',
      'finance_bills',
      'Finance & Bills',
      `${todayStr}T10:00:00Z`,
      { entities: { amount: 500, merchant: 'PhonePe' }, sourceApp: 'PhonePe' }
    );
    const s2 = createMockScreenshot(
      'sc_ins_2',
      'shopping_orders',
      'Shopping & Orders',
      `${todayStr}T11:00:00Z`,
      { sourceApp: 'Amazon', tags: ['shopping'] }
    );
    const s3 = createMockScreenshot(
      'sc_ins_3',
      'travel_transit',
      'Travel & Transit',
      `${todayStr}T12:00:00Z`,
      { sourceApp: 'Uber', tags: ['travel', 'cab'] }
    );
    const s4 = createMockScreenshot(
      'sc_ins_4',
      'documents',
      'Identity & Documents',
      `${todayStr}T13:00:00Z`,
      { tags: ['id', 'pan'] }
    );
    const s5 = createMockScreenshot(
      'sc_ins_5',
      'social_chat',
      'Chats & Social',
      `${todayStr}T14:00:00Z`,
      { sourceApp: 'WhatsApp' }
    );
    const s6 = createMockScreenshot(
      'sc_ins_6',
      'health_fitness',
      'Health & Medical',
      `${todayStr}T15:00:00Z`,
      { tags: ['medical', 'prescription'] }
    );

    useScreenshotStore.getState().setScreenshots([s1, s2, s3, s4, s5, s6]);
    await memoryTimelineService.rebuildTimeline();

    const cards = await memoryInsightsService.getAllInsights(true);

    expect(cards.length).toBe(6);
    const domains = cards.map((c) => c.domain);
    expect(domains).toContain('spending');
    expect(domains).toContain('shopping');
    expect(domains).toContain('productivity');
    expect(domains).toContain('travel');
    expect(domains).toContain('health');
    expect(domains).toContain('communication');
  });

  it('generates accurate spending insight metrics and top merchant', async () => {
    const s1 = createMockScreenshot(
      'sc_sp1',
      'finance_bills',
      'Finance & Bills',
      `${todayStr}T09:00:00Z`,
      { entities: { amount: 1500, merchant: 'Swiggy' }, sourceApp: 'Swiggy' }
    );
    const s2 = createMockScreenshot(
      'sc_sp2',
      'finance_bills',
      'Finance & Bills',
      `${todayStr}T10:00:00Z`,
      { entities: { amount: 500, merchant: 'PhonePe' }, sourceApp: 'PhonePe' }
    );

    useScreenshotStore.getState().setScreenshots([s1, s2]);
    await memoryTimelineService.rebuildTimeline();

    const spendingCard = await memoryInsightsService.getInsightDomain('spending');

    expect(spendingCard).not.toBeNull();
    expect(spendingCard?.domain).toBe('spending');
    expect(spendingCard?.primaryMetric).toContain('₹2,000');
    expect(spendingCard?.subtitle).toContain('Swiggy');
    expect(spendingCard?.items.length).toBeGreaterThan(0);
  });

  it('refreshes memory insights and invalidates cache', async () => {
    const refreshedCards = await memoryInsightsService.refreshMemoryInsights();
    expect(Array.isArray(refreshedCards)).toBe(true);
    expect(refreshedCards.length).toBe(6);
  });
});

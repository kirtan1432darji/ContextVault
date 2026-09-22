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

describe('Sprint P3-A: Memory Timeline Engine', () => {
  beforeEach(async () => {
    useScreenshotStore.getState().setScreenshots([]);
    await memoryTimelineService.clearAll();
  });

  describe('Adaptive Merge Windows', () => {
    it('merges proximate payment screenshots within 5-minute window', async () => {
      const baseTime = new Date('2026-09-22T10:00:00Z').getTime();
      const s1 = createMockScreenshot(
        'sc_pay_1',
        'finance_bills',
        'Finance & Bills',
        new Date(baseTime).toISOString(),
        {
          ocrText: 'Paid to Swiggy ₹350 successfully',
          entities: { amount: 350, merchant: 'Swiggy' },
          tags: ['swiggy', 'food'],
        }
      );
      // 3 minutes later (<= 5 min window)
      const s2 = createMockScreenshot(
        'sc_pay_2',
        'finance_bills',
        'Finance & Bills',
        new Date(baseTime + 3 * 60 * 1000).toISOString(),
        {
          ocrText: 'Tip ₹50 paid to Swiggy',
          entities: { amount: 50, merchant: 'Swiggy' },
          tags: ['tip'],
        }
      );

      useScreenshotStore.getState().setScreenshots([s1, s2]);
      const grouping = await memoryTimelineService.rebuildTimeline();
      const events = grouping.allEvents;

      // Should be merged into 1 timeline event
      expect(events.length).toBe(1);
      const merged = events[0];
      expect(merged.screenshotIds.length).toBe(2);
      expect(merged.screenshotIds).toContain('sc_pay_1');
      expect(merged.screenshotIds).toContain('sc_pay_2');
      expect(merged.amount).toBe(400); // 350 + 50
      expect(merged.tags).toContain('swiggy');
      expect(merged.tags).toContain('tip');
    });

    it('does NOT merge payment screenshots separated by more than 5 minutes', async () => {
      const baseTime = new Date('2026-09-22T10:00:00Z').getTime();
      const s1 = createMockScreenshot(
        'sc_pay_1',
        'finance_bills',
        'Finance & Bills',
        new Date(baseTime).toISOString(),
        { entities: { amount: 500, merchant: 'PhonePe' } }
      );
      // 10 minutes later (> 5 min window)
      const s2 = createMockScreenshot(
        'sc_pay_2',
        'finance_bills',
        'Finance & Bills',
        new Date(baseTime + 10 * 60 * 1000).toISOString(),
        { entities: { amount: 200, merchant: 'PhonePe' } }
      );

      useScreenshotStore.getState().setScreenshots([s1, s2]);
      const grouping = await memoryTimelineService.rebuildTimeline();
      const events = grouping.allEvents;

      expect(events.length).toBe(2);
    });

    it('merges chat screenshots within 10-minute window', async () => {
      const baseTime = new Date('2026-09-22T14:00:00Z').getTime();
      const s1 = createMockScreenshot(
        'sc_chat_1',
        'social_chat',
        'Chats & Social',
        new Date(baseTime).toISOString(),
        { sourceApp: 'WhatsApp' }
      );
      // 7 minutes later (<= 10 min window)
      const s2 = createMockScreenshot(
        'sc_chat_2',
        'social_chat',
        'Chats & Social',
        new Date(baseTime + 7 * 60 * 1000).toISOString(),
        { sourceApp: 'WhatsApp' }
      );

      useScreenshotStore.getState().setScreenshots([s1, s2]);
      const grouping = await memoryTimelineService.rebuildTimeline();
      const events = grouping.allEvents;

      expect(events.length).toBe(1);
      expect(events[0].screenshotCount).toBe(2);
    });

    it('merges shopping screenshots within 8-minute window', async () => {
      const baseTime = new Date('2026-09-22T16:00:00Z').getTime();
      const s1 = createMockScreenshot(
        'sc_shop_1',
        'shopping_orders',
        'Shopping & Orders',
        new Date(baseTime).toISOString(),
        { sourceApp: 'Amazon' }
      );
      // 6 minutes later (<= 8 min window)
      const s2 = createMockScreenshot(
        'sc_shop_2',
        'shopping_orders',
        'Shopping & Orders',
        new Date(baseTime + 6 * 60 * 1000).toISOString(),
        { sourceApp: 'Amazon' }
      );

      useScreenshotStore.getState().setScreenshots([s1, s2]);
      const grouping = await memoryTimelineService.rebuildTimeline();
      const events = grouping.allEvents;

      expect(events.length).toBe(1);
    });

    it('merges travel screenshots within 15-minute window', async () => {
      const baseTime = new Date('2026-09-22T18:00:00Z').getTime();
      const s1 = createMockScreenshot(
        'sc_trv_1',
        'travel_transit',
        'Travel & Transit',
        new Date(baseTime).toISOString(),
        { sourceApp: 'IRCTC' }
      );
      // 12 minutes later (<= 15 min window)
      const s2 = createMockScreenshot(
        'sc_trv_2',
        'travel_transit',
        'Travel & Transit',
        new Date(baseTime + 12 * 60 * 1000).toISOString(),
        { sourceApp: 'IRCTC' }
      );

      useScreenshotStore.getState().setScreenshots([s1, s2]);
      const grouping = await memoryTimelineService.rebuildTimeline();
      const events = grouping.allEvents;

      expect(events.length).toBe(1);
    });

    it('never merges screenshots of different categories even if 10 seconds apart', async () => {
      const baseTime = new Date('2026-09-22T11:00:00Z').getTime();
      const s1 = createMockScreenshot(
        'sc_pay',
        'finance_bills',
        'Finance & Bills',
        new Date(baseTime).toISOString(),
        { entities: { amount: 100 } }
      );
      const s2 = createMockScreenshot(
        'sc_chat',
        'social_chat',
        'Chats & Social',
        new Date(baseTime + 10 * 1000).toISOString(),
        { sourceApp: 'WhatsApp' }
      );

      useScreenshotStore.getState().setScreenshots([s1, s2]);
      const grouping = await memoryTimelineService.rebuildTimeline();
      const events = grouping.allEvents;

      expect(events.length).toBe(2);
    });
  });

  describe('Period Groupings (Today, Yesterday, This Week, Earlier This Month, Older)', () => {
    it('correctly categorizes screenshots into chronological period groups', async () => {
      const now = new Date();
      const todayISO = now.toISOString();

      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayISO = yesterday.toISOString();

      const threeDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
      const threeDaysAgoISO = threeDaysAgo.toISOString();

      // Current month 20 days ago (if in same month, otherwise month start)
      const earlierDate = new Date(now.getFullYear(), now.getMonth(), 1);
      // If today is 1st or 2nd, set 3 days ago to avoid overlap
      const earlierMonthISO = earlierDate.toISOString();

      const lastYear = new Date(now.getFullYear() - 1, 5, 15);
      const lastYearISO = lastYear.toISOString();

      const sToday = createMockScreenshot('s_td', 'finance_bills', 'Finance', todayISO);
      const sYesterday = createMockScreenshot('s_yd', 'social_chat', 'Social', yesterdayISO);
      const sWeek = createMockScreenshot('s_wk', 'shopping_orders', 'Shopping', threeDaysAgoISO);
      const sOlder = createMockScreenshot('s_old', 'documents', 'Documents', lastYearISO);

      useScreenshotStore.getState().setScreenshots([sToday, sYesterday, sWeek, sOlder]);
      const grouping = await memoryTimelineService.getTimeline({ forceRefresh: true });

      expect(grouping.today.length).toBe(1);
      expect(grouping.today[0].screenshotId).toBe('s_td');
      expect(grouping.today[0].period).toBe('today');

      expect(grouping.yesterday.length).toBe(1);
      expect(grouping.yesterday[0].screenshotId).toBe('s_yd');
      expect(grouping.yesterday[0].period).toBe('yesterday');

      expect(grouping.thisWeek.length).toBe(1);
      expect(grouping.thisWeek[0].screenshotId).toBe('s_wk');
      expect(grouping.thisWeek[0].period).toBe('this_week');

      expect(grouping.older.length).toBe(1);
      expect(grouping.older[0].screenshotId).toBe('s_old');
      expect(grouping.older[0].period).toBe('older');
    });
  });

  describe('CRUD Operations & Section Retrieval', () => {
    it('adds, retrieves by section, and deletes timeline events', async () => {
      const s = createMockScreenshot('s_crud', 'finance_bills', 'Finance', new Date().toISOString(), {
        entities: { amount: 750, merchant: 'Zomato' },
      });

      await memoryTimelineService.addScreenshotToTimeline(s);

      const section = await memoryTimelineService.getTimelineSection('today');
      expect(section.length).toBe(1);
      expect(section[0].screenshotIds).toContain('s_crud');

      await memoryTimelineService.deleteTimelineEvent(section[0].id);

      const sectionAfter = await memoryTimelineService.getTimelineSection('today');
      expect(sectionAfter.length).toBe(0);
    });
  });
});

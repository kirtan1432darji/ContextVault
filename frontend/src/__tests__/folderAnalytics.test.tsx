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
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
}));

import { databaseService } from '../database';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { classificationCacheRepository } from '../database/repositories/classificationCacheRepository';
import { folderAnalyticsService } from '../services/FolderAnalyticsService';

describe('ContextVault Sprint P2-5 — Folder Analytics Dashboard Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(categoryRepository, 'getAllCategories').mockResolvedValue([
      { id: 'cat_finance', name: 'Finance', iconName: 'card-outline', colorHex: '10B981' } as any,
      { id: 'cat_work', name: 'Work', iconName: 'briefcase-outline', colorHex: '3B82F6' } as any,
      { id: 'unsorted', name: 'Unsorted', iconName: 'folder-outline', colorHex: '9CA3AF' } as any,
    ]);

    jest.spyOn(classificationCacheRepository, 'getAll').mockResolvedValue([
      {
        id: 'cache_1',
        screenshotId: 'sc_1',
        category: 'Finance',
        entitiesJson: JSON.stringify({
          amounts: ['$149.99', '₹4,500'],
          merchants: ['Amazon AWS'],
          dates: ['2026-09-10'],
          urls: ['https://aws.amazon.com'],
          emails: ['billing@amazon.com'],
        }),
      } as any,
      {
        id: 'cache_2',
        screenshotId: 'sc_2',
        category: 'Work',
        entitiesJson: JSON.stringify({
          amounts: ['$50.00'],
          merchants: ['GitHub'],
          dates: ['2026-09-12'],
          urls: [],
          emails: [],
        }),
      } as any,
    ]);
  });

  describe('1. Global Analytics Aggregation (folderAnalyticsService.getAnalyticsOverview)', () => {
    it('aggregates total counts, storage size, category distribution, confidence tiers, and entities', async () => {
      // Mock executeQuery responses sequentially:
      // 1. totalQuery: total_count, total_size, avg_confidence
      // 2. catQuery: category_id, category_name, count, total_size, avg_confidence
      // 3. highQuery: count
      // 4. medQuery: count
      // 5. lowQuery: count
      // 6. manualQuery: count
      // 7. appsQuery: app_name, count
      const executeQuerySpy = jest.spyOn(databaseService, 'executeQuery');

      executeQuerySpy
        .mockResolvedValueOnce([{ total_count: 50, total_size: 104857600, avg_confidence: 0.88 }])
        .mockResolvedValueOnce([
          { category_id: 'cat_finance', category_name: 'Finance', count: 30, total_size: 62914560, avg_confidence: 0.94 },
          { category_id: 'cat_work', category_name: 'Work', count: 15, total_size: 31457280, avg_confidence: 0.85 },
          { category_id: 'unsorted', category_name: 'Unsorted', count: 5, total_size: 10485760, avg_confidence: 0.52 },
        ])
        .mockResolvedValueOnce([{ count: 28 }]) // high tier (>90%)
        .mockResolvedValueOnce([{ count: 17 }]) // med tier (70-90%)
        .mockResolvedValueOnce([{ count: 5 }])  // low tier (<70% or unsorted)
        .mockResolvedValueOnce([{ count: 6 }])  // manual reclassifications
        .mockResolvedValueOnce([
          { app_name: 'Google Chrome', count: 22 },
          { app_name: 'WhatsApp', count: 18 },
          { app_name: 'Slack', count: 10 },
        ]);

      const overview = await folderAnalyticsService.getAnalyticsOverview();

      expect(overview.totalScreenshots).toBe(50);
      expect(overview.totalStorageBytes).toBe(104857600);
      expect(overview.averageConfidence).toBe(0.88);
      expect(overview.manualReclassifiedCount).toBe(6);
      expect(overview.needsReviewCount).toBe(5);

      // Categories distribution
      expect(overview.categories.length).toBe(3);
      expect(overview.categories[0].categoryName).toBe('Finance');
      expect(overview.categories[0].count).toBe(30);
      expect(overview.categories[0].percentageOfTotal).toBe(60.0);
      expect(overview.categories[1].percentageOfTotal).toBe(30.0);

      // Confidence Tiers
      expect(overview.confidenceTiers.length).toBe(3);
      const highTier = overview.confidenceTiers.find((t) => t.tier === 'high');
      expect(highTier?.count).toBe(28);
      expect(highTier?.percentage).toBe(56.0);

      const medTier = overview.confidenceTiers.find((t) => t.tier === 'medium');
      expect(medTier?.count).toBe(17);
      expect(medTier?.percentage).toBe(34.0);

      const lowTier = overview.confidenceTiers.find((t) => t.tier === 'low');
      expect(lowTier?.count).toBe(5);
      expect(lowTier?.percentage).toBe(10.0);

      // Source apps
      expect(overview.sourceApps.length).toBe(3);
      expect(overview.sourceApps[0].appName).toBe('Google Chrome');
      expect(overview.sourceApps[0].percentage).toBe(44.0);

      // Entities tally from classification cache
      expect(overview.entitiesTally.amountsCount).toBe(3);
      expect(overview.entitiesTally.merchantsCount).toBe(2);
      expect(overview.entitiesTally.datesCount).toBe(2);
      expect(overview.entitiesTally.urlsCount).toBe(1);
      expect(overview.entitiesTally.emailsCount).toBe(1);
      expect(overview.entitiesTally.totalEntities).toBe(9);
    });
  });

  describe('2. Scoped Analytics (Single Category Filter)', () => {
    it('applies category_id filter to all aggregation queries', async () => {
      const executeQuerySpy = jest.spyOn(databaseService, 'executeQuery');

      executeQuerySpy
        .mockResolvedValueOnce([{ total_count: 20, total_size: 41943040, avg_confidence: 0.95 }])
        .mockResolvedValueOnce([
          { category_id: 'cat_finance', category_name: 'Finance', count: 20, total_size: 41943040, avg_confidence: 0.95 },
        ])
        .mockResolvedValueOnce([{ count: 18 }])
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 3 }])
        .mockResolvedValueOnce([{ app_name: 'Google Chrome', count: 20 }]);

      const scoped = await folderAnalyticsService.getAnalyticsOverview('cat_finance');

      expect(scoped.totalScreenshots).toBe(20);
      expect(scoped.categories.length).toBe(1);
      expect(scoped.categories[0].categoryId).toBe('cat_finance');

      // Verify params passed
      for (const call of executeQuerySpy.mock.calls) {
        expect(call[1]).toContain('cat_finance');
      }
    });
  });

  describe('3. Non-Destructive Intelligence Guarantee', () => {
    it('performs read-only aggregations without calling executeCommand or mutating filesystem records', async () => {
      const executeCommandSpy = jest.spyOn(databaseService, 'executeCommand');
      const executeQuerySpy = jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([]);

      await folderAnalyticsService.getAnalyticsOverview();

      expect(executeCommandSpy).not.toHaveBeenCalled();
    });
  });
});

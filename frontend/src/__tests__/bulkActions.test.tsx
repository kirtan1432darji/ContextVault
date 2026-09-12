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
  TouchableOpacity: 'TouchableOpacity',
  Alert: {
    alert: jest.fn(),
  },
  Share: {
    share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
  },
}));

jest.mock('../theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E5E7EB',
      primary: '#1A73E8',
      secondary: '#5F6368',
      accent: '#188038',
      success: '#188038',
      warning: '#F29900',
      error: '#D93025',
      textPrimary: '#202124',
      textSecondary: '#5F6368',
      textMuted: '#80868B',
    },
  }),
}));

import { databaseService } from '../database';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { smartFolderService } from '../services/SmartFolderService';
import { recycleBinService } from '../services/recycleBinService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

const createMockScreenshot = (id: string, categoryId = 'cat_finance', isFavorite = false): ScreenshotModel => ({
  id,
  deviceAssetId: `asset_${id}`,
  filePath: `file:///storage/${id}.jpg`,
  fileName: `${id}.jpg`,
  fileSize: 1024,
  width: 1080,
  height: 2400,
  createdAt: '2026-09-12T00:00:00Z',
  categoryId,
  categoryName: categoryId === 'cat_finance' ? 'Finance' : 'Work',
  subcategory: 'Invoices',
  confidence: 0.95,
  isAutoCategorized: true,
  isFavorite,
  isReviewed: true,
  isSynced: true,
  ocrStatus: 'completed',
  tags: [],
});

describe('ContextVault Sprint P2-3 — Bulk Screenshot Actions Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useScreenshotStore.setState({
      screenshots: [
        createMockScreenshot('sc_1', 'cat_finance', false),
        createMockScreenshot('sc_2', 'cat_finance', true),
        createMockScreenshot('sc_3', 'cat_finance', false),
      ],
      favorites: [createMockScreenshot('sc_2', 'cat_finance', true)],
      recycleBinScreenshots: [],
    });
  });

  describe('1. ScreenshotRepository Bulk Operations', () => {
    it('bulkSoftDelete sets is_deleted = 1 and deleted_at timestamp for multiple IDs', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      const count = await screenshotRepository.bulkSoftDelete(['sc_1', 'sc_2']);

      expect(count).toBe(2);
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'UPDATE screenshots SET is_deleted = 1, deleted_at = ? WHERE id IN (?,?)',
        [expect.any(String), 'sc_1', 'sc_2']
      );
    });

    it('bulkSetFavorite toggles is_favorite status for multiple IDs', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      const count = await screenshotRepository.bulkSetFavorite(['sc_1', 'sc_3'], true);

      expect(count).toBe(2);
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'UPDATE screenshots SET is_favorite = ? WHERE id IN (?,?)',
        [1, 'sc_1', 'sc_3']
      );
    });

    it('bulkUpdateCategory updates folder assignment for multiple IDs', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      const count = await screenshotRepository.bulkUpdateCategory(
        ['sc_1', 'sc_2'],
        'cat_travel',
        'Travel',
        'BoardingPass'
      );

      expect(count).toBe(2);
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'UPDATE screenshots SET category_id = ?, category_name = ?, subcategory = ?, is_auto_categorized = 0 WHERE id IN (?,?)',
        ['cat_travel', 'Travel', 'BoardingPass', 'sc_1', 'sc_2']
      );
    });
  });

  describe('2. SmartFolderService Bulk Move', () => {
    it('bulkMoveScreenshots moves items and recalculates counts for destination and source folders', async () => {
      jest.spyOn(categoryRepository, 'getCategoryById').mockResolvedValue({
        id: 'cat_work',
        name: 'Work',
        iconName: 'briefcase',
        colorHex: '3B82F6',
        isAiGenerated: true,
        itemCount: 5,
        confidenceAvg: 0.9,
      } as any);

      jest.spyOn(categoryRepository, 'getAllCategories').mockResolvedValue([]);
      jest.spyOn(categoryRepository, 'updateScreenshotCount').mockResolvedValue(undefined as any);
      jest.spyOn(screenshotRepository, 'updateScreenshot').mockResolvedValue(undefined as any);

      jest.spyOn(screenshotRepository, 'getScreenshotById').mockImplementation(async (id: string) => {
        return createMockScreenshot(id, 'cat_finance');
      });

      const moved = await smartFolderService.bulkMoveScreenshots(['sc_1', 'sc_2'], 'cat_work');

      expect(moved).toBe(2);
      expect(categoryRepository.updateScreenshotCount).toHaveBeenCalledWith('cat_work');
      expect(categoryRepository.updateScreenshotCount).toHaveBeenCalledWith('cat_finance');
    });
  });

  describe('3. RecycleBinService Bulk Soft Delete', () => {
    it('bulkSoftDelete soft deletes items and recalculates category counts', async () => {
      jest.spyOn(screenshotRepository, 'bulkSoftDelete').mockResolvedValue(3);
      const recalcSpy = jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);

      const count = await recycleBinService.bulkSoftDelete(['sc_1', 'sc_2', 'sc_3']);

      expect(count).toBe(3);
      expect(recalcSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. useScreenshotStore Bulk State Management', () => {
    it('bulkSetFavorite updates all selected items in store and re-filters favorites', async () => {
      jest.spyOn(screenshotRepository, 'bulkSetFavorite').mockResolvedValue(2);

      await useScreenshotStore.getState().bulkSetFavorite(['sc_1', 'sc_3'], true);

      const state = useScreenshotStore.getState();
      expect(state.screenshots.find((s) => s.id === 'sc_1')?.isFavorite).toBe(true);
      expect(state.screenshots.find((s) => s.id === 'sc_3')?.isFavorite).toBe(true);
      expect(state.favorites).toHaveLength(3);
    });

    it('bulkSoftDelete removes items from active screenshots list', async () => {
      jest.spyOn(recycleBinService, 'bulkSoftDelete').mockResolvedValue(2);
      jest.spyOn(recycleBinService, 'getDeletedScreenshots').mockResolvedValue([
        createMockScreenshot('sc_1'),
        createMockScreenshot('sc_2'),
      ]);

      await useScreenshotStore.getState().bulkSoftDelete(['sc_1', 'sc_2']);

      const state = useScreenshotStore.getState();
      expect(state.screenshots).toHaveLength(1);
      expect(state.screenshots[0].id).toBe('sc_3');
      expect(state.recycleBinScreenshots).toHaveLength(2);
    });
  });
});

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(() => 'light'),
    StyleSheet: {
      create: (styles: any) => styles,
      hairlineWidth: 1,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android ?? obj.default,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 400, height: 800 })),
    },
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    TouchableOpacity: 'TouchableOpacity',
    ActivityIndicator: 'ActivityIndicator',
    FlatList: 'FlatList',
    RefreshControl: 'RefreshControl',
    Alert: { alert: jest.fn() },
  };
});

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
import { recycleBinService } from '../services/recycleBinService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

describe('ContextVault Sprint P1-5 — Recycle Bin Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useScreenshotStore.setState({
      screenshots: [],
      recycleBinScreenshots: [],
      favorites: [],
      needsReviewList: [],
    });
  });

  describe('1. Soft Delete Deliverable', () => {
    it('marks a screenshot as soft-deleted in SQLite without dropping the row', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);
      jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);

      await recycleBinService.softDeleteScreenshot('sc_receipt_01');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'UPDATE screenshots SET is_deleted = 1, deleted_at = ? WHERE id = ?',
        [expect.any(String), 'sc_receipt_01']
      );
    });

    it('excludes soft-deleted screenshots from standard repository queries', async () => {
      const executeQuerySpy = jest
        .spyOn(databaseService, 'executeQuery')
        .mockResolvedValue([]);

      // 1. getAllScreenshots
      await screenshotRepository.getAllScreenshots();
      expect(executeQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining('(is_deleted = 0 OR is_deleted IS NULL)'),
        expect.any(Array)
      );

      // 2. getScreenshotsByCategoryId
      await screenshotRepository.getScreenshotsByCategoryId('cat_finance');
      expect(executeQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining('(is_deleted = 0 OR is_deleted IS NULL)'),
        ['cat_finance']
      );

      // 3. getNeedsReviewCount
      await screenshotRepository.getNeedsReviewCount();
      expect(executeQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining('(is_deleted = 0 OR is_deleted IS NULL)')
      );
    });

    it('excludes soft-deleted screenshots from category counts', async () => {
      const executeQuerySpy = jest
        .spyOn(databaseService, 'executeQuery')
        .mockResolvedValue([{ count: 0 }]);
      jest.spyOn(categoryRepository, 'getDescendantCategoryIds').mockResolvedValue(['cat_work']);

      await categoryRepository.updateScreenshotCount('cat_work');
      expect(executeQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining('(is_deleted = 0 OR is_deleted IS NULL)'),
        ['cat_work']
      );

      await categoryRepository.getUnsortedCount();
      expect(executeQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining('(is_deleted = 0 OR is_deleted IS NULL)')
      );
    });

    it('softDeleteScreenshot action in useScreenshotStore removes item locally and reloads recycle bin', async () => {
      const mockActive: ScreenshotModel = {
        id: 'sc_active_1',
        deviceAssetId: 'asset_1',
        filePath: '/test/photo.png',
        fileName: 'photo.png',
        createdAt: '2026-09-01T10:00:00Z',
        width: 1080,
        height: 2400,
        fileSize: 1024,
        categoryId: 'cat_work',
        categoryName: 'Work',
        subcategory: '',
        confidence: 0.9,
        isFavorite: true,
        isReviewed: true,
        isSynced: true,
        ocrStatus: 'completed',
        tags: [],
      };

      useScreenshotStore.setState({
        screenshots: [mockActive],
        favorites: [mockActive],
        recycleBinScreenshots: [],
      });

      jest.spyOn(recycleBinService, 'softDeleteScreenshot').mockResolvedValue(undefined);
      jest.spyOn(recycleBinService, 'getDeletedScreenshots').mockResolvedValue([
        { ...mockActive, isDeleted: true, deletedAt: new Date().toISOString() },
      ]);

      await useScreenshotStore.getState().softDeleteScreenshot('sc_active_1');

      // Should be removed from active screenshots and favorites
      expect(useScreenshotStore.getState().screenshots.length).toBe(0);
      expect(useScreenshotStore.getState().favorites.length).toBe(0);
      // Should be in recycle bin screenshots
      expect(useScreenshotStore.getState().recycleBinScreenshots.length).toBe(1);
      expect(useScreenshotStore.getState().recycleBinScreenshots[0].id).toBe('sc_active_1');
    });
  });

  describe('2. Restore Deliverable', () => {
    it('restores a soft-deleted screenshot by resetting is_deleted and deleted_at', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);
      jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);

      await recycleBinService.restoreScreenshot('sc_restore_01');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'UPDATE screenshots SET is_deleted = 0, deleted_at = NULL WHERE id = ?',
        ['sc_restore_01']
      );
    });

    it('restores all soft-deleted screenshots at once via restoreAll', async () => {
      jest.spyOn(screenshotRepository, 'restoreAllScreenshots').mockResolvedValue(4);
      jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);

      const count = await recycleBinService.restoreAll();
      expect(count).toBe(4);
    });

    it('restoreScreenshot in useScreenshotStore reloads screenshots and recycle bin', async () => {
      const mockDeleted: ScreenshotModel = {
        id: 'sc_del_1',
        deviceAssetId: 'asset_del',
        filePath: '/test/del.png',
        fileName: 'del.png',
        createdAt: '2026-09-01T10:00:00Z',
        width: 1080,
        height: 2400,
        fileSize: 1024,
        categoryId: 'cat_work',
        categoryName: 'Work',
        subcategory: '',
        confidence: 0.9,
        isFavorite: false,
        isReviewed: true,
        isSynced: true,
        ocrStatus: 'completed',
        isDeleted: true,
        deletedAt: '2026-09-02T10:00:00Z',
        tags: [],
      };

      useScreenshotStore.setState({
        screenshots: [],
        recycleBinScreenshots: [mockDeleted],
      });

      jest.spyOn(recycleBinService, 'restoreScreenshot').mockResolvedValue(undefined);
      jest.spyOn(screenshotRepository, 'getAllScreenshots').mockResolvedValue([
        { ...mockDeleted, isDeleted: false, deletedAt: undefined },
      ]);
      jest.spyOn(recycleBinService, 'getDeletedScreenshots').mockResolvedValue([]);

      await useScreenshotStore.getState().restoreScreenshot('sc_del_1');

      expect(useScreenshotStore.getState().screenshots.length).toBe(1);
      expect(useScreenshotStore.getState().recycleBinScreenshots.length).toBe(0);
    });
  });

  describe('3. Permanent Delete Deliverable', () => {
    it('permanently removes metadata row, associated tags, and OCR cache from SQLite', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);
      jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);

      await recycleBinService.permanentDelete('sc_hard_delete_01');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM screenshot_tags WHERE screenshot_id = ?',
        ['sc_hard_delete_01']
      );
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM ocr_cache WHERE screenshot_id = ?',
        ['sc_hard_delete_01']
      );
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM screenshots WHERE id = ?',
        ['sc_hard_delete_01']
      );
    });

    it('empties entire recycle bin by purging all is_deleted = 1 records', async () => {
      const executeQuerySpy = jest
        .spyOn(databaseService, 'executeQuery')
        .mockResolvedValue([{ id: 'sc_1' }, { id: 'sc_2' }, { id: 'sc_3' }]);
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);
      jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);

      const count = await recycleBinService.emptyRecycleBin();

      expect(count).toBe(3);
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM screenshots WHERE is_deleted = 1'
      );
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM screenshot_tags WHERE screenshot_id IN (SELECT id FROM screenshots WHERE is_deleted = 1)'
      );
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM ocr_cache WHERE screenshot_id IN (SELECT id FROM screenshots WHERE is_deleted = 1)'
      );
    });
  });

  describe('4. Relative Time & Retention Helpers', () => {
    it('formats deleted age in human-friendly relative format', () => {
      const now = new Date();
      expect(recycleBinService.formatDeletedAge(now.toISOString())).toBe('Deleted just now');

      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
      expect(recycleBinService.formatDeletedAge(threeHoursAgo)).toBe('Deleted 3h ago');

      const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
      expect(recycleBinService.formatDeletedAge(yesterday)).toBe('Deleted yesterday');

      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(recycleBinService.formatDeletedAge(fiveDaysAgo)).toBe('Deleted 5 days ago');

      expect(recycleBinService.formatDeletedAge(undefined)).toBe('Deleted recently');
    });

    it('computes days remaining in 30-day retention window', () => {
      const now = new Date().toISOString();
      expect(recycleBinService.getRetentionDaysRemaining(now, 30)).toBe(30);

      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      expect(recycleBinService.getRetentionDaysRemaining(tenDaysAgo, 30)).toBe(20);
    });
  });
});

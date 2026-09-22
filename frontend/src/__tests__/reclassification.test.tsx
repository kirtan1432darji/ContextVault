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
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Alert: {
    alert: jest.fn(),
  },
}));

import { databaseService } from '../database';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { smartFolderService } from '../services/SmartFolderService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

const createMockScreenshot = (
  id: string,
  categoryId = 'unsorted',
  confidence = 0.55,
  isReviewed = false
): ScreenshotModel => ({
  id,
  deviceAssetId: `asset_${id}`,
  filePath: `file:///storage/emulated/0/Pictures/Screenshots/${id}.jpg`,
  fileName: `${id}.jpg`,
  fileSize: 2048,
  width: 1080,
  height: 2400,
  createdAt: '2026-09-12T00:00:00Z',
  categoryId,
  categoryName: categoryId === 'unsorted' ? 'Unsorted' : 'Finance',
  subcategory: 'Pending',
  confidence,
  isAutoCategorized: true,
  isFavorite: false,
  isReviewed,
  isSynced: false,
  ocrStatus: 'completed',
  tags: [],
  keywords: ['old_tag'],
});

describe('ContextVault Sprint P2-4 — Manual AI Reclassification Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
    jest.spyOn(categoryRepository, 'getCategoryById').mockImplementation(async (id: string) => {
      if (id === 'cat_work') return { id: 'cat_work', name: 'Work' } as any;
      if (id === 'cat_personal') return { id: 'cat_personal', name: 'Personal' } as any;
      if (id === 'cat_finance') return { id: 'cat_finance', name: 'Finance' } as any;
      return null;
    });
    jest.spyOn(categoryRepository, 'updateScreenshotCount').mockResolvedValue(undefined as any);
    jest.spyOn(categoryRepository, 'getAllCategories').mockResolvedValue([]);

    useScreenshotStore.setState({
      screenshots: [
        createMockScreenshot('sc_review_1', 'unsorted', 0.55, false),
        createMockScreenshot('sc_review_2', 'cat_finance', 0.62, false),
        createMockScreenshot('sc_normal_3', 'cat_work', 0.95, true),
      ],
      favorites: [],
      needsReviewList: [
        createMockScreenshot('sc_review_1', 'unsorted', 0.55, false),
        createMockScreenshot('sc_review_2', 'cat_finance', 0.62, false),
      ],
      selectedScreenshot: null,
    });
  });

  describe('1. SQLite Repository Layer (screenshotRepository.reclassifyScreenshot)', () => {
    it('executes UPDATE query marking classification_source=manual, confidence=1.0, is_auto_categorized=0, and is_reviewed=1', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await screenshotRepository.reclassifyScreenshot(
        'sc_review_1',
        'cat_work',
        'Work',
        'Tax Returns',
        ['taxes', 'irs', '2025'],
        ['Work', 'Tax Returns']
      );

      expect(executeCommandSpy).toHaveBeenCalledTimes(1);
      const sql = executeCommandSpy.mock.calls[0][0];
      const params = executeCommandSpy.mock.calls[0][1];

      expect(sql).toContain('UPDATE screenshots SET');
      expect(sql).toContain('category_id = ?');
      expect(sql).toContain('confidence = 1.0');
      expect(sql).toContain('is_auto_categorized = 0');
      expect(sql).toContain('is_reviewed = 1');
      expect(sql).toContain("classification_source = 'manual'");
      expect(sql).toContain('folder_path = ?');

      expect(params).toEqual([
        'cat_work',
        'Work',
        'Tax Returns',
        JSON.stringify(['taxes', 'irs', '2025']),
        JSON.stringify(['Work', 'Tax Returns']),
        'sc_review_1',
      ]);
    });
  });

  describe('2. SmartFolderService.reclassifyScreenshot', () => {
    it('overrides classification, updates store and clears screenshot from needsReviewList', async () => {
      const mockExisting = createMockScreenshot('sc_review_1', 'unsorted', 0.55, false);
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue(mockExisting);
      jest.spyOn(screenshotRepository, 'reclassifyScreenshot').mockResolvedValue(undefined);

      // Verify it is in needsReviewList before
      expect(
        useScreenshotStore.getState().needsReviewList.some((s) => s.id === 'sc_review_1')
      ).toBe(true);

      const result = await smartFolderService.reclassifyScreenshot({
        screenshotId: 'sc_review_1',
        targetCategoryId: 'cat_work',
        targetSubcategory: 'Contracts',
        tags: ['vendor', 'sla'],
      });

      expect(result).not.toBeNull();
      expect(result?.categoryId).toBe('cat_work');
      expect(result?.categoryName).toBe('Work');
      expect(result?.subcategory).toBe('Contracts');
      expect(result?.confidence).toBe(1.0);
      expect(result?.isAutoCategorized).toBe(false);
      expect(result?.isReviewed).toBe(true);
      expect(result?.classificationSource).toBe('manual');
      expect(result?.keywords).toEqual(['vendor', 'sla']);

      // Verify category counts updated
      expect(categoryRepository.updateScreenshotCount).toHaveBeenCalledWith('cat_work');
      expect(categoryRepository.updateScreenshotCount).toHaveBeenCalledWith('unsorted');

      // Verify in-memory store updated and screenshot cleared from needsReviewList
      const storeScreenshots = useScreenshotStore.getState().screenshots;
      const updatedInStore = storeScreenshots.find((s) => s.id === 'sc_review_1');
      expect(updatedInStore?.categoryId).toBe('cat_work');
      expect(updatedInStore?.isReviewed).toBe(true);
      expect(updatedInStore?.confidence).toBe(1.0);

      const needsReview = useScreenshotStore.getState().needsReviewList;
      expect(needsReview.some((s) => s.id === 'sc_review_1')).toBe(false);
    });

    it('gracefully returns null if target category does not exist', async () => {
      const result = await smartFolderService.reclassifyScreenshot({
        screenshotId: 'sc_review_1',
        targetCategoryId: 'cat_non_existent',
      });

      expect(result).toBeNull();
    });

    it('preserves non-destructive guarantee by leaving filePath unmodified', async () => {
      const mockExisting = createMockScreenshot('sc_review_2', 'cat_finance', 0.62, false);
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue(mockExisting);
      jest.spyOn(screenshotRepository, 'reclassifyScreenshot').mockResolvedValue(undefined);

      const initialPath = mockExisting.filePath;
      const result = await smartFolderService.reclassifyScreenshot({
        screenshotId: 'sc_review_2',
        targetCategoryId: 'cat_personal',
        targetSubcategory: 'Health',
      });

      expect(result?.filePath).toBe(initialPath);
    });
  });
});

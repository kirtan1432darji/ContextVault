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
    ScrollView: 'ScrollView',
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
import { categoryRepository } from '../database/repositories/categoryRepository';
import {
  storageManagerService,
  StorageBreakdown,
  DuplicateDetectionResult,
} from '../services/storageManagerService';

describe('ContextVault Sprint P1-4 — Storage Manager Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Screenshot Count Deliverable', () => {
    it('calculates comprehensive screenshot metrics and categorizations', async () => {
      // Mock PRAGMA queries
      jest.spyOn(databaseService, 'executeQuery').mockImplementation(async (sql: string) => {
        if (sql.includes('PRAGMA page_count')) return [{ page_count: 512 }];
        if (sql.includes('PRAGMA page_size')) return [{ page_size: 4096 }];
        if (sql.includes('FROM ocr_cache')) return [{ count: 25, bytes: 48000 }];
        if (sql.includes('FROM recent_searches')) return [{ count: 12, bytes: 1400 }];
        if (sql.includes('FROM chat_history')) return [{ count: 8, bytes: 9600 }];
        if (sql.includes('FROM screenshots')) {
          return [
            {
              total_count: 50,
              categorized_count: 42,
              unsorted_count: 8,
              favorites_count: 15,
              needs_review_count: 5,
              total_file_size: 104857600, // ~100MB
            },
          ];
        }
        if (sql.includes('FROM pending_screenshots')) {
          return [{ total_count: 6, completed_count: 4 }];
        }
        return [];
      });

      const breakdown = await storageManagerService.getStorageBreakdown();

      expect(breakdown.screenshotRecordCount).toBe(50);
      expect(breakdown.categorizedCount).toBe(42);
      expect(breakdown.unsortedCount).toBe(8);
      expect(breakdown.favoritesCount).toBe(15);
      expect(breakdown.needsReviewCount).toBe(5);
      expect(breakdown.pendingScreenshotCount).toBe(6);
      expect(breakdown.completedPendingCount).toBe(4);
      expect(breakdown.totalDeviceScreenshotBytes).toBe(104857600);
    });

    it('returns zero defaults when database contains zero screenshots', async () => {
      jest.spyOn(databaseService, 'executeQuery').mockImplementation(async (sql: string) => {
        if (sql.includes('PRAGMA page_count')) return [{ page_count: 100 }];
        if (sql.includes('PRAGMA page_size')) return [{ page_size: 4096 }];
        if (sql.includes('FROM screenshots')) {
          return [
            {
              total_count: 0,
              categorized_count: 0,
              unsorted_count: 0,
              favorites_count: 0,
              needs_review_count: 0,
              total_file_size: 0,
            },
          ];
        }
        return [{ count: 0, bytes: 0 }];
      });

      const breakdown = await storageManagerService.getStorageBreakdown();
      expect(breakdown.screenshotRecordCount).toBe(0);
      expect(breakdown.categorizedCount).toBe(0);
      expect(breakdown.unsortedCount).toBe(0);
      expect(breakdown.favoritesCount).toBe(0);
      expect(breakdown.totalDeviceScreenshotBytes).toBe(0);
    });
  });

  describe('2. Storage Usage Deliverable', () => {
    it('calculates database file size using SQLite PRAGMA page_count * page_size', async () => {
      jest.spyOn(databaseService, 'executeQuery').mockImplementation(async (sql: string) => {
        if (sql.includes('PRAGMA page_count')) return [{ page_count: 1024 }];
        if (sql.includes('PRAGMA page_size')) return [{ page_size: 4096 }];
        return [{ count: 0, bytes: 0 }];
      });

      const breakdown = await storageManagerService.getStorageBreakdown();
      expect(breakdown.databaseSizeBytes).toBe(1024 * 4096); // 4 MB
      expect(breakdown.totalBytes).toBeGreaterThanOrEqual(1024 * 4096);
    });

    it('calculates OCR cache, search history, and chat history sizes', async () => {
      jest.spyOn(databaseService, 'executeQuery').mockImplementation(async (sql: string) => {
        if (sql.includes('PRAGMA')) return [{ page_count: 100, page_size: 4096 }];
        if (sql.includes('FROM ocr_cache')) return [{ count: 18, bytes: 72000 }];
        if (sql.includes('FROM recent_searches')) return [{ count: 10, bytes: 1200 }];
        if (sql.includes('FROM chat_history')) return [{ count: 6, bytes: 5400 }];
        return [];
      });

      const breakdown = await storageManagerService.getStorageBreakdown();
      expect(breakdown.ocrCacheCount).toBe(18);
      expect(breakdown.ocrCacheBytes).toBe(72000);
      expect(breakdown.searchCacheCount).toBe(10);
      expect(breakdown.searchCacheBytes).toBe(1200);
      expect(breakdown.chatHistoryCount).toBe(6);
      expect(breakdown.chatHistoryBytes).toBe(5400);
    });

    it('formats raw bytes into human-readable strings (B, KB, MB, GB)', () => {
      expect(storageManagerService.formatBytes(0)).toBe('0 B');
      expect(storageManagerService.formatBytes(-50)).toBe('0 B');
      expect(storageManagerService.formatBytes(512)).toBe('512 B');
      expect(storageManagerService.formatBytes(2048)).toBe('2.0 KB');
      expect(storageManagerService.formatBytes(1572864)).toBe('1.5 MB');
      expect(storageManagerService.formatBytes(1073741824)).toBe('1.0 GB');
    });
  });

  describe('3. Duplicate Detection Deliverable', () => {
    it('detects duplicate screenshots matching exact file size and dimensions', async () => {
      const mockScreenshots = [
        {
          id: 'sc_1',
          device_asset_id: 'asset_1',
          file_path: '/path/receipt1.png',
          file_name: 'receipt1.png',
          created_at: '2026-09-01T10:00:00Z',
          width: 1080,
          height: 2400,
          file_size: 1500000,
          category_id: 'cat_finance',
          category_name: 'Finance',
          confidence: 0.95,
        },
        {
          id: 'sc_2',
          device_asset_id: 'asset_2',
          file_path: '/path/receipt1_copy.png',
          file_name: 'receipt1_copy.png',
          created_at: '2026-09-01T11:00:00Z',
          width: 1080,
          height: 2400,
          file_size: 1500000, // Exact same size & dimensions
          category_id: 'cat_finance',
          category_name: 'Finance',
          confidence: 0.95,
        },
        {
          id: 'sc_3',
          device_asset_id: 'asset_3',
          file_path: '/path/unique_code.png',
          file_name: 'unique_code.png',
          created_at: '2026-09-02T10:00:00Z',
          width: 1440,
          height: 3120,
          file_size: 2800000,
          category_id: 'cat_code',
          category_name: 'Code',
          confidence: 0.88,
        },
      ];

      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue(mockScreenshots);

      const result = await storageManagerService.findDuplicates();

      expect(result.groups.length).toBe(1);
      expect(result.totalDuplicates).toBe(1);
      expect(result.reclaimableBytes).toBe(1500000);
      expect(result.groups[0].matchReason).toBe('Exact Dimensions & Size');
      expect(result.groups[0].original.id).toBe('sc_1'); // Earliest created
      expect(result.groups[0].duplicates[0].id).toBe('sc_2');
    });

    it('detects duplicate screenshots matching identical file name', async () => {
      const mockScreenshots = [
        {
          id: 'sc_a',
          file_path: '/path1/slack_message.png',
          file_name: 'slack_message.png',
          created_at: '2026-08-15T08:00:00Z',
          width: 1080,
          height: 2400,
          file_size: 0, // Unset file size, but identical filename
          category_id: 'cat_work',
          category_name: 'Work',
        },
        {
          id: 'sc_b',
          file_path: '/path2/slack_message.png',
          file_name: 'slack_message.png',
          created_at: '2026-08-16T08:00:00Z',
          width: 1080,
          height: 2400,
          file_size: 0,
          category_id: 'cat_work',
          category_name: 'Work',
        },
      ];

      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue(mockScreenshots);

      const result = await storageManagerService.findDuplicates();

      expect(result.groups.length).toBe(1);
      expect(result.groups[0].matchReason).toBe('Identical File Name');
      expect(result.groups[0].original.id).toBe('sc_a');
      expect(result.groups[0].duplicates[0].id).toBe('sc_b');
      expect(result.totalDuplicates).toBe(1);
    });

    it('detects duplicate screenshots matching substantial OCR text content', async () => {
      const longText = 'TOTAL DUE: $128.45 INVOICE # 98412 PAID VIA VISA ENDING 4321 THANK YOU FOR YOUR BUSINESS';
      const mockScreenshots = [
        {
          id: 'sc_ocr1',
          file_path: '/path/inv1.png',
          file_name: 'invoice_alpha.png',
          created_at: '2026-08-20T09:00:00Z',
          width: 1080,
          height: 2340,
          file_size: 800000,
          ocr_text: longText,
          category_id: 'cat_finance',
          category_name: 'Finance',
        },
        {
          id: 'sc_ocr2',
          file_path: '/path/inv2.png',
          file_name: 'invoice_beta.png', // Different filename & size
          created_at: '2026-08-21T09:00:00Z',
          width: 1080,
          height: 2340,
          file_size: 850000,
          ocr_text: longText + ' EXTRA FOOTER', // Substantial matching prefix
          category_id: 'cat_finance',
          category_name: 'Finance',
        },
      ];

      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue(mockScreenshots);

      const result = await storageManagerService.findDuplicates();

      expect(result.groups.length).toBe(1);
      expect(result.groups[0].matchReason).toBe('Matching OCR Content');
      expect(result.groups[0].original.id).toBe('sc_ocr1');
      expect(result.groups[0].duplicates[0].id).toBe('sc_ocr2');
    });

    it('unindexes duplicate screenshot records from database via cleanDuplicates', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);
      const recalculateSpy = jest
        .spyOn(categoryRepository, 'recalculateAllCounts')
        .mockResolvedValue(undefined as any);

      const cleaned = await storageManagerService.cleanDuplicates(['dup_1', 'dup_2']);

      expect(cleaned).toBe(2);
      expect(executeCommandSpy).toHaveBeenCalledWith('DELETE FROM screenshots WHERE id = ?;', ['dup_1']);
      expect(executeCommandSpy).toHaveBeenCalledWith('DELETE FROM screenshot_tags WHERE screenshot_id = ?;', ['dup_1']);
      expect(executeCommandSpy).toHaveBeenCalledWith('DELETE FROM ocr_cache WHERE screenshot_id = ?;', ['dup_1']);
      expect(executeCommandSpy).toHaveBeenCalledWith('DELETE FROM screenshots WHERE id = ?;', ['dup_2']);
      expect(recalculateSpy).toHaveBeenCalled();
    });
  });

  describe('4. Cleanup Recommendations Deliverable', () => {
    it('generates prioritized recommendations when duplicates and caches exist', () => {
      const mockBreakdown: StorageBreakdown = {
        totalBytes: 5000000,
        databaseSizeBytes: 2000000, // 2MB
        ocrCacheBytes: 800000, // 800KB
        ocrCacheCount: 45,
        searchCacheBytes: 3000,
        searchCacheCount: 15,
        chatHistoryBytes: 12000,
        chatHistoryCount: 10,
        screenshotRecordCount: 60,
        categorizedCount: 50,
        unsortedCount: 10,
        favoritesCount: 12,
        needsReviewCount: 4,
        pendingScreenshotCount: 5,
        completedPendingCount: 5,
        totalDeviceScreenshotBytes: 150000000,
        memoryThumbnailBytes: 100000,
      };

      const mockDuplicates: DuplicateDetectionResult = {
        groups: [
          {
            id: 'g1',
            key: 'k1',
            matchReason: 'Exact Dimensions & Size',
            original: { id: 'orig' } as any,
            duplicates: [{ id: 'dup1' } as any, { id: 'dup2' } as any],
            reclaimableBytes: 3000000,
          },
        ],
        totalDuplicates: 2,
        reclaimableBytes: 3000000,
      };

      const recs = storageManagerService.getCleanupRecommendations(mockBreakdown, mockDuplicates);

      expect(recs.length).toBeGreaterThanOrEqual(4);

      // Duplicates rec
      const dupRec = recs.find((r) => r.type === 'duplicates');
      expect(dupRec).toBeDefined();
      expect(dupRec?.severity).toBe('high');
      expect(dupRec?.actionLabel).toBe('Clean Duplicates');

      // OCR rec
      const ocrRec = recs.find((r) => r.type === 'ocr_cache');
      expect(ocrRec).toBeDefined();
      expect(ocrRec?.severity).toBe('high');

      // VACUUM rec
      const vacRec = recs.find((r) => r.type === 'database_vacuum');
      expect(vacRec).toBeDefined();

      // Pending queue rec
      const pendRec = recs.find((r) => r.type === 'pending_queue');
      expect(pendRec).toBeDefined();
    });

    it('executes one-tap quick clean batch optimization', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);
      jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);

      const result = await storageManagerService.executeQuickClean(['dup_x']);

      expect(result.duplicatesCleaned).toBe(1);
      expect(result.ocrCleared).toBe(true);
      expect(result.pendingCleaned).toBe(true);
      expect(result.vacuumed).toBe(true);

      // Verify vacuum and cache clearing were called
      expect(executeCommandSpy).toHaveBeenCalledWith('DELETE FROM ocr_cache;');
      expect(executeCommandSpy).toHaveBeenCalledWith('VACUUM;');
    });
  });

  describe('5. Component Cache Operations', () => {
    it('clears OCR cache table on demand', async () => {
      const spy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
      await storageManagerService.clearOCRCache();
      expect(spy).toHaveBeenCalledWith('DELETE FROM ocr_cache;');
    });

    it('clears search history table on demand', async () => {
      const spy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
      await storageManagerService.clearSearchCache();
      expect(spy).toHaveBeenCalledWith('DELETE FROM recent_searches;');
    });

    it('clears chat history table on demand', async () => {
      const spy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
      await storageManagerService.clearChatHistory();
      expect(spy).toHaveBeenCalledWith('DELETE FROM chat_history;');
    });

    it('clears completed pending screenshots on demand', async () => {
      const spy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
      await storageManagerService.clearCompletedPending();
      expect(spy).toHaveBeenCalledWith(
        "DELETE FROM pending_screenshots WHERE status = 'Completed' AND id IN (SELECT id FROM screenshots);"
      );
    });

    it('executes SQLite VACUUM command', async () => {
      const spy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
      await storageManagerService.vacuumDatabase();
      expect(spy).toHaveBeenCalledWith('VACUUM;');
    });
  });
});

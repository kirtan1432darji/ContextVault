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
import { categoryRepository } from '../database/repositories/categoryRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { visionRepository } from '../database/repositories/VisionRepository';
import { SmartFolderRules, CANONICAL_CATEGORIES } from '../services/smartFolders/SmartFolderRules';
import { SmartFolderTagExtractor } from '../services/smartFolders/SmartFolderTagExtractor';
import { smartFolderClassificationService } from '../services/SmartFolderClassificationService';
import { searchService } from '../services/searchService';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { ScreenshotModel } from '../models';

const createMockScreenshot = (
  id: string,
  categoryId = 'unsorted',
  confidence = 0.5,
  isAutoCategorized = true,
  classificationSource: 'local' | 'vision_ai' | 'manual' = 'local',
  extra: Partial<ScreenshotModel> = {}
): ScreenshotModel => ({
  id,
  deviceAssetId: `asset_${id}`,
  filePath: `file:///storage/emulated/0/Pictures/Screenshots/${id}.jpg`,
  localPath: `file:///storage/emulated/0/Pictures/Screenshots/${id}.jpg`,
  fileName: `${id}.jpg`,
  fileSize: 2048,
  width: 1080,
  height: 2400,
  createdAt: '2026-09-18T10:00:00Z',
  createdOn: '2026-09-18T10:00:00Z',
  categoryId,
  folderId: categoryId,
  categoryName: categoryId === 'unsorted' ? 'Unsorted' : categoryId,
  subcategory: 'General',
  confidence,
  isAutoCategorized,
  isFavorite: false,
  isReviewed: false,
  isSynced: false,
  ocrStatus: 'completed',
  ocrText: '',
  keywords: [],
  tags: [],
  classificationSource,
  ...extra,
});

describe('Sprint P2-A — Smart Folder Classification Engine Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default DB and repository spies
    jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
    jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([]);
    jest.spyOn(screenshotRepository, 'insertScreenshot').mockResolvedValue(undefined as any);
    jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue(null);
    jest.spyOn(screenshotRepository, 'updateScreenshot').mockResolvedValue(undefined as any);
    jest.spyOn(categoryRepository, 'createNestedCategoryHierarchy').mockImplementation(
      async (hierarchy: string[], icon?: string, color?: string) => {
        const leaf = hierarchy[hierarchy.length - 1];
        const catId = leaf.toLowerCase().replace(/\s+/g, '_');
        return {
          id: catId,
          name: leaf,
          iconName: icon || 'folder-outline',
          colorHex: color || '#6366F1',
          screenshotCount: 1,
          isSystem: false,
          orderIndex: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    );
    jest.spyOn(categoryRepository, 'updateAllAncestorCounts').mockResolvedValue(undefined as any);
    jest.spyOn(categoryRepository, 'getAllCategories').mockResolvedValue([]);
    jest.spyOn(visionRepository, 'getVisionResult').mockResolvedValue(null);

    // Reset Zustand stores
    useScreenshotStore.setState({
      screenshots: [],
      favorites: [],
      needsReviewList: [],
      selectedScreenshot: null,
    });
    useCategoryStore.setState({
      categories: [],
      selectedCategoryId: null,
      folderStats: {},
    });
  });

  // ===========================================================================
  // 1. Canonical 13 Categories Definition
  // ===========================================================================
  describe('1. Canonical Categories Config', () => {
    it('defines exactly the 13 canonical categories', () => {
      const keys = Object.keys(CANONICAL_CATEGORIES);
      expect(keys.length).toBe(13);
      const expected = [
        'finance',
        'shopping',
        'food_delivery',
        'travel',
        'chats',
        'documents',
        'health',
        'education',
        'work',
        'social_media',
        'entertainment',
        'utilities',
        'other',
      ];
      expected.forEach((cat) => {
        expect(keys).toContain(cat);
      });
    });

    it('each category config has valid metadata and keywords', () => {
      Object.values(CANONICAL_CATEGORIES).forEach((cfg) => {
        expect(cfg.id).toBeDefined();
        expect(cfg.name).toBeDefined();
        expect(cfg.icon).toBeDefined();
        expect(cfg.color).toBeDefined();
        if (cfg.id !== 'other') {
          expect(cfg.keywords.length).toBeGreaterThan(0);
          expect(cfg.entities.length).toBeGreaterThan(0);
        }
      });
    });
  });

  // ===========================================================================
  // 2. Deterministic 5-Tier Rule Engine
  // ===========================================================================
  describe('2. Deterministic 5-Tier Classification Rules', () => {
    it('Tier 1 (Vision AI): maps vision screen_type and summary with high confidence', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'screenshot_01.jpg',
        visionMetadata: {
          screen_type: 'Finance / UPI Receipt',
          category: 'Finance',
          summary: 'UPI payment of Rs 550 to Swiggy',
          confidence: 0.95,
        },
      });

      expect(result.categoryId).toBe('finance');
      expect(result.matchedTier).toBe('vision');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('Tier 1 (Vision AI): correctly maps food delivery from vision summary', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'order_done.png',
        visionMetadata: {
          screen_type: 'Food Order Receipt',
          category: 'Food Delivery',
          summary: 'Order details for restaurant meal delivery on Swiggy',
          confidence: 0.9,
        },
      });

      expect(result.categoryId).toBe('food_delivery');
      expect(result.matchedTier).toBe('vision');
    });

    it('Tier 2 (Entity Matching): matches Swiggy entity to food_delivery with 0.94 confidence', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'scr_100.png',
        ocrText: 'Payment successful on Swiggy Instamart Order #554',
      });

      expect(result.categoryId).toBe('food_delivery');
      expect(result.subcategory).toBe('Swiggy');
      expect(result.matchedTier).toBe('entity');
      expect(result.confidence).toBe(0.94);
    });

    it('Tier 2 (Entity Matching): matches Indigo flight entity to travel', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'ticket.png',
        ocrText: 'IndiGo Boarding Pass Seat 14B DEL to BLR',
      });

      expect(result.categoryId).toBe('travel');
      expect(result.subcategory).toBe('IndiGo');
      expect(result.matchedTier).toBe('entity');
    });

    it('Tier 2 (Entity Matching): matches Aadhaar to documents', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'my_id.png',
        ocrText: 'Unique Identification Authority of India Aadhaar Mera Aadhaar Meri Pehchan',
      });

      expect(result.categoryId).toBe('documents');
      expect(result.subcategory).toBe('Aadhaar');
      expect(result.matchedTier).toBe('entity');
    });

    it('Tier 3 (OCR Keyword Scoring): classifies finance based on heavy finance keywords', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'screen.png',
        ocrText: 'Txn reference 9923812838 debited from your account via UPI reference id 99283 successful',
      });

      expect(result.categoryId).toBe('finance');
      expect(result.matchedTier).toBe('ocr');
      expect(result.confidence).toBeGreaterThanOrEqual(0.72);
    });

    it('Tier 3 (OCR Keyword Scoring): classifies health based on medical terminology', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'scan_doc.png',
        ocrText: 'Prescription dosage 500mg tablet twice daily after clinic doctor consultation',
      });

      expect(result.categoryId).toBe('health');
      expect(result.matchedTier).toBe('ocr');
    });

    it('Tier 4 (Android App Signatures): detects WhatsApp package to chats with 0.90 confidence', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'chat_export.png',
        sourceApp: 'com.whatsapp',
      });

      expect(result.categoryId).toBe('chats');
      expect(result.matchedTier).toBe('app');
      expect(result.confidence).toBe(0.9);
    });

    it('Tier 4 (Android App Signatures): detects Amazon package to shopping', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'product.png',
        detectedApp: 'in.amazon.mShop.android.shopping',
      });

      expect(result.categoryId).toBe('shopping');
      expect(result.matchedTier).toBe('app');
    });

    it('Tier 5 (Filename Heuristics): classifies based on filename keywords', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'boarding_pass_delhi.png',
      });

      expect(result.categoryId).toBe('travel');
      expect(result.matchedTier).toBe('filename');
      expect(result.confidence).toBe(0.75);
    });

    it('Fallback: unmatched content defaults to other with 0.50 confidence', () => {
      const result = SmartFolderRules.evaluateRules({
        fileName: 'random_wallpaper_xyz.jpg',
        ocrText: '',
      });

      expect(result.categoryId).toBe('other');
      expect(result.categoryName).toBe('Other');
      expect(result.matchedTier).toBe('fallback');
      expect(result.confidence).toBe(0.5);
    });
  });

  // ===========================================================================
  // 3. SmartFolderTagExtractor
  // ===========================================================================
  describe('3. SmartFolderTagExtractor', () => {
    it('extracts Indian amounts, dates, PNR, flight codes, UPI IDs, and filters stop words', () => {
      const tags = SmartFolderTagExtractor.extractTags({
        ocrText:
          'Paid ₹550.00 to merchant@okhdfcbank on 18/09/2026. IRCTC PNR 2839182910 confirmed on flight 6E521. Order #9812739211.',
        visionMetadata: {
          tags: ['receipt', 'upi_payment'],
          entities: {
            merchant: 'Swiggy',
            currency: 'INR',
          },
        },
      });

      expect(tags).toContain('₹550.00');
      expect(tags).toContain('18/09/2026');
      expect(tags).toContain('pnr_2839182910');
      expect(tags).toContain('6e521');
      expect(tags).toContain('merchant@okhdfcbank');
      expect(tags).toContain('swiggy');
      expect(tags).toContain('receipt');

      // Check stop words are filtered
      expect(tags).not.toContain('the');
      expect(tags).not.toContain('and');
      expect(tags).not.toContain('for');
      expect(tags).not.toContain('with');
    });

    it('handles null, undefined and noisy input gracefully', () => {
      const tags = SmartFolderTagExtractor.extractTags({
        ocrText: '   --- ### !!!   ',
        visionMetadata: undefined,
      });

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBe(0);
    });
  });

  // ===========================================================================
  // 4. SmartFolderClassificationService & Manual Override Protection
  // ===========================================================================
  describe('4. SmartFolderClassificationService (SQLite + Manual Overrides)', () => {
    it('assigns screenshot to smart folder and updates SQLite repository', async () => {
      const insertSpy = jest.spyOn(screenshotRepository, 'insertScreenshot');
      const ancestorSpy = jest.spyOn(categoryRepository, 'updateAllAncestorCounts');

      const result = await smartFolderClassificationService.assignScreenshotToSmartFolder({
        screenshotId: 'sc_test_101',
        fileName: 'swiggy_receipt.jpg',
        filePath: 'file:///data/swiggy_receipt.jpg',
        ocrText: 'Paid ₹240 to Swiggy on 12/09/2026 via UPI',
      });

      expect(result.id).toBe('sc_test_101');
      expect(result.categoryId).toBe('swiggy');
      expect(result.subcategory).toBe('Swiggy');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(ancestorSpy).toHaveBeenCalledTimes(1);

      // Verify screenshot added to store
      const storeSc = useScreenshotStore.getState().screenshots;
      expect(storeSc.some((s) => s.id === 'sc_test_101')).toBe(true);
    });

    it('CRITICAL: Never overwrites manual classification unless forceRefresh is true', async () => {
      const existingManual = createMockScreenshot(
        'sc_manual_1',
        'documents',
        1.0,
        false,
        'manual'
      );
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue(existingManual);
      const insertSpy = jest.spyOn(screenshotRepository, 'insertScreenshot');

      // Attempt automated assignment with finance OCR text
      const result = await smartFolderClassificationService.assignScreenshotToSmartFolder({
        screenshotId: 'sc_manual_1',
        fileName: 'sc_manual_1.jpg',
        filePath: 'file:///path.jpg',
        ocrText: 'Paid ₹550 to Swiggy via Google Pay UPI reference 992831',
        forceRefresh: false,
      });

      // Must remain 'documents'
      expect(result.categoryId).toBe('documents');
      expect(result.classificationSource).toBe('manual');
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('Overwrites manual classification when forceRefresh is true (e.g. user requested restore)', async () => {
      const existingManual = createMockScreenshot(
        'sc_manual_2',
        'documents',
        1.0,
        false,
        'manual'
      );
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue(existingManual);
      const insertSpy = jest.spyOn(screenshotRepository, 'insertScreenshot');

      const result = await smartFolderClassificationService.assignScreenshotToSmartFolder({
        screenshotId: 'sc_manual_2',
        fileName: 'sc_manual_2.jpg',
        filePath: 'file:///path.jpg',
        ocrText: 'Paid ₹550 to Swiggy for food delivery reference 992831',
        forceRefresh: true,
      });

      expect(result.subcategory).toBe('Swiggy');
      expect(insertSpy).toHaveBeenCalledTimes(1);
    });

    it('Batch classifies screenshots sequentially (Concurrency = 1) and skips manual overrides', async () => {
      const items = [
        createMockScreenshot('sc_b1', 'unsorted', 0.5, true, 'local', {
          ocrText: 'Flight ticket booking IndiGo 6E201',
          fileName: 'b1.jpg',
        }),
        createMockScreenshot('sc_b2', 'work', 1.0, false, 'manual', {
          ocrText: 'Swiggy order bill ₹450',
          fileName: 'b2.jpg',
        }),
        createMockScreenshot('sc_b3', 'unsorted', 0.5, true, 'local', {
          ocrText: 'Prescription doctor hospital medicine 100mg',
          fileName: 'b3.jpg',
        }),
      ];

      const progressLog: { processed: number; total: number }[] = [];
      const batchResult = await smartFolderClassificationService.classifyBatch(items, {
        onProgress: (p, t) => progressLog.push({ processed: p, total: t }),
      });

      expect(batchResult.processed).toBe(3);
      // b1 (travel) and b3 (health) moved, b2 (manual) was skipped
      expect(batchResult.moved).toBe(2);
      expect(progressLog.length).toBe(3);
    });

    it('Batch classification respects shouldCancel abort signal', async () => {
      const items = [
        createMockScreenshot('sc_c1', 'unsorted', 0.5, true, 'local', {
          ocrText: 'Flight ticket booking IndiGo 6E201',
        }),
        createMockScreenshot('sc_c2', 'unsorted', 0.5, true, 'local', {
          ocrText: 'Swiggy order bill ₹450',
        }),
      ];

      let calls = 0;
      const batchResult = await smartFolderClassificationService.classifyBatch(items, {
        shouldCancel: () => {
          calls++;
          return calls > 1; // cancel after first item
        },
      });

      expect(batchResult.processed).toBe(1);
    });
  });

  // ===========================================================================
  // 5. Multi-Parameter Search Filtering (searchService.searchWithFilters)
  // ===========================================================================
  describe('5. SearchService: Multi-Parameter Filtering', () => {
    it('executes SQLite query with multiple parameters when DB is available', async () => {
      const executeQuerySpy = jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        {
          id: 'sc_q1',
          device_asset_id: 'a1',
          file_path: '/path.jpg',
          file_name: 'swiggy_receipt.jpg',
          category_id: 'food_delivery',
          category_name: 'Food Delivery',
          subcategory: 'Swiggy',
          confidence: 0.95,
          keywords_json: JSON.stringify(['swiggy', '₹550', 'food']),
          created_at: '2026-09-18T10:00:00Z',
        },
      ]);

      const result = await searchService.searchWithFilters({
        folderId: 'food_delivery',
        favorite: false,
        minConfidence: 90,
        merchant: 'Swiggy',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.data!.length).toBe(1);
      expect(result.data![0].id).toBe('sc_q1');

      const sqlCall = executeQuerySpy.mock.calls[0];
      const sqlQuery = sqlCall[0];
      expect(sqlQuery).toContain('category_id = ? OR folder_id = ?');
      expect(sqlQuery).toContain('is_favorite = ?');
      expect(sqlQuery).toContain('confidence >= ?');
      expect(sqlQuery).toContain('created_at >= ?');
      expect(sqlQuery).toContain('created_at <= ?');
      expect(sqlQuery).toContain('LOWER(subcategory) LIKE ?');
    });

    it('falls back to in-memory filtering when databaseService throws', async () => {
      jest.spyOn(databaseService, 'executeQuery').mockRejectedValue(new Error('DB offline'));

      useScreenshotStore.setState({
        screenshots: [
          createMockScreenshot('sc_mem_1', 'food_delivery', 0.95, true, 'vision_ai', {
            subcategory: 'Swiggy',
            keywords: ['swiggy', '₹550'],
            isFavorite: true,
          }),
          createMockScreenshot('sc_mem_2', 'finance', 0.88, true, 'local', {
            subcategory: 'HDFC',
            keywords: ['hdfc', 'bank'],
            isFavorite: false,
          }),
          createMockScreenshot('sc_mem_3', 'food_delivery', 0.65, true, 'local', {
            subcategory: 'Zomato',
            keywords: ['zomato', '₹120'],
            isFavorite: true,
          }),
        ],
      });

      const result = await searchService.searchWithFilters({
        folderId: 'food_delivery',
        favorite: true,
        minConfidence: 90,
      });

      expect(result.isSuccess).toBe(true);
      expect(result.data!.length).toBe(1);
      expect(result.data![0].id).toBe('sc_mem_1');
    });
  });
});

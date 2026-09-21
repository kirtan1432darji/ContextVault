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
  Image: 'Image',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  Modal: 'Modal',
  TextInput: 'TextInput',
  Alert: {
    alert: jest.fn(),
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  NativeModules: {
    OCRRecognitionModule: {
      recognizeText: jest.fn(),
    },
    SQLite: {
      open: jest.fn(),
    },
  },
}));

jest.mock('react-native-sqlite-storage', () => ({
  enablePromise: jest.fn(),
  openDatabase: jest.fn().mockResolvedValue({
    executeSql: jest.fn().mockResolvedValue([
      { rows: { length: 0, item: () => ({}) }, rowsAffected: 0 },
    ]),
    transaction: jest.fn(),
    close: jest.fn(),
  }),
}));

jest.mock('../services/OCRQueueService', () => ({
  ocrQueueService: {
    enqueue: jest.fn(),
    resumePendingOnStartup: jest.fn().mockResolvedValue(0),
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
      surfaceVariant: '#F1F3F4',
    },
  }),
}));

import { databaseService } from '../database';
import { queueRepository } from '../database/repositories/QueueRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { pendingScreenshotRepository } from '../database/repositories/pendingScreenshotRepository';
import { ocrCacheRepository } from '../database/repositories/ocrCacheRepository';
import { visionRepository } from '../database/repositories/VisionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { ocrService } from '../services/ocrService';
import { visionAIService } from '../services/visionAIService';
import { smartFolderClassificationService } from '../services/SmartFolderClassificationService';
import {
  aiProcessingQueue,
  backgroundAIWorker,
  PRIORITY_WEIGHTS,
  QueueItem,
  QueuePriority,
  QueueEvent,
} from '../services/background';
import { screenshotListenerService } from '../services/ScreenshotListenerService';
import { mediaStoreService } from '../services/mediaStoreService';
import { recycleBinService } from '../services/recycleBinService';
import { Result } from '../utils/result';

describe('ContextVault Sprint P5-A — Background AI Processing Queue Suite', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    backgroundAIWorker.stop();
    backgroundAIWorker.reset();
  });

  describe('1. Priority Hierarchy & Weights', () => {
    it('defines strict priority weight order: Critical (4) > High (3) > Medium (2) > Low (1)', () => {
      expect(PRIORITY_WEIGHTS.critical).toBe(4);
      expect(PRIORITY_WEIGHTS.high).toBe(3);
      expect(PRIORITY_WEIGHTS.medium).toBe(2);
      expect(PRIORITY_WEIGHTS.low).toBe(1);

      expect(PRIORITY_WEIGHTS.critical).toBeGreaterThan(PRIORITY_WEIGHTS.high);
      expect(PRIORITY_WEIGHTS.high).toBeGreaterThan(PRIORITY_WEIGHTS.medium);
      expect(PRIORITY_WEIGHTS.medium).toBeGreaterThan(PRIORITY_WEIGHTS.low);
    });

    it('enqueues screenshot with correct priority weight in analysis_queue', async () => {
      jest.spyOn(databaseService, 'executeCommand').mockResolvedValue(undefined as any);
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([]);

      const item = await queueRepository.enqueue('sc_user_action', 'critical');

      expect(item.screenshotId).toBe('sc_user_action');
      expect(item.priority).toBe('critical');
      expect(item.priorityOrder).toBe(4);
      expect(item.state).toBe('pending');
    });

    it('retrieves next pending item strictly ordered by priority_order DESC, queued_at ASC', async () => {
      const executeQuerySpy = jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        {
          id: 'aq_critical_1',
          screenshot_id: 'sc_pay_1',
          state: 'pending',
          priority: 'critical',
          priority_order: 4,
          queued_at: '2026-09-18T12:00:00Z',
          retry_count: 0,
          processing_time_ms: 0,
          file_name: 'GPay_500.png',
        },
      ]);

      const next = await queueRepository.getNextPending();

      expect(next).not.toBeNull();
      expect(next?.priority).toBe('critical');
      expect(next?.priorityOrder).toBe(4);
      expect(executeQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY q.priority_order DESC, q.queued_at ASC')
      );
    });

    it('elevates priority to critical when bumpPriority is commanded', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await queueRepository.bumpPriority('aq_123', 'critical');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE analysis_queue'),
        ['critical', 4, 'aq_123', 'aq_123']
      );
    });
  });

  describe('2. Strict Concurrency = 1 Execution Loop', () => {
    it('worker ensures strictly one item is active at a time', async () => {
      const mockItem: QueueItem = {
        id: 'aq_test_concurrency',
        screenshotId: 'sc_test_1',
        state: 'pending',
        priority: 'high',
        priorityOrder: 3,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        processingTimeMs: 0,
        fileName: 'screenshot_1.jpg',
      };

      let pendingReturns = [mockItem, null];
      jest.spyOn(queueRepository, 'getNextPending').mockImplementation(async () => {
        return pendingReturns.shift() || null;
      });
      jest.spyOn(queueRepository, 'updateState').mockResolvedValue(undefined);
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue({
        id: 'sc_test_1',
        deviceAssetId: '1',
        filePath: '/path/1.jpg',
        localPath: '/path/1.jpg',
        fileName: 'screenshot_1.jpg',
        categoryId: 'unsorted',
        categoryName: 'Unsorted',
        createdAt: '2026-09-18T10:00:00Z',
      } as any);

      // Cached OCR & Vision to make step fast
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        { extracted_text: 'PhonePe paid ₹500' },
      ]);
      jest.spyOn(visionRepository, 'getVisionResult').mockResolvedValue({
        id: 'vr_1',
        screenshot_id: 'sc_test_1',
        screen_type: 'payment',
        confidence: 0.95,
      } as any);
      jest.spyOn(smartFolderClassificationService, 'assignScreenshotToSmartFolder').mockResolvedValue({
        id: 'sc_test_1',
        categoryName: 'Finance',
      } as any);
      jest.spyOn(screenshotRepository, 'getAllScreenshots').mockResolvedValue([]);

      const startPromise1 = backgroundAIWorker.start();
      const startPromise2 = backgroundAIWorker.start(); // Redundant second invocation

      await Promise.all([startPromise1, startPromise2]);

      // Worker should have completed cleanly without spawning multiple loops
      expect(backgroundAIWorker.isWorkerActive()).toBe(false);
      expect(queueRepository.updateState).toHaveBeenCalledWith(
        'aq_test_concurrency',
        'completed',
        null,
        expect.any(Number)
      );
    });
  });

  describe('3. Cache-First Skipping Policy', () => {
    it('skips OCR extraction when ocr_cache already has extracted text', async () => {
      const mockItem: QueueItem = {
        id: 'aq_ocr_cache',
        screenshotId: 'sc_cached_ocr',
        state: 'pending',
        priority: 'high',
        priorityOrder: 3,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        processingTimeMs: 0,
        fileName: 'Invoice.jpg',
      };

      let pendingItems = [mockItem, null];
      jest.spyOn(queueRepository, 'getNextPending').mockImplementation(async () => pendingItems.shift() || null);
      jest.spyOn(queueRepository, 'updateState').mockResolvedValue(undefined);
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue({
        id: 'sc_cached_ocr',
        filePath: '/path/Invoice.jpg',
        fileName: 'Invoice.jpg',
      } as any);

      // Simulate existing OCR in cache
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        { extracted_text: 'Already extracted bill receipt' },
      ]);
      const ocrExtractSpy = jest.spyOn(ocrService, 'extractText');

      // Simulate existing Vision in cache
      jest.spyOn(visionRepository, 'getVisionResult').mockResolvedValue({
        id: 'vr_cached',
        screen_type: 'receipt',
      } as any);
      const visionAnalyzeSpy = jest.spyOn(visionAIService, 'analyzeScreenshot');

      jest.spyOn(smartFolderClassificationService, 'assignScreenshotToSmartFolder').mockResolvedValue({
        id: 'sc_cached_ocr',
        categoryName: 'Shopping',
      } as any);
      jest.spyOn(screenshotRepository, 'getAllScreenshots').mockResolvedValue([]);

      await backgroundAIWorker.start();

      // ML Kit OCR must be SKIPPED!
      expect(ocrExtractSpy).not.toHaveBeenCalled();
      // Local Vision AI must be SKIPPED!
      expect(visionAnalyzeSpy).not.toHaveBeenCalled();
      // Smart folder assignment receives cached text
      expect(smartFolderClassificationService.assignScreenshotToSmartFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshotId: 'sc_cached_ocr',
          ocrText: 'Already extracted bill receipt',
        })
      );
    });

    it('extracts OCR and invokes Vision AI when caches are missing', async () => {
      const mockItem: QueueItem = {
        id: 'aq_fresh_run',
        screenshotId: 'sc_fresh',
        state: 'pending',
        priority: 'medium',
        priorityOrder: 2,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        processingTimeMs: 0,
        fileName: 'fresh_receipt.png',
      };

      let pendingItems = [mockItem, null];
      jest.spyOn(queueRepository, 'getNextPending').mockImplementation(async () => pendingItems.shift() || null);
      jest.spyOn(queueRepository, 'updateState').mockResolvedValue(undefined);
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue({
        id: 'sc_fresh',
        filePath: '/path/fresh_receipt.png',
        fileName: 'fresh_receipt.png',
      } as any);

      // Missing OCR cache
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([]);
      const ocrExtractSpy = jest.spyOn(ocrService, 'extractText').mockResolvedValue(
        Result.success({
          id: 'ocr_new',
          screenshotId: 'sc_fresh',
          rawText: 'Swiggy order #9872',
          normalizedText: 'swiggy order 9872',
          confidence: 0.96,
          language: 'en',
          ocrVersion: 'MLKit-Text-16.0.0',
          processingTimeMs: 120,
          blocks: [],
          processedAt: new Date().toISOString(),
        })
      );
      jest.spyOn(ocrCacheRepository, 'insertOCRCache').mockResolvedValue(undefined);

      // Missing Vision cache
      jest.spyOn(visionRepository, 'getVisionResult').mockResolvedValue(null);
      jest.spyOn(visionAIService, 'pingVisionServer').mockResolvedValue({
        online: true,
        latencyMs: 15,
        status: 'healthy',
      });
      const visionAnalyzeSpy = jest.spyOn(visionAIService, 'analyzeScreenshot').mockResolvedValue({
        isSuccess: true,
        data: {
          id: 'vis_1',
          screenshotId: 'sc_fresh',
          scene: { screenType: 'food_order' },
          processingTimeMs: 850,
          provider: 'local',
        } as any,
      });

      jest.spyOn(smartFolderClassificationService, 'assignScreenshotToSmartFolder').mockResolvedValue({
        id: 'sc_fresh',
        categoryName: 'Food Delivery',
      } as any);
      jest.spyOn(screenshotRepository, 'getAllScreenshots').mockResolvedValue([]);

      await backgroundAIWorker.start();

      // Both OCR and Vision were called
      expect(ocrExtractSpy).toHaveBeenCalledWith('sc_fresh', '/path/fresh_receipt.png');
      expect(ocrCacheRepository.insertOCRCache).toHaveBeenCalled();
      expect(visionAnalyzeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshotId: 'sc_fresh',
          ocrText: 'Swiggy order #9872',
        })
      );
    });
  });

  describe('4. Auto-Enqueue Integration Triggers', () => {
    it('ScreenshotListenerService auto-enqueues newly detected screenshot with High priority', async () => {
      const enqueueSpy = jest.spyOn(aiProcessingQueue, 'enqueue').mockResolvedValue({
        id: 'aq_new_1',
        screenshotId: 'sc_new_1',
        priority: 'high',
      } as any);

      jest.spyOn(pendingScreenshotRepository, 'isDuplicate').mockResolvedValue(false);
      jest.spyOn(pendingScreenshotRepository, 'insertPending').mockResolvedValue(undefined);
      jest.spyOn(screenshotListenerService, 'refreshStoreCounts').mockResolvedValue(undefined as any);

      const uniqueAsset = `asset_${Date.now()}`;
      await screenshotListenerService.handleDetectedScreenshot({
        filePath: `/storage/emulated/0/DCIM/Screenshots/${uniqueAsset}.jpg`,
        deviceAssetId: uniqueAsset,
        fileName: `${uniqueAsset}.jpg`,
      });

      expect(enqueueSpy).toHaveBeenCalledWith(expect.any(String), 'high');
    });

    it('MediaStoreService enqueues newly discovered screenshots with Medium priority', async () => {
      const enqueueBatchSpy = jest
        .spyOn(aiProcessingQueue, 'enqueueBatch')
        .mockResolvedValue(2);

      jest.spyOn(mediaStoreService, 'checkAndRequestPermissions').mockResolvedValue(true);
      jest.spyOn(mediaStoreService, 'queryDeviceScreenshots').mockResolvedValue([
        { filePath: '/DCIM/sc_1.png', fileName: 'sc_1.png', deviceAssetId: '101' },
        { filePath: '/DCIM/sc_2.png', fileName: 'sc_2.png', deviceAssetId: '102' },
      ]);
      jest.spyOn(screenshotRepository, 'hasScreenshot').mockResolvedValue(false);
      jest.spyOn(screenshotRepository, 'insertScreenshot').mockResolvedValue(undefined);
      jest.spyOn(pendingScreenshotRepository, 'insertPending').mockResolvedValue(undefined);
      jest.spyOn(categoryRepository, 'updateAllAncestorCounts').mockResolvedValue(undefined as any);
      jest.spyOn(screenshotRepository, 'getAllScreenshots').mockResolvedValue([]);

      const result = await mediaStoreService.scanAndSyncScreenshots(50);

      expect(result.added).toBe(2);
      expect(enqueueBatchSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(String)]),
        'medium'
      );
    });

    it('RecycleBinService enqueues restored screenshots with High priority', async () => {
      const enqueueSpy = jest.spyOn(aiProcessingQueue, 'enqueue').mockResolvedValue({} as any);
      const enqueueBatchSpy = jest.spyOn(aiProcessingQueue, 'enqueueBatch').mockResolvedValue(1);

      jest.spyOn(screenshotRepository, 'restoreScreenshot').mockResolvedValue(undefined);
      jest.spyOn(categoryRepository, 'recalculateAllCounts').mockResolvedValue(undefined as any);
      jest.spyOn(screenshotRepository, 'getDeletedScreenshots').mockResolvedValue([
        { id: 'sc_restored_1' } as any,
      ]);
      jest.spyOn(screenshotRepository, 'restoreAllScreenshots').mockResolvedValue(1);

      await recycleBinService.restoreScreenshot('sc_restored_1');
      expect(enqueueSpy).toHaveBeenCalledWith('sc_restored_1', 'high');

      await recycleBinService.restoreAll();
      expect(enqueueBatchSpy).toHaveBeenCalledWith(['sc_restored_1'], 'high');
    });
  });

  describe('5. Queue Controls & Lifecycle', () => {
    it('pauses and resumes background worker cleanly', () => {
      expect(aiProcessingQueue.isPaused()).toBe(false);

      aiProcessingQueue.pause();
      expect(aiProcessingQueue.isPaused()).toBe(true);

      const workerStartSpy = jest.spyOn(backgroundAIWorker, 'start').mockResolvedValue(undefined as any);
      aiProcessingQueue.resume();
      expect(aiProcessingQueue.isPaused()).toBe(false);
      expect(workerStartSpy).toHaveBeenCalled();
    });

    it('retries failed queue items and triggers worker', async () => {
      jest.spyOn(queueRepository, 'retryFailed').mockResolvedValue(3);
      const workerStartSpy = jest.spyOn(backgroundAIWorker, 'start').mockResolvedValue(undefined);

      const count = await aiProcessingQueue.retryFailed();

      expect(count).toBe(3);
      expect(workerStartSpy).toHaveBeenCalled();
    });

    it('cancels pending queue item without affecting completed ones', async () => {
      jest.spyOn(queueRepository, 'cancelItem').mockResolvedValue(true);

      const cancelled = await aiProcessingQueue.cancelItem('aq_pending_item');
      expect(cancelled).toBe(true);
      expect(queueRepository.cancelItem).toHaveBeenCalledWith('aq_pending_item');
    });

    it('clears completed items from SQLite', async () => {
      jest.spyOn(queueRepository, 'clearCompleted').mockResolvedValue(5);

      const cleared = await aiProcessingQueue.clearCompleted();
      expect(cleared).toBe(5);
      expect(queueRepository.clearCompleted).toHaveBeenCalled();
    });
  });

  describe('6. Error Resilience & Offline Mode', () => {
    it('gracefully handles offline Local Vision AI Server without crashing', async () => {
      const mockItem: QueueItem = {
        id: 'aq_offline_test',
        screenshotId: 'sc_offline',
        state: 'pending',
        priority: 'high',
        priorityOrder: 3,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        processingTimeMs: 0,
        fileName: 'screenshot_offline.png',
      };

      let pendingItems = [mockItem, null];
      jest.spyOn(queueRepository, 'getNextPending').mockImplementation(async () => pendingItems.shift() || null);
      const updateStateSpy = jest.spyOn(queueRepository, 'updateState').mockResolvedValue(undefined);
      jest.spyOn(screenshotRepository, 'getScreenshotById').mockResolvedValue({
        id: 'sc_offline',
        filePath: '/path/offline.png',
        fileName: 'screenshot_offline.png',
      } as any);

      // OCR succeeds
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        { extracted_text: 'Text content' },
      ]);
      // Vision cache missing
      jest.spyOn(visionRepository, 'getVisionResult').mockResolvedValue(null);
      // Vision server OFFLINE!
      jest.spyOn(visionAIService, 'pingVisionServer').mockResolvedValue({
        online: false,
        latencyMs: 50,
        status: 'offline',
        error: 'Network unreachable',
      });

      const events: QueueEvent[] = [];
      const unsub = backgroundAIWorker.addListener((ev) => events.push(ev));

      await backgroundAIWorker.start();
      unsub();

      // Item marked failed with descriptive error
      expect(updateStateSpy).toHaveBeenCalledWith(
        'aq_offline_test',
        'failed',
        expect.stringContaining('Local Vision AI Server is offline'),
        expect.any(Number)
      );

      const failedEvent = events.find((e) => e.type === 'item_failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.error).toContain('offline');
    });
  });

  describe('7. Aggregated Queue Stats', () => {
    it('aggregates pending, processing, completed, and failed counts accurately', async () => {
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        {
          total: 15,
          pending: 5,
          processing: 1,
          completed: 7,
          failed: 2,
          cancelled: 0,
          avg_time: 420,
        },
      ]);

      const stats = await aiProcessingQueue.getStats();

      expect(stats.total).toBe(15);
      expect(stats.pending).toBe(5);
      expect(stats.processing).toBe(1);
      expect(stats.completed).toBe(7);
      expect(stats.failed).toBe(2);
      expect(stats.averageProcessingTimeMs).toBe(420);
    });
  });
});

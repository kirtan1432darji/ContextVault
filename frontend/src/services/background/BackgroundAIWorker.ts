import { queueRepository } from '../../database/repositories/QueueRepository';
import { screenshotRepository } from '../../database/repositories/screenshotRepository';
import { pendingScreenshotRepository } from '../../database/repositories/pendingScreenshotRepository';
import { ocrCacheRepository } from '../../database/repositories/ocrCacheRepository';
import { visionRepository } from '../../database/repositories/VisionRepository';
import { categoryRepository } from '../../database/repositories/categoryRepository';
import { databaseService } from '../../database';
import { ocrService } from '../ocrService';
import { visionAIService } from '../visionAIService';
import { smartFolderClassificationService } from '../SmartFolderClassificationService';
import { memoryTimelineService } from '../memory/MemoryTimelineService';
import { loggerService } from '../loggerService';
import { useScreenshotStore } from '../../store/screenshot.store';
import { useCategoryStore } from '../../store/category.store';
import { useFolderContextStore } from '../../store/folderContext.store';
import {
  QueueEvent,
  QueueEventListener,
  QueueItem,
  QueueStats,
} from './types';

export class BackgroundAIWorker {
  private static instance: BackgroundAIWorker | null = null;
  private isProcessing = false;
  private isPaused = false;
  private currentItem: QueueItem | null = null;
  private listeners: Set<QueueEventListener> = new Set();
  private isShuttingDown = false;

  static getInstance(): BackgroundAIWorker {
    if (!BackgroundAIWorker.instance) {
      BackgroundAIWorker.instance = new BackgroundAIWorker();
    }
    return BackgroundAIWorker.instance;
  }

  addListener(listener: QueueEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: QueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('[BackgroundAIWorker] Listener notification failed:', err);
      }
    }
  }

  isWorkerPaused(): boolean {
    return this.isPaused;
  }

  isWorkerActive(): boolean {
    return this.isProcessing;
  }

  getCurrentItem(): QueueItem | null {
    return this.currentItem;
  }

  pause(): void {
    this.isPaused = true;
    loggerService.info('AIQueue', 'Background AI Worker paused.');
    this.emit({
      type: 'queue_paused',
      timestamp: new Date().toISOString(),
    });
  }

  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      loggerService.info('AIQueue', 'Background AI Worker resumed.');
      this.emit({
        type: 'queue_resumed',
        timestamp: new Date().toISOString(),
      });
      this.start();
    }
  }

  reset(): void {
    this.isShuttingDown = false;
    this.isProcessing = false;
    this.isPaused = false;
    this.currentItem = null;
  }

  stop(): void {
    this.isShuttingDown = true;
    this.isProcessing = false;
    this.currentItem = null;
  }

  /**
   * Starts the sequential processing loop (Concurrency = 1).
   * Safe to call multiple times; will not spawn duplicate workers.
   */
  async start(): Promise<void> {
    if (this.isProcessing || this.isPaused) {
      return;
    }

    this.isShuttingDown = false;
    this.isProcessing = true;

    try {
      while (!this.isPaused && !this.isShuttingDown) {
        const nextItem = await queueRepository.getNextPending();
        if (!nextItem) {
          // No more pending items
          break;
        }

        await this.processItem(nextItem);

        // Yield to JS thread for 60ms between heavy tasks to preserve 60fps UI
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    } catch (loopErr) {
      loggerService.error('AIQueue', 'Unexpected error in queue loop', loopErr);
    } finally {
      this.isProcessing = false;
      this.currentItem = null;
    }
  }

  /**
   * Processes a single screenshot through the 9-step pipeline.
   * Concurrency is strictly 1.
   */
  private async processItem(item: QueueItem): Promise<void> {
    const startTime = Date.now();
    this.currentItem = item;

    // 1. Mark item as processing in SQLite
    await queueRepository.updateState(item.id, 'processing');
    item.state = 'processing';
    item.startedAt = new Date().toISOString();

    this.emit({
      type: 'item_started',
      item,
      step: 'Validating screenshot metadata',
      timestamp: new Date().toISOString(),
    });

    try {
      // 2. Fetch Screenshot metadata
      let screenshot = await screenshotRepository.getScreenshotById(item.screenshotId);
      let pendingScreenshot = null;

      if (!screenshot) {
        pendingScreenshot = await pendingScreenshotRepository.getById(item.screenshotId);
      }

      const filePath = screenshot?.localPath || screenshot?.filePath || pendingScreenshot?.localPath || pendingScreenshot?.filePath;
      const fileName = screenshot?.fileName || pendingScreenshot?.fileName || item.fileName || 'Screenshot';

      if (!filePath) {
        throw new Error(`Screenshot path missing for ID ${item.screenshotId}`);
      }

      // 3. Step: OCR Text Check (Cache-First)
      this.emit({
        type: 'item_progress',
        item,
        step: 'Checking OCR cache',
        timestamp: new Date().toISOString(),
      });

      let ocrText: string | undefined = undefined;

      try {
        const ocrRows = await databaseService.executeQuery(
          `SELECT extracted_text FROM ocr_cache WHERE screenshot_id = ?`,
          [item.screenshotId]
        );
        if (ocrRows && ocrRows.length > 0 && ocrRows[0].extracted_text) {
          ocrText = ocrRows[0].extracted_text;
          loggerService.info('AIQueue', `Reused cached OCR for ${fileName}`);
        }
      } catch (ocrCheckErr) {
        loggerService.warn('AIQueue', 'Error reading ocr_cache:', ocrCheckErr);
      }

      // If not cached, perform ML Kit OCR extraction
      if (!ocrText) {
        this.emit({
          type: 'item_progress',
          item,
          step: 'Extracting text via ML Kit OCR',
          timestamp: new Date().toISOString(),
        });

        const ocrStartTime = Date.now();
        const ocrResult = await ocrService.extractText(item.screenshotId, filePath);

        if (ocrResult.isSuccess && ocrResult.data) {
          ocrText = ocrResult.data.rawText;
          const ocrDuration = ocrResult.data.processingTimeMs || (Date.now() - ocrStartTime);

          // Cache OCR result
          await ocrCacheRepository.insertOCRCache({
            id: ocrResult.data.id,
            screenshotId: item.screenshotId,
            extractedText: ocrText,
            normalizedText: ocrResult.data.normalizedText,
            processingTime: ocrDuration,
            language: ocrResult.data.language,
            ocrVersion: ocrResult.data.ocrVersion,
            confidence: ocrResult.data.confidence,
            blocksJson: JSON.stringify(ocrResult.data.blocks || []),
            createdOn: ocrResult.data.processedAt,
          });

          // Update pending table if exists
          if (pendingScreenshot) {
            await pendingScreenshotRepository.updateOCRResult(
              item.screenshotId,
              'Completed',
              ocrText,
              ocrDuration
            );
          }
        }
      }

      // 4. Step: Vision AI Check (Cache-First)
      this.emit({
        type: 'item_progress',
        item,
        step: 'Checking Vision AI cache',
        timestamp: new Date().toISOString(),
      });

      let visionCached = false;
      try {
        const cachedVision = await visionRepository.getVisionResult(item.screenshotId);
        if (cachedVision) {
          visionCached = true;
          loggerService.info('AIQueue', `Reused cached Vision AI for ${fileName}`);
        }
      } catch (vErr) {
        loggerService.warn('AIQueue', 'Error reading vision cache:', vErr);
      }

      // If not cached, query Local Vision AI Server (RTX 4050) if reachable
      if (!visionCached) {
        const ping = await visionAIService.pingVisionServer();
        if (ping.online) {
          this.emit({
            type: 'item_progress',
            item,
            step: 'Running Local Vision AI inference (RTX 4050)',
            timestamp: new Date().toISOString(),
          });

          const visionResult = await visionAIService.analyzeScreenshot({
            screenshotId: item.screenshotId,
            filePath,
            fileName,
            ocrText,
          });

          if (!visionResult.isSuccess) {
            loggerService.warn('AIQueue', `Vision AI inference returned non-success: ${visionResult.error}`);
          }
        } else {
          throw new Error(`Local Vision AI Server is offline: ${ping.error || ping.status || 'Connection failed'}`);
        }
      }

      // 5. Step: Smart Folder 5-Tier Classification & Auto-Organize
      this.emit({
        type: 'item_progress',
        item,
        step: 'Organizing into Smart Folders & generating tags',
        timestamp: new Date().toISOString(),
      });

      const updatedScreenshot = await smartFolderClassificationService.assignScreenshotToSmartFolder({
        screenshotId: item.screenshotId,
        fileName,
        filePath,
        localPath: screenshot?.localPath || pendingScreenshot?.localPath || filePath,
        contentUri: screenshot?.contentUri || pendingScreenshot?.contentUri,
        thumbnailUri: screenshot?.thumbnailUri || pendingScreenshot?.thumbnailUri,
        ocrText,
        fileSize: screenshot?.fileSize || pendingScreenshot?.fileSize,
        deviceFolder: screenshot?.categoryName || pendingScreenshot?.deviceFolder,
      });

      // Update Memory Timeline
      try {
        await memoryTimelineService.addScreenshotToTimeline(updatedScreenshot);
      } catch (timelineErr) {
        loggerService.warn('AIQueue', 'Error updating memory timeline:', timelineErr);
      }

      // 6. Step: Complete Queue Item in SQLite
      const processingDuration = Date.now() - startTime;
      await queueRepository.updateState(item.id, 'completed', null, processingDuration);

      item.state = 'completed';
      item.finishedAt = new Date().toISOString();
      item.processingTimeMs = processingDuration;

      // 7. Refresh global Zustand stores
      try {
        const all = await screenshotRepository.getAllScreenshots();
        useScreenshotStore.getState().setScreenshots(all);
        await categoryRepository.recalculateAllCounts();
        await useCategoryStore.getState().loadCategories();
        const syncedToday = useFolderContextStore.getState().aiSyncedToday;
        useFolderContextStore.getState().setAiSyncedToday(syncedToday + 1);
      } catch (storeErr) {
        loggerService.warn('AIQueue', 'Error refreshing stores after job:', storeErr);
      }

      loggerService.info(
        'AIQueue',
        `Completed pipeline for ${fileName} in ${processingDuration}ms (Folder: ${updatedScreenshot.categoryName})`
      );

      this.emit({
        type: 'item_completed',
        item,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown processing error';
      loggerService.error('AIQueue', `Failed processing ${item.screenshotId}: ${errorMessage}`, err);

      const processingDuration = Date.now() - startTime;
      await queueRepository.updateState(item.id, 'failed', errorMessage, processingDuration);

      item.state = 'failed';
      item.errorMessage = errorMessage;
      item.finishedAt = new Date().toISOString();
      item.processingTimeMs = processingDuration;

      this.emit({
        type: 'item_failed',
        item,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.currentItem = null;
    }
  }
}

export const backgroundAIWorker = BackgroundAIWorker.getInstance();

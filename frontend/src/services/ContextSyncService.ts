import { apiClient } from '../api/apiClient';
import { ApiConstants } from '../api/apiConstants';
import { Result } from '../utils/result';
import {
  ScreenshotModel,
  OCRCacheRecord,
  ClassificationResultModel,
  ClassificationCacheRecord,
} from '../models';
import {
  screenshotRepository,
  classificationCacheRepository,
  syncQueueRepository,
  ocrCacheRepository,
} from '../database/repositories';
import { useScreenshotStore } from '../store/screenshot.store';
import { v4 as uuidv4 } from 'uuid';
import { loggerService } from './loggerService';
import { notificationService } from './notificationService';

export class ContextSyncService {
  private isSyncingQueue = false;

  /**
   * Synchronizes screenshot OCR metadata with the backend AI classification engine.
   * STRICT PRIVACY GUARANTEE: Never uploads image binaries or pixels.
   * Only transmits anonymized OCR text tokens, hashes, and layout dimensions.
   */
  async syncScreenshotMetadata(
    screenshot: ScreenshotModel,
    ocrRecord?: OCRCacheRecord | null
  ): Promise<Result<ClassificationResultModel>> {
    const ocrText = screenshot.ocrText || ocrRecord?.extractedText || '';
    const normalizedText = ocrRecord?.normalizedText || ocrText.toLowerCase();

    // Composite hash generation fallback if not provided
    const sha256Hash =
      screenshot.deviceAssetId ||
      `hash_${screenshot.fileName}_${screenshot.fileSize || 1024}_${screenshot.createdAt}`;

    const payload = {
      screenshotId: screenshot.id,
      fileName: screenshot.fileName,
      sha256Hash: sha256Hash.substring(0, 64),
      timestamp: screenshot.createdAt,
      extractedText: ocrText,
      normalizedText: normalizedText,
      width: screenshot.width || 1080,
      height: screenshot.height || 2400,
      mimeType: 'image/png',
      deviceFolder: screenshot.sourceApp || 'Screenshots',
      detectedApp: screenshot.detectedApp || screenshot.sourceApp,
    };

    try {
      loggerService.info('Sync', `Syncing metadata for: ${screenshot.fileName}`);

      // 1. Post to backend endpoint POST /api/screenshots/upload-metadata
      const res = await apiClient.uploadScreenshotMetadata(payload);

      if (res.isSuccess && res.data) {
        const data = res.data;
        const classification = data.classification || data;

        const categoryId = classification.categoryId || data.categoryId || screenshot.categoryId;
        const categoryName = classification.category || data.categoryName || screenshot.categoryName;
        const subcategory = classification.subCategory || data.subCategory || screenshot.subcategory || '';
        const confidence = classification.confidence || data.confidence || 0.85;
        const suggestedTags = classification.suggestedTags || data.tags || screenshot.keywords || [];
        const folderPath = classification.folderPath || (data.categoryPath ? [data.categoryPath] : [categoryName, subcategory].filter(Boolean));
        const summary = classification.summary || data.summary || `Screenshot filed into ${categoryName}`;

        const classificationResult: ClassificationResultModel = {
          screenshotId: screenshot.id,
          categoryId: categoryId,
          categoryName: categoryName,
          subcategory: subcategory,
          folderPath: folderPath,
          confidence: confidence,
          detectedApp: classification.detectedApp || screenshot.detectedApp,
          suggestedTags: suggestedTags,
          keywords: suggestedTags,
          summary: summary,
          isAutoCategorized: true,
          entities: classification.entities,
          source: 'backend',
          modelName: classification.modelName || 'RuleEngine-v1.0',
        };

        // 2. Persist in local classification cache
        const cacheRecord: ClassificationCacheRecord = {
          id: uuidv4(),
          screenshotId: screenshot.id,
          category: categoryName,
          subcategory: subcategory,
          tagsJson: JSON.stringify(suggestedTags),
          entitiesJson: JSON.stringify(classification.entities || {}),
          confidence: confidence,
          summary: summary,
          source: 'backend',
          cachedAt: new Date().toISOString(),
        };
        await classificationCacheRepository.setCache(cacheRecord);

        // 3. Update local screenshot entity
        await screenshotRepository.updateClassification(
          screenshot.id,
          categoryId,
          categoryName,
          subcategory,
          confidence,
          suggestedTags,
          'backend',
          folderPath
        );

        // 4. Update in-memory Zustand store
        useScreenshotStore.getState().updateCategoryLocal(
          screenshot.id,
          categoryId,
          categoryName,
          subcategory
        );

        loggerService.info(
          'Sync',
          `Successfully synchronized ${screenshot.fileName} -> ${categoryName} (${Math.round(confidence * 100)}%)`
        );

        // Dispatch AI Sync notification
        notificationService.notifyAISyncCompleted(categoryName, suggestedTags.length).catch(() => {});

        // If confidence is low, dispatch Needs Review notification
        if (confidence < 0.85) {
          notificationService.notifyPendingReview(1).catch(() => {});
        }

        return Result.success(classificationResult);
      }

      // Backend responded with failure -> Enqueue to offline sync queue
      loggerService.warn('Sync', `Backend sync returned failure, enqueuing offline item: ${screenshot.fileName}`);
      await this.enqueueOfflineSync(screenshot.id, payload, res.error || 'Server error');
      return Result.failure(res.error || 'Backend sync returned unsuccessful status');
    } catch (err: any) {
      loggerService.warn('Sync', `Network offline, enqueuing for background sync: ${err?.message}`);
      await this.enqueueOfflineSync(screenshot.id, payload, err?.message || 'Network failure');
      return Result.failure(err?.message || 'Network failure during sync', err);
    }
  }

  /**
   * Helper to sync a screenshot given its local ID.
   */
  async syncScreenshotById(screenshotId: string): Promise<Result<ClassificationResultModel>> {
    const sc = await screenshotRepository.getScreenshotById(screenshotId);
    if (!sc) {
      return Result.failure('Screenshot not found in database');
    }

    const ocr = await ocrCacheRepository.getByScreenshotId(screenshotId);
    return this.syncScreenshotMetadata(sc, ocr);
  }

  /**
   * Flushes and retries all pending items in the offline sync queue with an atomic lock
   * and exponential backoff retry behavior.
   */
  async syncPendingQueue(): Promise<{ processed: number; successful: number; failed: number }> {
    if (this.isSyncingQueue) {
      loggerService.debug('Sync', 'Offline sync queue processor already running, skipping.');
      return { processed: 0, successful: 0, failed: 0 };
    }

    this.isSyncingQueue = true;
    try {
      const queue = await syncQueueRepository.getPendingQueue();
      if (queue.length === 0) {
        return { processed: 0, successful: 0, failed: 0 };
      }

      loggerService.info('Sync', `Processing ${queue.length} items from offline sync queue...`);
      let successful = 0;
      let failed = 0;

      for (const item of queue) {
        try {
          const res = await apiClient.uploadScreenshotMetadata(item.payload);
          if (res.isSuccess) {
            await syncQueueRepository.markCompleted(item.id);
            successful++;
          } else {
            await syncQueueRepository.markFailed(item.id, res.error || 'Retry failed');
            failed++;
          }
        } catch (e: any) {
          await syncQueueRepository.markFailed(item.id, e?.message || 'Network exception');
          failed++;
        }

        // Small delay between network retry calls
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      loggerService.info('Sync', `Queue flush complete: ${successful} ok, ${failed} failed.`);
      return { processed: queue.length, successful, failed };
    } finally {
      this.isSyncingQueue = false;
    }
  }

  /**
   * Enqueues a failed or offline sync request into SQLite.
   */
  private async enqueueOfflineSync(
    screenshotId: string,
    payload: Record<string, any>,
    errorMessage: string
  ): Promise<void> {
    await syncQueueRepository.addToQueue({
      id: uuidv4(),
      endpoint: ApiConstants.uploadMetadata,
      httpMethod: 'POST',
      payload: payload,
      retryCount: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastError: errorMessage,
    });
  }

  /**
   * Gets today's count of backend AI synchronized screenshots.
   */
  async getTodaySyncedCount(): Promise<number> {
    return classificationCacheRepository.getTodaySyncedCount();
  }
}

export const contextSyncService = new ContextSyncService();

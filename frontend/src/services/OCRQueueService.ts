import { ocrService } from './ocrService';
import { ocrCacheRepository } from '../database/repositories/ocrCacheRepository';
import { pendingScreenshotRepository } from '../database/repositories/pendingScreenshotRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { useScannerStore } from '../store/scanner.store';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';
import { searchIndexService } from './searchIndexService';

export interface OCRQueueItem {
  id: string; // ID in pending_screenshots
  deviceAssetId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  capturedAt: string;
  width?: number;
  height?: number;
  deviceFolder?: string;
  mimeType?: string;
  retryCount?: number;
}

export class OCRQueueService {
  private queue: OCRQueueItem[] = [];
  private isProcessing = false;
  private currentItem: OCRQueueItem | null = null;
  private maxAutoRetries = 2;

  /**
   * Enqueues a screenshot for background OCR processing.
   */
  enqueue(item: OCRQueueItem): void {
    // Avoid queueing duplicates currently in memory queue
    const exists = this.queue.some((q) => q.id === item.id);
    if (exists || (this.currentItem && this.currentItem.id === item.id)) {
      return;
    }

    this.queue.push(item);
    console.log(`[OCRQueueService] Enqueued: ${item.fileName}. Queue size: ${this.queue.length}`);
    this.updateStoreCounts();

    // Start background processor if not active
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  getCurrentItem(): OCRQueueItem | null {
    return this.currentItem;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!;
        this.currentItem = item;
        useScannerStore.getState().setCurrentProcessingItem(item);
        this.updateStoreCounts();

        await this.processItem(item);

        this.currentItem = null;
        useScannerStore.getState().setCurrentProcessingItem(null);
        this.updateStoreCounts();

        // Small yield to UI loop between OCR operations
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      this.isProcessing = false;
      this.currentItem = null;
      useScannerStore.getState().setCurrentProcessingItem(null);
      this.updateStoreCounts();
    }
  }

  private async processItem(item: OCRQueueItem): Promise<void> {
    const startTime = Date.now();
    console.log(`[OCRQueueService] Starting OCR for: ${item.fileName}`);

    try {
      // 1. Update SQLite pending status to Processing
      await pendingScreenshotRepository.updateOCRResult(
        item.id,
        'Processing',
        undefined,
        undefined
      );
      useScannerStore.getState().updateItemStatus(item.id, 'Processing');

      // 2. Perform OCR via Google ML Kit
      const ocrRes = await ocrService.extractText(item.id, item.filePath);

      if (ocrRes.isSuccess && ocrRes.data) {
        const result = ocrRes.data;
        const processingTimeMs = result.processingTimeMs || (Date.now() - startTime);

        // 3. Save to SQLite OCRCache table
        await ocrCacheRepository.insertOCRCache({
          id: result.id,
          screenshotId: item.id,
          extractedText: result.rawText,
          normalizedText: result.normalizedText,
          processingTime: processingTimeMs,
          language: result.language,
          ocrVersion: result.ocrVersion,
          confidence: result.confidence,
          blocksJson: JSON.stringify(result.blocks),
          createdOn: result.processedAt,
        });

        // 4. Update PendingScreenshots with OCR result & mark Completed (ready for AI classification)
        await pendingScreenshotRepository.updateOCRResult(
          item.id,
          'Completed',
          result.rawText,
          processingTimeMs
        );
        useScannerStore.getState().updateItemStatus(item.id, 'Completed');

        // 5. Prepare Search Index and store in SQLite screenshots table
        const searchIndex = searchIndexService.prepareIndex(result.rawText);

        const screenshotModel: ScreenshotModel = {
          id: item.id,
          deviceAssetId: item.deviceAssetId,
          filePath: item.filePath,
          fileName: item.fileName,
          createdAt: item.capturedAt,
          width: item.width || 1080,
          height: item.height || 2400,
          fileSize: item.fileSize,
          categoryId: 'unsorted',
          categoryName: 'Unsorted',
          subcategory: 'Ready for AI Classification',
          confidence: result.confidence,
          keywords: searchIndex.keywords,
          isFavorite: false,
          isReviewed: false,
          isSynced: false,
          ocrStatus: 'completed',
          ocrText: result.rawText,
          tags: searchIndex.keywords.slice(0, 4).map((kw) => ({
            id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
            name: kw,
            colorHex: '6366F1',
          })),
          lastScannedAt: new Date().toISOString(),
        };

        await screenshotRepository.insertScreenshot(screenshotModel);
        useScreenshotStore.getState().addOrUpdateScreenshot(screenshotModel);

        // 6. Update last OCR result in Zustand store
        useScannerStore.getState().setLastOCRResult({
          screenshotId: item.id,
          fileName: item.fileName,
          rawText: result.rawText,
          confidence: result.confidence,
          processingTimeMs,
          language: result.language,
          blocksCount: result.blocks.length,
          processedAt: result.processedAt,
        });

        console.log(
          `[OCRQueueService] Completed OCR for ${item.fileName} in ${processingTimeMs}ms (${result.blocks.length} blocks)`
        );
      } else {
        const errorMsg = ocrRes.error || 'OCR recognition returned no data';
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'OCR processing failed';
      console.error(`[OCRQueueService] Error processing ${item.fileName}:`, errorMsg);

      await pendingScreenshotRepository.updateOCRResult(
        item.id,
        'Failed',
        undefined,
        Date.now() - startTime,
        errorMsg
      );
      useScannerStore.getState().updateItemStatus(item.id, 'Failed');

      // Check auto-retry with backoff
      const currentRetry = item.retryCount || 0;
      if (currentRetry < this.maxAutoRetries) {
        console.log(
          `[OCRQueueService] Scheduling auto-retry (${currentRetry + 1}/${this.maxAutoRetries}) for ${item.fileName}`
        );
        setTimeout(() => {
          this.enqueue({
            ...item,
            retryCount: currentRetry + 1,
          });
        }, (currentRetry + 1) * 2000);
      }
    }
  }

  /**
   * Retries all failed OCR items in the queue.
   */
  async retryAllFailed(): Promise<void> {
    const failed = await pendingScreenshotRepository.getFailedScreenshots();
    console.log(`[OCRQueueService] Retrying ${failed.length} failed screenshots...`);

    for (const f of failed) {
      await pendingScreenshotRepository.incrementRetry(f.id);
      this.enqueue({
        id: f.id,
        deviceAssetId: f.deviceAssetId,
        filePath: f.filePath,
        fileName: f.fileName,
        fileSize: f.fileSize,
        fileHash: f.fileHash,
        capturedAt: f.capturedAt,
        width: f.width,
        height: f.height,
        deviceFolder: f.deviceFolder,
        mimeType: f.mimeType,
        retryCount: (f.retryCount || 0) + 1,
      });
    }
  }

  /**
   * Retries a single screenshot by ID.
   */
  async retrySingle(id: string): Promise<void> {
    const item = await pendingScreenshotRepository.getById(id);
    if (item) {
      await pendingScreenshotRepository.incrementRetry(id);
      this.enqueue({
        id: item.id,
        deviceAssetId: item.deviceAssetId,
        filePath: item.filePath,
        fileName: item.fileName,
        fileSize: item.fileSize,
        fileHash: item.fileHash,
        capturedAt: item.capturedAt,
        width: item.width,
        height: item.height,
        deviceFolder: item.deviceFolder,
        mimeType: item.mimeType,
        retryCount: (item.retryCount || 0) + 1,
      });
    }
  }

  /**
   * Updates store OCR counts.
   */
  async updateStoreCounts(): Promise<void> {
    try {
      const [counts, ocrStats] = await Promise.all([
        pendingScreenshotRepository.getCounts(),
        ocrCacheRepository.getStats(),
      ]);

      useScannerStore.getState().setOCRMetrics({
        ocrCompletedToday: ocrStats.todayCount,
        ocrPending: counts.pending + this.queue.length + (this.currentItem ? 1 : 0),
        ocrFailed: counts.failed,
        avgProcessingTimeMs: ocrStats.avgProcessingTimeMs,
      });
    } catch (err) {
      console.warn('[OCRQueueService] Error updating OCR store counts:', err);
    }
  }
}

export const ocrQueueService = new OCRQueueService();

import { VisionQueueItem, VisionQueueStatus } from './types';
import { visionAIService } from './VisionAIService';
import { useVisionStore } from '../store/vision.store';
import { loggerService } from '../services/loggerService';

export class VisionInferenceQueue {
  private queue: VisionQueueItem[] = [];
  private isProcessing = false;
  private currentItem: VisionQueueItem | null = null;
  private maxRetries = 3;

  /**
   * Enqueues a screenshot for background Vision AI processing.
   * Concurrency is strictly 1 (sequential) to protect device memory and CPU/GPU.
   */
  enqueue(item: {
    screenshotId: string;
    filePath: string;
    fileName: string;
    ocrText?: string;
    deviceFolder?: string;
  }): void {
    // Avoid queueing duplicates currently in memory queue
    const exists = this.queue.some((q) => q.screenshotId === item.screenshotId);
    if (exists || (this.currentItem && this.currentItem.screenshotId === item.screenshotId)) {
      return;
    }

    const queueItem: VisionQueueItem = {
      id: `vq_${item.screenshotId}_${Date.now()}`,
      screenshotId: item.screenshotId,
      filePath: item.filePath,
      fileName: item.fileName,
      ocrText: item.ocrText,
      deviceFolder: item.deviceFolder,
      status: 'Pending',
      retryCount: 0,
      maxRetries: this.maxRetries,
      queuedAt: new Date().toISOString(),
    };

    this.queue.push(queueItem);
    useVisionStore.getState().setQueueLength(this.queue.length);

    loggerService.debug(
      'Vision',
      `Enqueued vision job for: ${item.fileName}. Queue length: ${this.queue.length}`
    );

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  getCurrentItem(): VisionQueueItem | null {
    return this.currentItem;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Resumes any un-analyzed screenshots on application startup.
   */
  async resumePendingOnStartup(): Promise<number> {
    try {
      useVisionStore.getState().loadInitialStats();
      loggerService.info('Vision', 'Vision inference queue initialized.');
      return 0;
    } catch (err: any) {
      loggerService.error('Vision', 'Failed to initialize vision queue on startup', err);
      return 0;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    useVisionStore.getState().setIsProcessing(true);

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!;
        this.currentItem = item;
        item.status = 'Processing';
        item.startedAt = new Date().toISOString();

        useVisionStore.getState().setCurrentProcessingItem(item);
        useVisionStore.getState().setQueueLength(this.queue.length);

        await this.processItem(item);

        this.currentItem = null;
        useVisionStore.getState().setCurrentProcessingItem(null);
        useVisionStore.getState().setQueueLength(this.queue.length);

        // Yield to JS thread between heavy inference tasks (60ms)
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    } finally {
      this.isProcessing = false;
      this.currentItem = null;
      useVisionStore.getState().setIsProcessing(false);
      useVisionStore.getState().setCurrentProcessingItem(null);
      useVisionStore.getState().setQueueLength(this.queue.length);
    }
  }

  private async processItem(item: VisionQueueItem): Promise<void> {
    const startTime = Date.now();
    loggerService.info('Vision', `Starting visual scene analysis for: ${item.fileName}`);

    try {
      const res = await visionAIService.analyzeScreenshot({
        screenshotId: item.screenshotId,
        filePath: item.filePath,
        fileName: item.fileName,
        ocrText: item.ocrText,
      });

      if (res.isSuccess && res.data) {
        item.status = 'Completed';
        item.completedAt = new Date().toISOString();
        item.processingTimeMs = res.data.processingTimeMs;

        useVisionStore.getState().setLastResult(res.data);
        useVisionStore.getState().recordSuccess(res.data.processingTimeMs);

        loggerService.info(
          'Vision',
          `Completed vision inference for ${item.fileName} in ${res.data.processingTimeMs}ms (Provider: ${res.data.provider}, Type: ${res.data.scene.screenType})`
        );
      } else {
        throw new Error(res.error || 'Vision analysis returned no data');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Vision analysis failed';
      loggerService.error('Vision', `Vision processing failed for ${item.fileName}: ${errMsg}`, err);

      item.status = 'Failed';
      item.errorMessage = errMsg;
      useVisionStore.getState().recordFailure();

      // Retry with exponential backoff if retry limit not reached
      if (item.retryCount < item.maxRetries) {
        const backoffMs = Math.min(30000, 2000 * Math.pow(2, item.retryCount));
        loggerService.warn(
          'Vision',
          `Scheduling retry #${item.retryCount + 1} for ${item.fileName} in ${backoffMs}ms`
        );

        setTimeout(() => {
          this.queue.push({
            ...item,
            status: 'Pending',
            retryCount: item.retryCount + 1,
          });
          useVisionStore.getState().setQueueLength(this.queue.length);
          if (!this.isProcessing) {
            this.processQueue();
          }
        }, backoffMs);
      }
    }
  }

  clearQueue(): void {
    this.queue = [];
    useVisionStore.getState().setQueueLength(0);
  }
}

export const visionInferenceQueue = new VisionInferenceQueue();

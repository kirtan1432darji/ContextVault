import { queueRepository } from '../../database/repositories/QueueRepository';
import { screenshotRepository } from '../../database/repositories/screenshotRepository';
import { backgroundAIWorker } from './BackgroundAIWorker';
import {
  QueueEvent,
  QueueEventListener,
  QueueItem,
  QueuePriority,
  QueueState,
  QueueStats,
} from './types';
import { loggerService } from '../loggerService';

export class AIProcessingQueue {
  private static instance: AIProcessingQueue | null = null;

  static getInstance(): AIProcessingQueue {
    if (!AIProcessingQueue.instance) {
      AIProcessingQueue.instance = new AIProcessingQueue();
    }
    return AIProcessingQueue.instance;
  }

  /**
   * Enqueues a single screenshot for background AI processing.
   * Immediately starts sequential worker loop if idle.
   */
  async enqueue(
    screenshotId: string,
    priority: QueuePriority = 'medium'
  ): Promise<QueueItem> {
    const item = await queueRepository.enqueue(screenshotId, priority);
    loggerService.info(
      'AIQueue',
      `Enqueued screenshot ${screenshotId} with priority [${priority}]`
    );

    // Auto-trigger background processing loop
    backgroundAIWorker.start().catch((err) => {
      loggerService.error('AIQueue', 'Error auto-starting worker loop', err);
    });

    return item;
  }

  /**
   * Enqueues a batch of screenshots.
   */
  async enqueueBatch(
    screenshotIds: string[],
    priority: QueuePriority = 'medium'
  ): Promise<number> {
    const count = await queueRepository.enqueueBatch(
      screenshotIds.map((id) => ({ screenshotId: id, priority }))
    );
    loggerService.info(
      'AIQueue',
      `Batch enqueued ${count} screenshots with priority [${priority}]`
    );

    backgroundAIWorker.start().catch((err) => {
      loggerService.error('AIQueue', 'Error starting worker after batch enqueue', err);
    });

    return count;
  }

  /**
   * Enqueues all screenshots that require AI processing or are currently unsorted.
   */
  async enqueueAllPending(): Promise<number> {
    const all = await screenshotRepository.getAllScreenshots();
    const ids = all.map((s) => s.id);
    return this.enqueueBatch(ids, 'low');
  }

  /**
   * Pauses the queue worker.
   */
  pause(): void {
    backgroundAIWorker.pause();
  }

  /**
   * Resumes the queue worker and restarts processing.
   */
  resume(): void {
    backgroundAIWorker.resume();
  }

  isPaused(): boolean {
    return backgroundAIWorker.isWorkerPaused();
  }

  isProcessing(): boolean {
    return backgroundAIWorker.isWorkerActive();
  }

  getCurrentItem(): QueueItem | null {
    return backgroundAIWorker.getCurrentItem();
  }

  /**
   * Re-queues all failed items and resumes processing.
   */
  async retryFailed(): Promise<number> {
    const count = await queueRepository.retryFailed();
    if (count > 0) {
      backgroundAIWorker.start().catch(() => {});
    }
    return count;
  }

  /**
   * Retries a specific failed or cancelled queue item.
   */
  async retryItem(id: string): Promise<boolean> {
    const success = await queueRepository.retryItem(id);
    if (success) {
      backgroundAIWorker.start().catch(() => {});
    }
    return success;
  }

  /**
   * Cancels a pending item.
   */
  async cancelItem(id: string): Promise<boolean> {
    return queueRepository.cancelItem(id);
  }

  /**
   * Elevates an item's priority (e.g. user clicks "Analyze Now").
   */
  async bumpPriority(id: string, priority: QueuePriority): Promise<void> {
    await queueRepository.bumpPriority(id, priority);
    backgroundAIWorker.start().catch(() => {});
  }

  /**
   * Clears all completed queue items from SQLite.
   */
  async clearCompleted(): Promise<number> {
    return queueRepository.clearCompleted();
  }

  /**
   * Clears all non-processing items.
   */
  async clearAll(): Promise<void> {
    return queueRepository.clearAll();
  }

  /**
   * Retrieves aggregate statistics of the queue.
   */
  async getStats(): Promise<QueueStats> {
    return queueRepository.getQueueStats();
  }

  /**
   * Retrieves queue items filtered by state.
   */
  async getItems(state?: QueueState, limit = 100): Promise<QueueItem[]> {
    return queueRepository.getQueueItems(state, limit);
  }

  /**
   * Subscribes to real-time worker events.
   */
  subscribe(listener: QueueEventListener): () => void {
    return backgroundAIWorker.addListener(listener);
  }
}

export const aiProcessingQueue = AIProcessingQueue.getInstance();

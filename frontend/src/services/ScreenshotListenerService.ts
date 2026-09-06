import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { DetectedScreenshotEvent, PendingScreenshot, PendingScreenshotStatus } from '../models';
import { pendingScreenshotRepository } from '../database/repositories/pendingScreenshotRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { mediaObserverService } from './backgroundDetection/mediaObserver';
import { permissionService } from './permissionService';
import { screenshotScannerService } from './screenshotScannerService';
import { useScannerStore } from '../store/scanner.store';
import { FileUtils } from '../utils/fileUtils';

const STORAGE_KEY_SCANNER_ENABLED = '@contextvault_scanner_auto_enabled';

export class ScreenshotListenerService {
  private isInitialized = false;
  private appStateSubscription: any = null;
  private observerUnsubscribe: (() => void) | null = null;
  private processedHashes: Set<string> = new Set();
  private processedAssetIds: Set<string> = new Set();
  private isProcessingQueue = false;

  /**
   * Initializes the listener service on app launch.
   * Restores scanner state if previously enabled and registers AppState listeners.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[ScreenshotListenerService] Initializing detection engine...');

    // 1. Subscribe to AppState changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    // 2. Load existing queue stats into store
    await this.refreshStoreCounts();

    // 3. Check if listener should automatically resume after app launch
    const savedState = await AsyncStorage.getItem(STORAGE_KEY_SCANNER_ENABLED);
    const shouldAutoStart = savedState === null || savedState === 'true'; // Default enabled

    if (shouldAutoStart) {
      const permStatus = await permissionService.checkStoragePermission();
      useScannerStore.getState().setPermissionStatus(permStatus);

      if (permStatus === 'granted') {
        await this.start();
      } else {
        console.log('[ScreenshotListenerService] Auto-start pending permission approval.');
      }
    }
  }

  /**
   * Starts the screenshot listener.
   * Requests permissions if necessary and begins observing MediaStore.
   */
  async start(): Promise<boolean> {
    const hasPermission = await permissionService.requestStoragePermission();
    const permStatus = await permissionService.checkStoragePermission();
    useScannerStore.getState().setPermissionStatus(permStatus);

    if (!hasPermission && Platform.OS === 'android') {
      console.warn('[ScreenshotListenerService] Cannot start: permission denied.');
      return false;
    }

    // Subscribe to MediaStore observer events
    if (this.observerUnsubscribe) {
      this.observerUnsubscribe();
    }
    this.observerUnsubscribe = mediaObserverService.addListener(
      this.handleDetectedScreenshot
    );

    const started = mediaObserverService.startObserving();
    if (started) {
      await AsyncStorage.setItem(STORAGE_KEY_SCANNER_ENABLED, 'true');
      useScannerStore.getState().setIsListening(true);
      console.log('[ScreenshotListenerService] Screenshot listener is active.');
      await this.refreshStoreCounts();
      return true;
    }

    return false;
  }

  /**
   * Stops the screenshot listener when requested or app is teardown.
   */
  async stop(): Promise<void> {
    if (this.observerUnsubscribe) {
      this.observerUnsubscribe();
      this.observerUnsubscribe = null;
    }

    mediaObserverService.stopObserving();
    await AsyncStorage.setItem(STORAGE_KEY_SCANNER_ENABLED, 'false');
    useScannerStore.getState().setIsListening(false);
    console.log('[ScreenshotListenerService] Screenshot listener stopped.');
  }

  /**
   * Core detection handler invoked whenever Android MediaStore fires an event.
   * Performs deduplication, persists to PendingScreenshots in SQLite, and initiates processing.
   */
  handleDetectedScreenshot = async (event: DetectedScreenshotEvent): Promise<void> => {
    if (!event || !event.filePath) {
      return;
    }

    const deviceAssetId = event.deviceAssetId || `asset_${Date.now()}`;
    const filePath = event.filePath;
    const fileName = event.fileName || FileUtils.getFileName(filePath);
    const fileSize = event.fileSize || 0;
    const capturedAt = event.timestamp
      ? new Date(event.timestamp).toISOString()
      : new Date().toISOString();

    const timestampNum = event.timestamp || Date.now();
    const fileHash =
      event.fileHash ||
      FileUtils.generateFallbackSHA256(filePath, fileSize, timestampNum);

    // 1. In-memory fast duplicate check
    if (this.processedAssetIds.has(deviceAssetId) || this.processedHashes.has(fileHash)) {
      console.log('[ScreenshotListenerService] Duplicate ignored (in-memory):', fileName);
      return;
    }

    // 2. SQLite duplicate check across pending and organized screenshots
    const isDbDuplicate = await pendingScreenshotRepository.isDuplicate(
      deviceAssetId,
      fileHash,
      filePath
    );

    if (isDbDuplicate) {
      console.log('[ScreenshotListenerService] Duplicate ignored (SQLite):', fileName);
      this.processedAssetIds.add(deviceAssetId);
      this.processedHashes.add(fileHash);
      return;
    }

    // Record in memory to prevent rapid duplicate bursts
    this.processedAssetIds.add(deviceAssetId);
    this.processedHashes.add(fileHash);

    const pendingId = uuidv4();
    const pendingItem: PendingScreenshot = {
      id: pendingId,
      deviceAssetId,
      filePath,
      fileName,
      fileSize,
      fileHash,
      capturedAt,
      status: 'Pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Store in SQLite PendingScreenshots table BEFORE OCR/processing
    try {
      await pendingScreenshotRepository.insertPending(pendingItem);
      console.log('[ScreenshotListenerService] Stored pending screenshot in SQLite:', fileName);

      // 4. Update Zustand store real-time metrics
      useScannerStore.getState().setLastScreenshot({
        id: pendingId,
        deviceAssetId,
        filePath,
        fileName,
        fileSize,
        fileHash,
        capturedAt,
        status: 'Pending',
        width: event.width || 1080,
        height: event.height || 2400,
      });

      await this.refreshStoreCounts();

      // 5. Trigger non-blocking async processing
      this.processPendingItem(pendingItem, event.width, event.height);
    } catch (err) {
      console.error('[ScreenshotListenerService] Error inserting pending screenshot:', err);
    }
  };

  /**
   * Processes a pending screenshot through OCR, heuristic classification, and storage.
   */
  private async processPendingItem(
    item: PendingScreenshot,
    width = 1080,
    height = 2400
  ): Promise<void> {
    try {
      // Transition status to Processing
      await pendingScreenshotRepository.updateStatus(item.id, 'Processing');
      useScannerStore.getState().updateItemStatus(item.id, 'Processing');
      await this.refreshStoreCounts();

      // Process via Scanner Service (local OCR & rule classification)
      const organized = await screenshotScannerService.processScreenshotAsset({
        id: item.deviceAssetId,
        filePath: item.filePath,
        fileName: item.fileName,
        fileSize: item.fileSize,
        width,
        height,
        createdAt: item.capturedAt,
      });

      if (organized) {
        // Transition status to Completed
        await pendingScreenshotRepository.updateStatus(item.id, 'Completed');
        useScannerStore.getState().updateItemStatus(item.id, 'Completed');
        console.log('[ScreenshotListenerService] Screenshot processed successfully:', item.fileName);
      } else {
        await pendingScreenshotRepository.updateStatus(
          item.id,
          'Completed',
          'Identified as already organized'
        );
      }
    } catch (err: any) {
      console.error('[ScreenshotListenerService] Failed to process screenshot:', err);
      const errMsg = err?.message || 'Processing failed';
      await pendingScreenshotRepository.updateStatus(item.id, 'Failed', errMsg);
      useScannerStore.getState().updateItemStatus(item.id, 'Failed');
    } finally {
      await this.refreshStoreCounts();
    }
  }

  /**
   * Retries all failed screenshots in the queue.
   */
  async retryFailed(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      const failedItems = await pendingScreenshotRepository.getFailedScreenshots();
      console.log(`[ScreenshotListenerService] Retrying ${failedItems.length} failed items...`);

      for (const item of failedItems) {
        await pendingScreenshotRepository.incrementRetry(item.id);
        await this.processPendingItem(item);
      }
    } finally {
      this.isProcessingQueue = false;
      await this.refreshStoreCounts();
    }
  }

  /**
   * Simulates screenshot detection for testing and debug verification.
   */
  async simulateScreenshot(customName?: string): Promise<void> {
    const timestamp = Date.now();
    const name = customName || `Screenshot_${timestamp}_Test.png`;
    const randomHash = FileUtils.generateFallbackSHA256(
      `/storage/emulated/0/Pictures/Screenshots/${name}`,
      350000,
      timestamp
    );

    const simulatedEvent: DetectedScreenshotEvent = {
      deviceAssetId: `sim_${timestamp}`,
      filePath: `/storage/emulated/0/Pictures/Screenshots/${name}`,
      fileName: name,
      fileSize: 350000 + Math.floor(Math.random() * 50000),
      fileHash: randomHash,
      width: 1080,
      height: 2400,
      timestamp,
    };

    await this.handleDetectedScreenshot(simulatedEvent);
  }

  /**
   * Refreshes real-time stats in Zustand store.
   */
  async refreshStoreCounts(): Promise<void> {
    try {
      const counts = await pendingScreenshotRepository.getCounts();
      useScannerStore.getState().setCounts({
        scannedToday: counts.today,
        pendingProcessing: counts.pending + counts.processing,
      });
    } catch (err) {
      console.warn('[ScreenshotListenerService] Could not refresh counts:', err);
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('[ScreenshotListenerService] AppState transitioned to:', nextAppState);
    // On Android, ContentObserver continues observing MediaStore in background
    if (nextAppState === 'active') {
      this.refreshStoreCounts();
    }
  };

  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.stop();
    this.isInitialized = false;
  }
}

export const screenshotListenerService = new ScreenshotListenerService();

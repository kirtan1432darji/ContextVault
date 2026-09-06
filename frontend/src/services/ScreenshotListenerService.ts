import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { DetectedScreenshotEvent, PendingScreenshot } from '../models';
import { pendingScreenshotRepository } from '../database/repositories/pendingScreenshotRepository';
import { mediaObserverService } from './backgroundDetection/mediaObserver';
import { permissionService } from './permissionService';
import { ocrQueueService } from './OCRQueueService';
import { useScannerStore } from '../store/scanner.store';
import { FileUtils } from '../utils/fileUtils';

const STORAGE_KEY_SCANNER_ENABLED = '@contextvault_scanner_auto_enabled';

export class ScreenshotListenerService {
  private isInitialized = false;
  private appStateSubscription: any = null;
  private observerUnsubscribe: (() => void) | null = null;
  private processedHashes: Set<string> = new Set();
  private processedAssetIds: Set<string> = new Set();

  /**
   * Initializes the listener service on app launch.
   * Restores scanner state if previously enabled and registers AppState listeners.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[ScreenshotListenerService] Initializing detection engine & OCR queue...');

    // 1. Subscribe to AppState changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    // 2. Load existing queue stats and OCR metrics into store
    await this.refreshStoreCounts();

    // 3. Check if listener should automatically resume after app launch
    const savedState = await AsyncStorage.getItem(STORAGE_KEY_SCANNER_ENABLED);
    const shouldAutoStart = savedState === null || savedState === 'true';

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
   * Stops the screenshot listener when requested.
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
   * Extracts metadata, checks deduplication, saves to SQLite PendingScreenshots,
   * and dispatches to background OCRQueueService.
   */
  handleDetectedScreenshot = async (event: DetectedScreenshotEvent): Promise<void> => {
    if (!event || !event.filePath) {
      return;
    }

    const deviceAssetId = event.deviceAssetId || `asset_${Date.now()}`;
    const filePath = event.filePath;
    const fileName = event.fileName || FileUtils.getFileName(filePath);
    const fileSize = event.fileSize || 0;
    const width = event.width || 1080;
    const height = event.height || 2400;
    const resolution = `${width}x${height}`;
    const capturedAt = event.timestamp
      ? new Date(event.timestamp).toISOString()
      : new Date().toISOString();

    const timestampNum = event.timestamp || Date.now();
    const fileHash =
      event.fileHash ||
      FileUtils.generateFallbackSHA256(filePath, fileSize, timestampNum);

    // Extract device folder
    const pathParts = filePath.split(/[/\\]/);
    const deviceFolder =
      event.deviceFolder || (pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Screenshots');

    // Extract MIME type
    const ext = FileUtils.getFileExtension(filePath);
    const mimeType =
      event.mimeType || (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png');

    // 1. Fast in-memory deduplication
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
      deviceFolder,
      mimeType,
      resolution,
      width,
      height,
      ocrStatus: 'Pending',
      ocrProcessingTime: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Store in SQLite PendingScreenshots table BEFORE OCR processing
    try {
      await pendingScreenshotRepository.insertPending(pendingItem);
      console.log('[ScreenshotListenerService] Stored pending screenshot in SQLite:', fileName);

      // 4. Update Zustand store with latest detected screenshot
      useScannerStore.getState().setLastScreenshot({
        id: pendingId,
        deviceAssetId,
        filePath,
        fileName,
        fileSize,
        fileHash,
        capturedAt,
        status: 'Pending',
        width,
        height,
        deviceFolder,
        mimeType,
      });

      await this.refreshStoreCounts();

      // 5. Dispatch to background OCRQueueService for sequential ML Kit text recognition
      ocrQueueService.enqueue({
        id: pendingId,
        deviceAssetId,
        filePath,
        fileName,
        fileSize,
        fileHash,
        capturedAt,
        width,
        height,
        deviceFolder,
        mimeType,
        retryCount: 0,
      });
    } catch (err) {
      console.error('[ScreenshotListenerService] Error saving pending screenshot:', err);
    }
  };

  /**
   * Simulates screenshot detection for testing and verification.
   */
  async simulateScreenshot(customName?: string): Promise<void> {
    const timestamp = Date.now();
    const types = ['Invoice_Google_Play', 'Chat_Receipt_Order', 'Code_Snippets_API', 'Flight_Ticket_Boarding'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    const name = customName || `Screenshot_${selectedType}_${timestamp}.png`;
    const folder = 'Screenshots';
    const filePath = `/storage/emulated/0/Pictures/Screenshots/${name}`;
    const fileSize = 350000 + Math.floor(Math.random() * 50000);
    const randomHash = FileUtils.generateFallbackSHA256(filePath, fileSize, timestamp);

    const simulatedEvent: DetectedScreenshotEvent = {
      deviceAssetId: `sim_${timestamp}`,
      filePath,
      fileName: name,
      fileSize,
      fileHash: randomHash,
      width: 1080,
      height: 2400,
      timestamp,
      deviceFolder: folder,
      mimeType: 'image/png',
    };

    await this.handleDetectedScreenshot(simulatedEvent);
  }

  /**
   * Refreshes store counts and OCR metrics.
   */
  async refreshStoreCounts(): Promise<void> {
    try {
      const counts = await pendingScreenshotRepository.getCounts();
      useScannerStore.getState().setCounts({
        scannedToday: counts.today,
        pendingProcessing: counts.pending + counts.processing,
      });
      await ocrQueueService.updateStoreCounts();
    } catch (err) {
      console.warn('[ScreenshotListenerService] Could not refresh counts:', err);
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('[ScreenshotListenerService] AppState transitioned to:', nextAppState);
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

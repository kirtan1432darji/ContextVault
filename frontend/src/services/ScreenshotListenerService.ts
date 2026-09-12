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
import { loggerService } from './loggerService';
import { databaseService } from '../database/database';
import { notificationService } from './notificationService';
import { performanceAuditService } from './performanceAuditService';

const STORAGE_KEY_SCANNER_ENABLED = '@contextvault_scanner_auto_enabled';

export class ScreenshotListenerService {
  private isInitialized = false;
  private isListeningActive = false;
  private appStateSubscription: any = null;
  private observerUnsubscribe: (() => void) | null = null;
  private processedHashes: Set<string> = new Set();
  private processedAssetIds: Set<string> = new Set();

  /**
   * Initializes the listener service on app launch.
   * Restores scanner state if previously enabled, resumes pending OCR queue,
   * and registers AppState listeners.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    loggerService.info('Scanner', 'Initializing automatic detection engine & OCR queue...');

    // 1. Subscribe to AppState changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    // 2. Initialize Android notification channels
    await notificationService.createNotificationChannels();

    // 3. Ensure database schema is ready and load existing queue stats
    await databaseService.getDatabase();
    await this.refreshStoreCounts();

    // 4. Resume any interrupted or pending OCR jobs from SQLite database
    await ocrQueueService.resumePendingOnStartup();

    // 5. Check if listener should automatically resume after app launch
    const savedState = await AsyncStorage.getItem(STORAGE_KEY_SCANNER_ENABLED);
    const shouldAutoStart = savedState === null || savedState === 'true';

    if (shouldAutoStart) {
      const permStatus = await permissionService.checkStoragePermission();
      useScannerStore.getState().setPermissionStatus(permStatus);

      if (permStatus === 'granted') {
        await this.start();
      } else {
        loggerService.info('Scanner', 'Auto-start pending storage permission approval.');
      }
    }
  }

  /**
   * Starts the screenshot listener idempotently.
   */
  async start(): Promise<boolean> {
    if (this.isListeningActive) {
      loggerService.debug('Scanner', 'Screenshot listener is already active.');
      return true;
    }

    const hasPermission = await permissionService.requestStoragePermission(false);
    const permStatus = await permissionService.checkStoragePermission();
    useScannerStore.getState().setPermissionStatus(permStatus);

    if (!hasPermission && Platform.OS === 'android') {
      loggerService.warn('Scanner', 'Cannot start listener: permission not granted.');
      return false;
    }

    // Clean up any stale observer subscription
    if (this.observerUnsubscribe) {
      this.observerUnsubscribe();
      this.observerUnsubscribe = null;
    }

    this.observerUnsubscribe = mediaObserverService.addListener(
      this.handleDetectedScreenshot
    );

    const started = mediaObserverService.startObserving();
    if (started) {
      this.isListeningActive = true;
      await AsyncStorage.setItem(STORAGE_KEY_SCANNER_ENABLED, 'true');
      useScannerStore.getState().setIsListening(true);
      loggerService.info('Scanner', 'Screenshot listener activated successfully.');
      await this.refreshStoreCounts();
      return true;
    }

    loggerService.error('Scanner', 'Failed to start MediaStore observer.');
    return false;
  }

  /**
   * Stops the screenshot listener safely.
   */
  async stop(): Promise<void> {
    if (this.observerUnsubscribe) {
      this.observerUnsubscribe();
      this.observerUnsubscribe = null;
    }

    mediaObserverService.stopObserving();
    this.isListeningActive = false;
    await AsyncStorage.setItem(STORAGE_KEY_SCANNER_ENABLED, 'false');
    useScannerStore.getState().setIsListening(false);
    loggerService.info('Scanner', 'Screenshot listener stopped.');
  }

  getIsListening(): boolean {
    return this.isListeningActive;
  }

  /**
   * Core detection handler invoked whenever Android MediaStore fires an event.
   * Extracts metadata, checks deduplication, saves to SQLite PendingScreenshots,
   * dispatches notifications, and enqueues to background OCRQueueService.
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
      loggerService.debug('Scanner', `Duplicate ignored (in-memory): ${fileName}`);
      return;
    }

    // 2. SQLite duplicate check across pending and organized screenshots
    const isDbDuplicate = await pendingScreenshotRepository.isDuplicate(
      deviceAssetId,
      fileHash,
      filePath
    );

    if (isDbDuplicate) {
      loggerService.debug('Scanner', `Duplicate ignored (SQLite): ${fileName}`);
      this.processedAssetIds.add(deviceAssetId);
      this.processedHashes.add(fileHash);
      return;
    }

    this.processedAssetIds.add(deviceAssetId);
    this.processedHashes.add(fileHash);

    // Limit set sizes in long-running processes to prevent memory leak
    if (this.processedHashes.size > 1000) {
      this.processedHashes.clear();
      this.processedAssetIds.clear();
    }

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
      loggerService.info('Scanner', `Stored pending screenshot in SQLite: ${fileName}`);

      // 4. Send notification if enabled
      notificationService.notifyScreenshotDetected(fileName).catch(() => {});

      // 5. Update Zustand store with latest detected screenshot
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

      // 6. Dispatch to background OCRQueueService for sequential text recognition
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
    } catch (err: any) {
      loggerService.error('Scanner', `Error saving pending screenshot: ${fileName}`, err);
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
      loggerService.warn('Scanner', 'Could not refresh scanner store counts', err);
    }
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    loggerService.debug('Scanner', `AppState transitioned to: ${nextAppState}`);
    if (nextAppState === 'active') {
      performanceAuditService.markWarmStartEnd();
      await this.refreshStoreCounts();

      // Check if scanner was expected to be running but stopped
      const savedState = await AsyncStorage.getItem(STORAGE_KEY_SCANNER_ENABLED);
      if (savedState === 'true' && !this.isListeningActive) {
        loggerService.info('Scanner', 'Resuming screenshot observer on app foreground.');
        await this.start();
      }
    } else if (nextAppState === 'background') {
      performanceAuditService.markWarmStartBegin();
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

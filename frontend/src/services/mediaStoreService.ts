import { Platform, PermissionsAndroid } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { mediaObserverService } from './backgroundDetection/mediaObserver';
import { permissionService } from './permissionService';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { pendingScreenshotRepository } from '../database/repositories/pendingScreenshotRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { thumbnailService } from './ThumbnailService';
import { FileUtils } from '../utils/fileUtils';
import { MediaStorePathResolver } from '../utils/MediaStorePathResolver';
import { DetectedScreenshotEvent, ScreenshotModel, PendingScreenshot } from '../models';
import { loggerService } from './loggerService';

export interface MediaStoreScanResult {
  scanned: number;
  newItems: number;
  existingCount: number;
  errors: number;
  totalScanned: number;
  added: number;
  skipped: number;
}

export type ScanResult = MediaStoreScanResult;

export class MediaStoreService {
  private static instance: MediaStoreService;
  private isScanning = false;

  public static getInstance(): MediaStoreService {
    if (!MediaStoreService.instance) {
      MediaStoreService.instance = new MediaStoreService();
    }
    return MediaStoreService.instance;
  }

  /**
   * Checks whether the device is Android and native MediaStore observation is supported.
   */
  isSupported(): boolean {
    return Platform.OS === 'android' && mediaObserverService.isSupported();
  }

  /**
   * Checks and requests media and storage permissions across Android 10 to 16.
   */
  async checkAndRequestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    const currentStatus = await permissionService.checkStoragePermission();
    if (currentStatus === 'granted') return true;

    return permissionService.requestStoragePermission(true);
  }

  /**
   * Queries screenshot media items directly from Android MediaStore.
   */
  async queryDeviceScreenshots(limit = 50, offset = 0): Promise<DetectedScreenshotEvent[]> {
    if (!this.isSupported()) return [];
    try {
      return await mediaObserverService.queryScreenshotsPaged(limit, offset);
    } catch (err) {
      loggerService.warn('MediaStore', 'Failed to query device screenshots:', err);
      return [];
    }
  }

  /**
   * Scans Android MediaStore for screenshots across all supported OEM directories
   * (Samsung, Xiaomi/Redmi, OPPO/Realme/OnePlus, Vivo/iQOO, Pixel/Motorola),
   * generates thumbnails, inserts new items into SQLite, and syncs Zustand stores.
   */
  async scanAndSyncScreenshots(batchLimit = 100): Promise<MediaStoreScanResult> {
    if (this.isScanning) {
      loggerService.debug('MediaStore', 'Scan already in progress, skipping redundant run.');
      const allScreenshots = await screenshotRepository.getAllScreenshots();
      return {
        scanned: 0,
        newItems: 0,
        existingCount: allScreenshots.length,
        errors: 0,
        totalScanned: 0,
        added: 0,
        skipped: 0,
      };
    }

    this.isScanning = true;
    let scanned = 0;
    let newItems = 0;
    let errors = 0;

    try {
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) {
        loggerService.warn('MediaStore', 'Cannot scan MediaStore: permission denied.');
        const all = await screenshotRepository.getAllScreenshots();
        return {
          scanned: 0,
          newItems: 0,
          existingCount: all.length,
          errors: 0,
          totalScanned: 0,
          added: 0,
          skipped: 0,
        };
      }

      loggerService.info('MediaStore', `Beginning MediaStore scan (batch size: ${batchLimit})...`);
      const detected = await this.queryDeviceScreenshots(batchLimit, 0);
      scanned = detected.length;

      for (const item of detected) {
        try {
          const deviceAssetId = item.deviceAssetId || (item as any).id || '';
          const filePath = item.filePath || '';
          const contentUri =
            item.uri ||
            (item as any).contentUri ||
            (deviceAssetId && /^\d+$/.test(deviceAssetId)
              ? `content://media/external/images/media/${deviceAssetId}`
              : undefined);

          const fileName = item.fileName || (item as any).displayName || FileUtils.getFileName(filePath);
          const fileSize = item.fileSize || (item as any).size || 0;
          const timestamp = item.timestamp || (item as any).dateTaken || Date.now();
          const fileHash =
            item.fileHash || FileUtils.generateFallbackSHA256(filePath, fileSize, timestamp);

          // 1. Check if already exists in SQLite
          const exists = await screenshotRepository.hasScreenshot(deviceAssetId, filePath);
          if (exists) {
            continue;
          }

          // 2. Pre-generate or resolve thumbnail
          let thumbnailUri: string | undefined;
          try {
            const thumb = await thumbnailService.getOrCreateThumbnail(contentUri || filePath, 300);
            if (thumb) thumbnailUri = thumb;
          } catch (e) {
            thumbnailUri = contentUri || MediaStorePathResolver.normalizeFileUri(filePath) || undefined;
          }

          const screenshotId = uuidv4();
          const width = item.width || 1080;
          const height = item.height || 2400;
          const capturedAt = new Date(timestamp).toISOString();

          // 3. Insert into SQLite screenshots table
          const model: ScreenshotModel = {
            id: screenshotId,
            deviceAssetId,
            filePath,
            localPath: filePath,
            contentUri,
            thumbnailUri,
            fileName,
            createdAt: capturedAt,
            createdOn: capturedAt,
            width,
            height,
            fileSize,
            mimeType: item.mimeType || 'image/png',
            categoryId: 'unsorted',
            categoryName: 'Unsorted',
            subcategory: 'General',
            confidence: 0.5,
            isFavorite: false,
            isReviewed: false,
            isSynced: false,
            ocrStatus: 'none',
            tags: [],
            lastScannedAt: new Date().toISOString(),
          };

          await screenshotRepository.insertScreenshot(model);

          // 4. Also store in pending_screenshots for background OCR processing
          const pendingItem: PendingScreenshot = {
            id: screenshotId,
            deviceAssetId,
            filePath,
            localPath: filePath,
            contentUri,
            thumbnailUri,
            fileName,
            fileSize,
            fileHash,
            capturedAt,
            status: 'Pending',
            retryCount: 0,
            deviceFolder: item.deviceFolder || 'Screenshots',
            mimeType: item.mimeType || 'image/png',
            resolution: `${width}x${height}`,
            width,
            height,
            ocrStatus: 'Pending',
            ocrProcessingTime: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await pendingScreenshotRepository.insertPending(pendingItem);

          newItems++;
        } catch (itemErr) {
          errors++;
          loggerService.warn('MediaStore', 'Error processing single MediaStore item:', itemErr);
        }
      }

      // 5. Update category counts and Zustand store
      if (newItems > 0) {
        await categoryRepository.updateAllAncestorCounts('unsorted');
        await useCategoryStore.getState().loadCategories();
      }

      const allScreenshots = await screenshotRepository.getAllScreenshots();
      useScreenshotStore.getState().setScreenshots(allScreenshots);

      loggerService.info(
        'MediaStore',
        `MediaStore scan complete. Scanned: ${scanned}, New: ${newItems}, Total in DB: ${allScreenshots.length}`
      );

      return {
        scanned,
        newItems,
        existingCount: allScreenshots.length,
        errors,
        totalScanned: scanned,
        added: newItems,
        skipped: Math.max(0, scanned - newItems),
      };
    } catch (scanErr) {
      loggerService.error('MediaStore', 'Fatal error during MediaStore scan:', scanErr);
      const all = await screenshotRepository.getAllScreenshots();
      return {
        scanned,
        newItems,
        existingCount: all.length,
        errors: errors + 1,
        totalScanned: scanned,
        added: newItems,
        skipped: Math.max(0, scanned - newItems),
      };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Returns current MediaStore stats for Diagnostics.
   */
  async getMediaStoreStats(): Promise<{ totalDetected: number; mediaStoreAvailable: boolean }> {
    if (!this.isSupported()) {
      return { totalDetected: 0, mediaStoreAvailable: false };
    }

    try {
      const items = await this.queryDeviceScreenshots(500, 0);
      return {
        totalDetected: items.length,
        mediaStoreAvailable: true,
      };
    } catch {
      return { totalDetected: 0, mediaStoreAvailable: false };
    }
  }
}

export const mediaStoreService = MediaStoreService.getInstance();

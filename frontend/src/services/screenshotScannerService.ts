import { v4 as uuidv4 } from 'uuid';
import { ScreenshotModel } from '../models';
import { FileUtils } from '../utils/fileUtils';
import { visionAIService } from './visionAIService';
import { notificationService } from './notificationService';
import { useScreenshotStore } from '../store/screenshot.store';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { smartFolderClassificationService } from './SmartFolderClassificationService';
import { mediaObserverService } from './backgroundDetection/mediaObserver';

export interface DiscoveredMediaAsset {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  createdAt: string;
}

export class ScreenshotScannerService {
  private processedHashes = new Set<string>();
  private processedAssetIds = new Set<string>();

  public isAlreadyProcessed(assetId: string, filePath: string, fileSize: number, timestamp: number): boolean {
    if (this.processedAssetIds.has(assetId)) return true;
    const hash = FileUtils.generateCompositeHash(filePath, fileSize, timestamp);
    if (this.processedHashes.has(hash)) return true;
    return false;
  }

  public markProcessed(assetId: string, filePath: string, fileSize: number, timestamp: number) {
    this.processedAssetIds.add(assetId);
    const hash = FileUtils.generateCompositeHash(filePath, fileSize, timestamp);
    this.processedHashes.add(hash);
  }

  /**
   * Offline-First Hybrid Pipeline:
   * 1. On-device Google ML Kit OCR extracts text directly on phone (~150ms, 100% offline, free).
   * 2. 5-Tier Rule Engine immediately classifies screenshot into Smart Folder (Finance, Travel, Food Delivery, etc.).
   * 3. Record is saved into SQLite with matched category (confidence >= 0.85).
   * 4. Asynchronous Local Qwen2.5-VL-3B enrichment (if server connected) for summaries and entity extraction.
   */
  async processScreenshotAsset(asset: DiscoveredMediaAsset): Promise<ScreenshotModel | null> {
    const timestamp = new Date(asset.createdAt).getTime() || Date.now();
    if (this.isAlreadyProcessed(asset.id, asset.filePath, asset.fileSize, timestamp)) {
      return null;
    }
    this.markProcessed(asset.id, asset.filePath, asset.fileSize, timestamp);

    const screenshotId = uuidv4();

    // 1. Initial Screenshot Record in SQLite
    const initialScreenshot: ScreenshotModel = {
      id: screenshotId,
      deviceAssetId: asset.id,
      filePath: asset.filePath,
      localPath: asset.filePath,
      fileName: asset.fileName,
      createdAt: asset.createdAt,
      createdOn: asset.createdAt,
      width: asset.width || 1080,
      height: asset.height || 2400,
      fileSize: asset.fileSize,
      categoryId: 'unsorted',
      categoryName: 'Unsorted',
      subcategory: '',
      confidence: 0.0,
      isAutoCategorized: true,
      isFavorite: false,
      isReviewed: false,
      isSynced: false,
      ocrStatus: 'processing',
      analysisStatus: 'Processing',
      classificationSource: 'local',
      tags: [],
      lastScannedAt: new Date().toISOString(),
    };

    try {
      await screenshotRepository.insertScreenshot(initialScreenshot);
    } catch {}
    useScreenshotStore.getState().addOrUpdateScreenshot(initialScreenshot);

    // 2. On-Device Google ML Kit OCR (100% Offline, ~150ms)
    let ocrText = '';
    try {
      const ocrResult = await mediaObserverService.recognizeText(asset.filePath);
      if (ocrResult && ocrResult.text && ocrResult.text.trim().length > 0) {
        ocrText = ocrResult.text.trim();
        console.log(
          `[ScreenshotScannerService] On-device ML Kit OCR extracted ${ocrText.length} chars (${ocrResult.blockCount} blocks) for ${asset.fileName}`
        );
      }
    } catch (ocrErr: any) {
      console.warn('[ScreenshotScannerService] On-device OCR error:', ocrErr?.message || ocrErr);
    }

    // 3. Smart Folder 5-Tier Classification & Auto-Organization
    const organizedScreenshot = await smartFolderClassificationService.assignScreenshotToSmartFolder({
      screenshotId,
      fileName: asset.fileName,
      filePath: asset.filePath,
      localPath: asset.filePath,
      ocrText,
      fileSize: asset.fileSize,
      forceRefresh: true,
    });

    console.log(
      `[ScreenshotScannerService] Screenshot ${asset.fileName} organized into "${organizedScreenshot.categoryName}" (confidence: ${organizedScreenshot.confidence})`
    );

    // 4. Notification
    await notificationService.showScreenshotOrganizedNotification({
      categoryName: organizedScreenshot.categoryName,
      subcategory: organizedScreenshot.subcategory || 'General',
      fileName: asset.fileName,
    });

    // 5. Asynchronous Local AI Qwen Enrichment (non-blocking)
    visionAIService
      .analyzeScreenshot({
        screenshotId,
        filePath: asset.filePath,
        fileName: asset.fileName,
        imageDimensions: { width: asset.width, height: asset.height },
      })
      .then(async (visionRes) => {
        if (visionRes.isSuccess && visionRes.data) {
          console.log(
            `[ScreenshotScannerService] Local Qwen enrichment complete for ${asset.fileName}: ${visionRes.data.summary}`
          );
          await smartFolderClassificationService.assignScreenshotToSmartFolder({
            screenshotId,
            fileName: asset.fileName,
            filePath: asset.filePath,
            localPath: asset.filePath,
            ocrText: visionRes.data.ocr_text || ocrText,
            fileSize: asset.fileSize,
            forceRefresh: false, // Respect manual or confident classification
          });
        }
      })
      .catch((err) => {
        // Safe to ignore if local vision server is offline
        console.log('[ScreenshotScannerService] Local Qwen enrichment skipped (offline or busy):', err?.message);
      });

    return organizedScreenshot;
  }
}

export const screenshotScannerService = new ScreenshotScannerService();

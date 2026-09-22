import { v4 as uuidv4 } from 'uuid';
import { ScreenshotModel } from '../models';
import { FileUtils } from '../utils/fileUtils';
import { visionAIService } from './visionAIService';
import { notificationService } from './notificationService';
import { useScreenshotStore } from '../store/screenshot.store';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { smartFolderClassificationService } from './SmartFolderClassificationService';

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
   * Processes a discovered screenshot asset directly through the Vision AI Pipeline (Sprint P2-C).
   * Completely bypasses legacy OCR, streaming straight to Vision AI for full multimodal understanding.
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
      classificationSource: 'vision_ai',
      tags: [],
      lastScannedAt: new Date().toISOString(),
    };

    try {
      await screenshotRepository.insertScreenshot(initialScreenshot);
    } catch {}
    useScreenshotStore.getState().addOrUpdateScreenshot(initialScreenshot);

    // 2. Vision AI Processing
    let ocrText = '';
    const visionRes = await visionAIService.analyzeScreenshot({
      screenshotId,
      filePath: asset.filePath,
      fileName: asset.fileName,
      imageDimensions: { width: asset.width, height: asset.height },
    });

    if (visionRes.isSuccess && visionRes.data) {
      ocrText = visionRes.data.ocr_text;
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

    // 4. Notification
    await notificationService.showScreenshotOrganizedNotification({
      categoryName: organizedScreenshot.categoryName,
      subcategory: organizedScreenshot.subcategory || 'General',
      fileName: asset.fileName,
    });

    return organizedScreenshot;
  }
}

export const screenshotScannerService = new ScreenshotScannerService();

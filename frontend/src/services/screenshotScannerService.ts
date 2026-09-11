import { v4 as uuidv4 } from 'uuid';
import { ScreenshotModel } from '../models';
import { FileUtils } from '../utils/fileUtils';
import { ocrService } from './ocrService';
import { classificationService } from './classificationService';
import { notificationService } from './notificationService';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { categoryRepository } from '../database/repositories/categoryRepository';

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

  async processScreenshotAsset(asset: DiscoveredMediaAsset): Promise<ScreenshotModel | null> {
    const timestamp = new Date(asset.createdAt).getTime() || Date.now();
    if (this.isAlreadyProcessed(asset.id, asset.filePath, asset.fileSize, timestamp)) {
      return null;
    }
    this.markProcessed(asset.id, asset.filePath, asset.fileSize, timestamp);

    const screenshotId = uuidv4();

    // 1. Initial Model
    const initialScreenshot: ScreenshotModel = {
      id: screenshotId,
      deviceAssetId: asset.id,
      filePath: asset.filePath,
      fileName: asset.fileName,
      createdAt: asset.createdAt,
      width: asset.width || 1080,
      height: asset.height || 2400,
      fileSize: asset.fileSize,
      categoryId: 'unsorted',
      categoryName: 'Unsorted',
      subcategory: '',
      confidence: 0.0,
      isFavorite: false,
      isReviewed: false,
      isSynced: false,
      ocrStatus: 'processing',
      tags: [],
      lastScannedAt: new Date().toISOString(),
    };

    useScreenshotStore.getState().addOrUpdateScreenshot(initialScreenshot);

    // 2. OCR Step
    let ocrText = '';
    let ocrConfidence = 0.85;
    const ocrRes = await ocrService.extractText(screenshotId, asset.filePath);
    if (ocrRes.isSuccess && ocrRes.data) {
      ocrText = ocrRes.data.rawText;
      ocrConfidence = ocrRes.data.confidence;
    }

    // 3. Classification Step
    const classRes = await classificationService.classifyScreenshot({
      screenshotId,
      fileName: asset.fileName,
      filePath: asset.filePath,
      ocrText,
    });

    let targetCatId = 'unsorted';
    let targetCatName = 'Unsorted';
    let subcategory = 'General';
    let confidence = ocrConfidence;
    const tags: any[] = [];

    if (classRes.isSuccess && classRes.data) {
      targetCatId = classRes.data.categoryId;
      targetCatName = classRes.data.categoryName;
      subcategory = classRes.data.subcategory;
      confidence = classRes.data.confidence;

      classRes.data.suggestedTags.forEach((t) => {
        tags.push({
          id: `tag_${t.toLowerCase().replace(/\s+/g, '_')}`,
          name: t,
          colorHex: '6366F1',
        });
      });
    }

    // 4. Update Model
    const organizedScreenshot: ScreenshotModel = {
      ...initialScreenshot,
      categoryId: targetCatId,
      categoryName: targetCatName,
      subcategory,
      confidence,
      ocrText,
      ocrStatus: 'completed',
      isReviewed: confidence >= 0.85,
      isSynced: true,
      tags,
    };

    useScreenshotStore.getState().addOrUpdateScreenshot(organizedScreenshot);

    // Refresh Category and ancestor counts in SQLite & Store
    await categoryRepository.updateAllAncestorCounts(targetCatId);
    await useCategoryStore.getState().loadCategories();

    // 5. Notification
    await notificationService.showScreenshotOrganizedNotification({
      categoryName: targetCatName,
      subcategory,
      fileName: asset.fileName,
    });

    return organizedScreenshot;
  }
}

export const screenshotScannerService = new ScreenshotScannerService();

import { databaseService } from '../database';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { visionRepository } from '../database/repositories/VisionRepository';
import { classificationCacheRepository } from '../database/repositories/classificationCacheRepository';
import { tagRepository } from '../database/repositories/tagRepository';
import { folderContextRepository } from '../database/repositories/folderContextRepository';
import { pendingScreenshotRepository } from '../database/repositories/pendingScreenshotRepository';
import { CategoryModel, ScreenshotModel } from '../models';
import { useCategoryStore } from '../store/category.store';
import { useScreenshotStore } from '../store/screenshot.store';
import { searchIndexService } from './searchIndexService';
import {
  SmartFolderRules,
  CanonicalCategoryId,
  ClassificationRuleResult,
} from './smartFolders/SmartFolderRules';
import { SmartFolderTagExtractor } from './smartFolders/SmartFolderTagExtractor';
import {
  memoryTimelineService,
  dailyDigestService,
  memoryInsightsService,
} from './memory';

export type SmartFolderCategory =
  | 'Finance'
  | 'Shopping'
  | 'Food Delivery'
  | 'Chats'
  | 'Social Media'
  | 'Travel'
  | 'Health'
  | 'Education'
  | 'Work'
  | 'Documents'
  | 'Entertainment'
  | 'Utilities'
  | 'Other';

export interface SmartFolderClassificationResult {
  category: SmartFolderCategory;
  folderId: string;
  folderName: string;
  subcategory: string;
  folderHierarchy: string[];
  confidence: number;
  matchedTier: 'vision' | 'entity' | 'ocr' | 'app' | 'filename' | 'fallback';
  tags: string[];
  suggestedIcon: string;
  suggestedColor: string;
}

export interface ScreenshotClassificationInput {
  screenshotId: string;
  fileName: string;
  filePath: string;
  localPath?: string;
  contentUri?: string;
  thumbnailUri?: string;
  fileSize?: number;
  ocrText?: string;
  deviceFolder?: string;
  sourceApp?: string;
  detectedApp?: string;
  forceRefresh?: boolean;
}

export interface BatchClassifyOptions {
  onProgress?: (processed: number, total: number) => void;
  shouldCancel?: () => boolean;
  skipAlreadyClassified?: boolean;
}

export class SmartFolderClassificationService {
  private static instance: SmartFolderClassificationService | null = null;

  static getInstance(): SmartFolderClassificationService {
    if (!SmartFolderClassificationService.instance) {
      SmartFolderClassificationService.instance = new SmartFolderClassificationService();
    }
    return SmartFolderClassificationService.instance;
  }

  /**
   * 5-Tier Hybrid Classification Engine:
   * 1. Vision AI category
   * 2. Extracted entities
   * 3. OCR keywords
   * 4. App signatures
   * 5. Filename heuristics
   */
  async classify(input: {
    screenshotId: string;
    fileName: string;
    ocrText?: string;
    sourceApp?: string;
    detectedApp?: string;
    deviceFolder?: string;
  }): Promise<SmartFolderClassificationResult> {
    // 1. Fetch cached Vision AI metadata if available in SQLite
    let visionMetadata: any = undefined;
    try {
      const visionResult = await visionRepository.getVisionResult(input.screenshotId);
      if (visionResult) {
        let entities = {};
        let tags: string[] = [];
        try {
          entities = JSON.parse(visionResult.detected_entities || '{}');
        } catch {}
        try {
          tags = JSON.parse(visionResult.detected_objects || '[]');
        } catch {}

        visionMetadata = {
          category: visionResult.screen_type,
          screen_type: visionResult.screen_type,
          confidence: visionResult.confidence,
          summary: visionResult.summary,
          application_name: visionResult.application_name,
          entities,
          tags,
        };
      }
    } catch (err) {
      console.warn('[SmartFolderClassificationService] Error loading vision cache:', err);
    }

    // 2. Evaluate 5-Tier Deterministic Rules
    const ruleResult: ClassificationRuleResult = SmartFolderRules.evaluateRules({
      screenshotId: input.screenshotId,
      fileName: input.fileName,
      ocrText: input.ocrText,
      sourceApp: input.sourceApp,
      detectedApp: input.detectedApp,
      deviceFolder: input.deviceFolder,
      visionMetadata,
    });

    // 3. Extract comprehensive, deduplicated searchable tags
    const tags = SmartFolderTagExtractor.extractTags({
      ocrText: input.ocrText,
      fileName: input.fileName,
      visionMetadata,
      extraKeywords: [
        ruleResult.categoryId,
        ruleResult.categoryName.toLowerCase(),
        ruleResult.subcategory.toLowerCase(),
      ],
    });

    return {
      category: ruleResult.categoryName as SmartFolderCategory,
      folderId: ruleResult.categoryId,
      folderName: ruleResult.categoryName,
      subcategory: ruleResult.subcategory,
      folderHierarchy: ruleResult.folderHierarchy,
      confidence: ruleResult.confidence,
      matchedTier: ruleResult.matchedTier,
      tags,
      suggestedIcon: ruleResult.suggestedIcon,
      suggestedColor: ruleResult.suggestedColor,
    };
  }

  /**
   * Automatically classifies and assigns a screenshot into its Smart Folder in SQLite.
   * Respects manual overrides: if screenshot was moved or manually categorized by user,
   * it will NEVER be overwritten unless forceRefresh is true.
   */
  async assignScreenshotToSmartFolder(input: ScreenshotClassificationInput): Promise<ScreenshotModel> {
    const existing = await screenshotRepository.getScreenshotById(input.screenshotId);

    // Manual Override Protection
    if (
      existing &&
      existing.classificationSource === 'manual' &&
      existing.categoryId !== 'unsorted' &&
      !input.forceRefresh
    ) {
      return existing;
    }

    // Execute 5-tier hybrid classification
    const classification = await this.classify({
      screenshotId: input.screenshotId,
      fileName: input.fileName,
      ocrText: input.ocrText,
      sourceApp: input.sourceApp,
      detectedApp: input.detectedApp,
      deviceFolder: input.deviceFolder,
    });

    // Create or find dynamic category hierarchy in SQLite
    const assignedCategory = await categoryRepository.createNestedCategoryHierarchy(
      classification.folderHierarchy,
      classification.suggestedIcon,
      classification.suggestedColor
    );

    // Prepare search keywords
    const searchResult = searchIndexService.prepareIndex(input.ocrText || '');
    const combinedKeywords = Array.from(
      new Set([
        ...classification.tags,
        ...classification.folderHierarchy.map((h) => h.toLowerCase()),
        ...searchResult.keywords,
      ])
    );

    const deviceAssetId = existing?.deviceAssetId || '';
    const localPath = input.localPath || input.filePath || existing?.localPath || existing?.filePath || '';
    const contentUri =
      input.contentUri ||
      existing?.contentUri ||
      (deviceAssetId && /^\d+$/.test(deviceAssetId)
        ? `content://media/external/images/media/${deviceAssetId}`
        : undefined);
    const thumbnailUri = input.thumbnailUri || existing?.thumbnailUri;

    const source =
      classification.matchedTier === 'vision' || classification.matchedTier === 'entity'
        ? 'vision_ai'
        : 'local';

    const screenshotModel: ScreenshotModel = {
      id: input.screenshotId,
      deviceAssetId,
      filePath: input.filePath,
      localPath,
      contentUri,
      thumbnailUri,
      fileName: input.fileName,
      createdAt: existing?.createdAt || new Date().toISOString(),
      createdOn: existing?.createdOn || new Date().toISOString(),
      width: existing?.width || 1080,
      height: existing?.height || 2400,
      fileSize: input.fileSize || existing?.fileSize || 0,
      mimeType: existing?.mimeType || 'image/jpeg',
      categoryId: assignedCategory.id,
      folderId: assignedCategory.id,
      categoryName: assignedCategory.name,
      subcategory: classification.subcategory,
      confidence: classification.confidence,
      classificationSource: source,
      isAutoCategorized: true,
      isFavorite: existing?.isFavorite || false,
      isReviewed: classification.confidence >= 0.85,
      isSynced: false,
      ocrStatus: existing?.ocrStatus || (input.ocrText ? 'completed' : 'none'),
      ocrText: input.ocrText || existing?.ocrText,
      keywords: combinedKeywords,
      folderPath: classification.folderHierarchy,
      tags: combinedKeywords.slice(0, 5).map((kw) => ({
        id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
        name: kw,
        colorHex: classification.suggestedColor,
      })),
      lastScannedAt: new Date().toISOString(),
    };

    // Save locally to SQLite
    await screenshotRepository.insertScreenshot(screenshotModel);

    // Save classification cache
    try {
      await classificationCacheRepository.setCache({
        id: `c_${screenshotModel.id}`,
        screenshotId: screenshotModel.id,
        category: assignedCategory.name,
        subcategory: classification.subcategory,
        tagsJson: JSON.stringify(combinedKeywords.slice(0, 5)),
        entitiesJson: '{}',
        confidence: classification.confidence,
        summary: `Classified into ${assignedCategory.name}`,
        source: source === 'vision_ai' ? 'vision_ai' : 'backend',
        cachedAt: new Date().toISOString(),
      });
    } catch {}

    // Save tags and link to screenshot
    if (screenshotModel.tags && screenshotModel.tags.length > 0) {
      for (const t of screenshotModel.tags) {
        try {
          await tagRepository.addTag(t);
          await tagRepository.linkScreenshotTag(screenshotModel.id, t.id);
        } catch {}
      }
    }

    // Upsert folder context
    try {
      await folderContextRepository.upsertFolderContext({
        FolderId: assignedCategory.id,
        Summary: `Smart folder for ${assignedCategory.name} containing ${classification.subcategory || 'screenshots'}`,
        EntitiesJson: '{}',
        TasksJson: '[]',
        UpdatedOn: new Date().toISOString(),
        Version: 1,
      });
    } catch {}

    // Update ancestor counts & folder counts
    await categoryRepository.updateAllAncestorCounts(assignedCategory.id);
    if (classification.folderId && classification.folderId !== assignedCategory.id) {
      await categoryRepository.updateFolderCounts(classification.folderId);
    }
    await categoryRepository.updateFolderCounts(assignedCategory.id);
    await categoryRepository.updateScreenshotCount('unsorted');

    // Update pending screenshot status
    try {
      await pendingScreenshotRepository.updateStatus(input.screenshotId, 'Completed');
    } catch {}

    // Sync Zustand stores immediately
    useScreenshotStore.getState().addOrUpdateScreenshot(screenshotModel);
    const allCategories = await categoryRepository.getAllCategories();
    useCategoryStore.getState().setCategories(allCategories);

    // Update Memory Timeline, Daily Digest & Memory Insights
    try {
      await memoryTimelineService.addScreenshotToTimeline(screenshotModel);
      await dailyDigestService.updateDailyDigest(screenshotModel.createdAt);
      await memoryInsightsService.refreshMemoryInsights();
    } catch (memErr) {
      console.warn('[SmartFolderClassificationService] Error updating timeline/digests/insights:', memErr);
    }

    return screenshotModel;
  }

  /**
   * Alias for assignScreenshotToSmartFolder.
   */
  async classifyScreenshot(input: ScreenshotClassificationInput): Promise<ScreenshotModel> {
    return this.assignScreenshotToSmartFolder(input);
  }

  /**
   * Restores AI classification on a manually overridden screenshot.
   */
  async restoreAIClassification(screenshotId: string): Promise<ScreenshotModel | null> {
    const existing = await screenshotRepository.getScreenshotById(screenshotId);
    if (!existing) return null;

    return this.assignScreenshotToSmartFolder({
      screenshotId: existing.id,
      fileName: existing.fileName,
      filePath: existing.filePath,
      localPath: existing.localPath,
      contentUri: existing.contentUri,
      thumbnailUri: existing.thumbnailUri,
      ocrText: existing.ocrText,
      fileSize: existing.fileSize,
      forceRefresh: true,
    });
  }

  /**
   * Batch organizes a list of screenshots sequentially (Concurrency = 1).
   * Supports progress notification, cancellation, and manual override protection.
   */
  async classifyBatch(
    screenshots: ScreenshotModel[],
    options?: BatchClassifyOptions
  ): Promise<{ processed: number; moved: number }> {
    let moved = 0;
    let processed = 0;

    for (let i = 0; i < screenshots.length; i++) {
      if (options?.shouldCancel?.()) {
        break;
      }

      const sc = screenshots[i];

      // Skip manual overrides
      if (
        sc.classificationSource === 'manual' &&
        sc.categoryId !== 'unsorted'
      ) {
        processed++;
        options?.onProgress?.(processed, screenshots.length);
        continue;
      }

      // Skip already classified if requested
      if (
        options?.skipAlreadyClassified &&
        sc.categoryId &&
        sc.categoryId !== 'unsorted' &&
        sc.confidence &&
        sc.confidence >= 0.85
      ) {
        processed++;
        options?.onProgress?.(processed, screenshots.length);
        continue;
      }

      const beforeFolder = sc.categoryId;
      const updated = await this.assignScreenshotToSmartFolder({
        screenshotId: sc.id,
        fileName: sc.fileName,
        filePath: sc.filePath,
        localPath: sc.localPath,
        contentUri: sc.contentUri,
        thumbnailUri: sc.thumbnailUri,
        ocrText: sc.ocrText,
        fileSize: sc.fileSize,
        deviceFolder: sc.sourceApp,
      });

      if (updated.categoryId !== beforeFolder) {
        moved++;
      }

      processed++;
      options?.onProgress?.(processed, screenshots.length);
    }

    return { processed, moved };
  }
}

export const smartFolderClassificationService = SmartFolderClassificationService.getInstance();

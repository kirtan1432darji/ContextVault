import { categoryRepository } from '../database/repositories/categoryRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { CategoryModel, ScreenshotModel } from '../models';
import { useCategoryStore } from '../store/category.store';
import { useScreenshotStore } from '../store/screenshot.store';
import { smartFolderClassificationService } from './SmartFolderClassificationService';
import { SmartFolderRules } from './smartFolders/SmartFolderRules';
import { SmartFolderTagExtractor } from './smartFolders/SmartFolderTagExtractor';

export interface SmartFolderClassificationResult {
  categoryName: string;
  subcategory: string;
  folderHierarchy: string[]; // e.g. ['Projects', 'NHDC', 'Payroll']
  confidence: number;
  tags: string[];
  suggestedIcon: string;
  suggestedColor: string;
}

export interface ScreenshotAssignmentPayload {
  screenshotId: string;
  deviceAssetId?: string;
  fileName: string;
  filePath: string;
  localPath?: string;
  contentUri?: string;
  thumbnailUri?: string;
  ocrText: string;
  deviceFolder?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
}

export class SmartFolderService {
  /**
   * Evaluates offline rule heuristics on OCR text and file metadata
   * to determine the exact dynamic category and subfolder hierarchy.
   */
  classifyScreenshot(payload: {
    fileName: string;
    filePath: string;
    ocrText: string;
    deviceFolder?: string;
  }): SmartFolderClassificationResult {
    const raw = payload.ocrText || '';
    const text = raw.toLowerCase();
    const name = payload.fileName.toLowerCase();

    // Check project payroll rule
    const isPayroll =
      text.includes('payroll') ||
      text.includes('payslip') ||
      text.includes('salary slip') ||
      text.includes('net salary') ||
      name.includes('payroll') ||
      name.includes('salary');

    if (isPayroll) {
      return {
        categoryName: 'Work',
        subcategory: 'Payroll',
        folderHierarchy: ['Work', 'Payroll'],
        confidence: 0.96,
        tags: ['payroll', 'salary', 'work'],
        suggestedIcon: 'briefcase-outline',
        suggestedColor: '6366F1',
      };
    }

    const ruleResult = SmartFolderRules.evaluateRules({
      fileName: payload.fileName,
      ocrText: payload.ocrText,
      deviceFolder: payload.deviceFolder,
    });

    const tags = SmartFolderTagExtractor.extractTags({
      fileName: payload.fileName,
      ocrText: payload.ocrText,
      extraKeywords: [ruleResult.categoryId, ruleResult.categoryName.toLowerCase(), ruleResult.subcategory.toLowerCase()],
    });

    return {
      categoryName: ruleResult.categoryName,
      subcategory: ruleResult.subcategory,
      folderHierarchy: ruleResult.folderHierarchy,
      confidence: ruleResult.confidence,
      tags,
      suggestedIcon: ruleResult.suggestedIcon,
      suggestedColor: ruleResult.suggestedColor,
    };
  }

  /**
   * Full pipeline to assign a screenshot to a dynamic smart folder:
   * 1. Classifies OCR text
   * 2. Resolves or dynamically creates nested category hierarchy in SQLite
   * 3. Updates Screenshot record in SQLite
   * 4. Updates Category screenshot counts
   * 5. Syncs Zustand stores
   */
  async assignScreenshotToSmartFolder(
    payload: ScreenshotAssignmentPayload
  ): Promise<ScreenshotModel> {
    return smartFolderClassificationService.assignScreenshotToSmartFolder({
      screenshotId: payload.screenshotId,
      fileName: payload.fileName,
      filePath: payload.filePath,
      localPath: payload.localPath,
      contentUri: payload.contentUri,
      thumbnailUri: payload.thumbnailUri,
      ocrText: payload.ocrText,
      deviceFolder: payload.deviceFolder,
      fileSize: payload.fileSize,
    });
  }

  /**
   * Reorganizes all currently unsorted screenshots locally using on-device Google ML Kit OCR.
   * Handles large photo libraries (e.g. 1,400+ screenshots).
   */
  async organizeAllUnsorted(): Promise<number> {
    const unsortedList = await screenshotRepository.getAllScreenshots({ categoryId: 'unsorted', limit: 10000 });
    const reviewList = await screenshotRepository.getAllScreenshots({ needsReview: true, limit: 10000 });

    // Deduplicate screenshots by ID
    const map = new Map<string, ScreenshotModel>();
    for (const sc of [...unsortedList, ...reviewList]) {
      if (!map.has(sc.id)) {
        map.set(sc.id, sc);
      }
    }
    const toOrganize = Array.from(map.values());

    console.log(`[SmartFolderService] Batch organizing ${toOrganize.length} unsorted/unclassified screenshots...`);
    const result = await smartFolderClassificationService.classifyBatch(toOrganize);
    return result.moved;
  }

  /**
   * Moves a screenshot manually to another folder.
   */
  async moveScreenshot(
    screenshotId: string,
    targetCategoryId: string,
    targetSubcategory?: string
  ): Promise<void> {
    const targetCat = await categoryRepository.getCategoryById(targetCategoryId);
    if (!targetCat) return;

    const existing = await screenshotRepository.getScreenshotById(screenshotId);
    if (!existing) return;

    const oldCategoryId = existing.categoryId;

    const updated: ScreenshotModel = {
      ...existing,
      categoryId: targetCat.id,
      categoryName: targetCat.name,
      subcategory: targetSubcategory || targetCat.name,
      isAutoCategorized: false, // marked as user manual move
    };

    await screenshotRepository.updateScreenshot(updated);
    useScreenshotStore.getState().addOrUpdateScreenshot(updated);

    // Update counts
    await categoryRepository.updateScreenshotCount(targetCat.id);
    if (oldCategoryId) {
      await categoryRepository.updateScreenshotCount(oldCategoryId);
    }

    const allCategories = await categoryRepository.getAllCategories();
    useCategoryStore.getState().setCategories(allCategories);
  }

  /**
   * Moves multiple screenshots in bulk to a destination smart folder.
   */
  async bulkMoveScreenshots(
    screenshotIds: string[],
    targetCategoryId: string,
    targetSubcategory?: string
  ): Promise<number> {
    if (!screenshotIds || screenshotIds.length === 0) return 0;
    const targetCat = await categoryRepository.getCategoryById(targetCategoryId);
    if (!targetCat) return 0;

    const oldCategoryIds = new Set<string>();
    let movedCount = 0;

    for (const id of screenshotIds) {
      const existing = await screenshotRepository.getScreenshotById(id);
      if (!existing) continue;

      if (existing.categoryId) {
        oldCategoryIds.add(existing.categoryId);
      }

      const updated: ScreenshotModel = {
        ...existing,
        categoryId: targetCat.id,
        categoryName: targetCat.name,
        subcategory: targetSubcategory || targetCat.name,
        isAutoCategorized: false,
      };

      await screenshotRepository.updateScreenshot(updated);
      useScreenshotStore.getState().addOrUpdateScreenshot(updated);
      movedCount++;
    }

    // Update counts for target and all old categories
    await categoryRepository.updateScreenshotCount(targetCat.id);
    for (const oldCatId of oldCategoryIds) {
      if (oldCatId !== targetCat.id) {
        await categoryRepository.updateScreenshotCount(oldCatId);
      }
    }

    const allCategories = await categoryRepository.getAllCategories();
    useCategoryStore.getState().setCategories(allCategories);
    return movedCount;
  }

  /**
   * Overrides AI classification for a screenshot manually.
   * Updates category, subcategory, confidence to 1.0, tags, marks isAutoCategorized=false,
   * clears review requirement (isReviewed=true), and recalculates category counts.
   */
  async reclassifyScreenshot(params: {
    screenshotId: string;
    targetCategoryId: string;
    targetSubcategory?: string;
    tags?: string[];
  }): Promise<ScreenshotModel | null> {
    const { screenshotId, targetCategoryId, targetSubcategory, tags } = params;
    const targetCat = await categoryRepository.getCategoryById(targetCategoryId);
    if (!targetCat) return null;

    const existing = await screenshotRepository.getScreenshotById(screenshotId);
    if (!existing) return null;

    const oldCategoryId = existing.categoryId;
    const subcategory = targetSubcategory !== undefined ? targetSubcategory.trim() : existing.subcategory;
    const finalTagsList = tags !== undefined ? tags : (existing.keywords || []);
    const folderPath = [targetCat.name, subcategory].filter(Boolean);

    await screenshotRepository.reclassifyScreenshot(
      screenshotId,
      targetCat.id,
      targetCat.name,
      subcategory,
      finalTagsList,
      folderPath
    );

    const updatedTags = finalTagsList.slice(0, 10).map((kw) => ({
      id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
      name: kw,
      colorHex: '#6366F1',
    }));

    const updated: ScreenshotModel = {
      ...existing,
      categoryId: targetCat.id,
      categoryName: targetCat.name,
      subcategory,
      folderPath,
      confidence: 1.0,
      keywords: finalTagsList,
      tags: updatedTags,
      isAutoCategorized: false,
      isReviewed: true,
      classificationSource: 'manual',
    };

    useScreenshotStore.getState().addOrUpdateScreenshot(updated);

    // Recalculate counts
    await categoryRepository.updateScreenshotCount(targetCat.id);
    if (oldCategoryId && oldCategoryId !== targetCat.id) {
      await categoryRepository.updateScreenshotCount(oldCategoryId);
    }
    const allCategories = await categoryRepository.getAllCategories();
    useCategoryStore.getState().setCategories(allCategories);

    return updated;
  }
}

export const smartFolderService = new SmartFolderService();

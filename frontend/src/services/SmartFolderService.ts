import { categoryRepository } from '../database/repositories/categoryRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { CategoryModel, ScreenshotModel } from '../models';
import { useCategoryStore } from '../store/category.store';
import { useScreenshotStore } from '../store/screenshot.store';
import { searchIndexService } from './searchIndexService';

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
  fileName: string;
  filePath: string;
  ocrText: string;
  deviceFolder?: string;
  fileSize?: number;
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
    const folder = (payload.deviceFolder || '').toLowerCase();

    // 1. PROJECTS / PAYROLL / CORPORATE (e.g. Projects -> NHDC -> Payroll)
    const isPayroll =
      text.includes('payroll') ||
      text.includes('payslip') ||
      text.includes('salary slip') ||
      text.includes('net salary') ||
      text.includes('earnings & deductions') ||
      text.includes('pf contribution') ||
      text.includes('basic pay') ||
      name.includes('payroll') ||
      name.includes('salary');

    const isProject =
      text.includes('sprint') ||
      text.includes('jira') ||
      text.includes('trello') ||
      text.includes('asana') ||
      text.includes('milestone') ||
      text.includes('architecture blueprint') ||
      text.includes('deliverable') ||
      name.includes('project');

    if (isPayroll || isProject) {
      let org = '';
      const orgMatch = raw.match(/\b(NHDC|TCS|INFOSYS|WIPRO|GOOGLE|META|MICROSOFT|AMAZON|RELIANCE|TATA|ADANI|[A-Z]{3,8})\b/);
      if (orgMatch && !['THE', 'AND', 'FOR', 'ALL', 'NOT', 'YOU', 'ARE'].includes(orgMatch[0])) {
        org = orgMatch[0];
      } else if (text.includes('nhdc') || name.includes('nhdc')) {
        org = 'NHDC';
      }

      const orgFolder = org || 'Work';

      if (isPayroll) {
        return {
          categoryName: 'Projects',
          subcategory: 'Payroll',
          folderHierarchy: ['Projects', orgFolder, 'Payroll'],
          confidence: 0.96,
          tags: ['payroll', 'salary', orgFolder.toLowerCase()],
          suggestedIcon: 'briefcase-outline',
          suggestedColor: '6366F1',
        };
      } else {
        return {
          categoryName: 'Projects',
          subcategory: orgFolder,
          folderHierarchy: ['Projects', orgFolder],
          confidence: 0.94,
          tags: ['project', 'tasks', orgFolder.toLowerCase()],
          suggestedIcon: 'briefcase-outline',
          suggestedColor: '6366F1',
        };
      }
    }

    // 2. FINANCE / PAYMENTS / BANKING (e.g. Finance -> Payments)
    const isPayment =
      text.includes('upi') ||
      text.includes('payment successful') ||
      text.includes('transaction id') ||
      text.includes('paid to') ||
      text.includes('gpay') ||
      text.includes('google pay') ||
      text.includes('phonepe') ||
      text.includes('paytm') ||
      text.includes('razorpay') ||
      text.includes('credit card') ||
      text.includes('debit card') ||
      text.includes('bank transfer') ||
      name.includes('payment') ||
      name.includes('upi');

    const isInvoice =
      text.includes('invoice') ||
      text.includes('billing') ||
      text.includes('tax invoice') ||
      text.includes('gstin') ||
      name.includes('invoice');

    if (isPayment || isInvoice) {
      const sub = isPayment ? 'Payments' : 'Invoices';
      return {
        categoryName: 'Finance',
        subcategory: sub,
        folderHierarchy: ['Finance', sub],
        confidence: 0.95,
        tags: ['finance', sub.toLowerCase(), 'transaction'],
        suggestedIcon: 'wallet-outline',
        suggestedColor: '10B981',
      };
    }

    // 3. SHOPPING (e.g. Shopping -> Shoes)
    const isShoes =
      text.includes('sneaker') ||
      text.includes('shoes') ||
      text.includes('footwear') ||
      text.includes('running shoes') ||
      text.includes('nike') ||
      text.includes('adidas') ||
      text.includes('puma') ||
      name.includes('shoe');

    const isShopping =
      isShoes ||
      text.includes('amazon') ||
      text.includes('flipkart') ||
      text.includes('myntra') ||
      text.includes('order placed') ||
      text.includes('delivery by') ||
      text.includes('items in cart') ||
      text.includes('wishlist') ||
      name.includes('amazon');

    if (isShopping) {
      const sub = isShoes ? 'Shoes' : 'Orders';
      return {
        categoryName: 'Shopping',
        subcategory: sub,
        folderHierarchy: ['Shopping', sub],
        confidence: 0.93,
        tags: ['shopping', sub.toLowerCase()],
        suggestedIcon: 'bag-handle-outline',
        suggestedColor: 'F97316',
      };
    }

    // 4. LEARNING / TUTORIALS (e.g. Learning -> Flutter)
    const isFlutter = text.includes('flutter') || text.includes('dart') || name.includes('flutter');
    const isReact = text.includes('react native') || text.includes('reactjs') || name.includes('react');
    const isLearning =
      isFlutter ||
      isReact ||
      text.includes('course') ||
      text.includes('tutorial') ||
      text.includes('udemy') ||
      text.includes('coursera') ||
      text.includes('documentation') ||
      text.includes('guide') ||
      text.includes('syllabus');

    if (isLearning) {
      const sub = isFlutter ? 'Flutter' : isReact ? 'React' : 'Tutorials';
      return {
        categoryName: 'Learning',
        subcategory: sub,
        folderHierarchy: ['Learning', sub],
        confidence: 0.94,
        tags: ['learning', sub.toLowerCase()],
        suggestedIcon: 'school-outline',
        suggestedColor: '3B82F6',
      };
    }

    // 5. TRAVEL / TICKETS (e.g. Travel -> Flights)
    const isFlight =
      text.includes('flight') ||
      text.includes('boarding pass') ||
      text.includes('airline') ||
      text.includes('indigo') ||
      text.includes('air india') ||
      text.includes('emirates') ||
      text.includes('departure') ||
      text.includes('terminal');

    const isTravel =
      isFlight ||
      text.includes('hotel booking') ||
      text.includes('reservation') ||
      text.includes('airbnb') ||
      text.includes('train ticket') ||
      text.includes('irctc') ||
      name.includes('ticket');

    if (isTravel) {
      const sub = isFlight ? 'Flights' : 'Bookings';
      return {
        categoryName: 'Travel',
        subcategory: sub,
        folderHierarchy: ['Travel', sub],
        confidence: 0.95,
        tags: ['travel', sub.toLowerCase(), 'ticket'],
        suggestedIcon: 'airplane-outline',
        suggestedColor: '06B6D4',
      };
    }

    // 6. TECH / CODE / TERMINAL
    const isTech =
      text.includes('github') ||
      text.includes('console.log') ||
      text.includes('stack trace') ||
      text.includes('api endpoint') ||
      text.includes('error 500') ||
      text.includes('status 200') ||
      name.includes('code') ||
      name.includes('terminal');

    if (isTech) {
      return {
        categoryName: 'Tech',
        subcategory: 'Code',
        folderHierarchy: ['Tech', 'Code'],
        confidence: 0.92,
        tags: ['tech', 'code', 'developer'],
        suggestedIcon: 'code-slash-outline',
        suggestedColor: '8B5CF6',
      };
    }

    // 7. SOCIAL / MESSAGES
    const isSocial =
      text.includes('whatsapp') ||
      text.includes('telegram') ||
      text.includes('instagram') ||
      text.includes('message') ||
      text.includes('typing...') ||
      folder.includes('whatsapp') ||
      folder.includes('telegram');

    if (isSocial) {
      const sub = folder.includes('whatsapp') ? 'WhatsApp' : 'Messages';
      return {
        categoryName: 'Social',
        subcategory: sub,
        folderHierarchy: ['Social', sub],
        confidence: 0.91,
        tags: ['social', sub.toLowerCase()],
        suggestedIcon: 'chatbubble-ellipses-outline',
        suggestedColor: 'EC4899',
      };
    }

    // 8. DOCUMENTS / OFFICIAL
    const isDocument =
      text.includes('passport') ||
      text.includes('driving licence') ||
      text.includes('identity card') ||
      text.includes('aadhaar') ||
      text.includes('certificate') ||
      text.includes('contract');

    if (isDocument) {
      return {
        categoryName: 'Documents',
        subcategory: 'Official',
        folderHierarchy: ['Documents', 'Official'],
        confidence: 0.92,
        tags: ['documents', 'id'],
        suggestedIcon: 'document-text-outline',
        suggestedColor: 'F59E0B',
      };
    }

    // Default: Unsorted
    return {
      categoryName: 'Unsorted',
      subcategory: 'General',
      folderHierarchy: ['Unsorted'],
      confidence: 0.5,
      tags: ['unsorted'],
      suggestedIcon: 'help-circle-outline',
      suggestedColor: '94A3B8',
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
    console.log(`[SmartFolderService] Classifying: ${payload.fileName}`);

    // 1. Run local heuristic rule classification
    const classification = this.classifyScreenshot({
      fileName: payload.fileName,
      filePath: payload.filePath,
      ocrText: payload.ocrText,
      deviceFolder: payload.deviceFolder,
    });

    // 2. Create or reuse dynamic nested category tree in SQLite
    const assignedCategory = await categoryRepository.createNestedCategoryHierarchy(
      classification.folderHierarchy,
      classification.suggestedIcon,
      classification.suggestedColor
    );

    // 3. Prepare search index and keywords
    const searchResult = searchIndexService.prepareIndex(payload.ocrText);
    const combinedKeywords = Array.from(
      new Set([
        ...classification.tags,
        ...classification.folderHierarchy.map((h) => h.toLowerCase()),
        ...searchResult.keywords,
      ])
    );

    // 4. Update or construct ScreenshotModel
    const existing = await screenshotRepository.getScreenshotById(payload.screenshotId);

    const screenshotModel: ScreenshotModel = {
      id: payload.screenshotId,
      deviceAssetId: existing?.deviceAssetId || `asset_${Date.now()}`,
      filePath: payload.filePath,
      fileName: payload.fileName,
      createdAt: existing?.createdAt || new Date().toISOString(),
      width: payload.width || existing?.width || 1080,
      height: payload.height || existing?.height || 2400,
      fileSize: payload.fileSize || existing?.fileSize || 0,
      categoryId: assignedCategory.id,
      categoryName: assignedCategory.name,
      subcategory: classification.subcategory,
      confidence: classification.confidence,
      isAutoCategorized: true,
      isFavorite: existing?.isFavorite || false,
      isReviewed: classification.confidence >= 0.85,
      isSynced: false,
      ocrStatus: 'completed',
      ocrText: payload.ocrText,
      keywords: combinedKeywords,
      tags: combinedKeywords.slice(0, 4).map((kw) => ({
        id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
        name: kw,
        colorHex: classification.suggestedColor,
      })),
      lastScannedAt: new Date().toISOString(),
    };

    // 5. Save locally to SQLite
    await screenshotRepository.insertScreenshot(screenshotModel);
    await categoryRepository.updateAllAncestorCounts(assignedCategory.id);

    // 6. Synchronize Zustand stores
    useScreenshotStore.getState().addOrUpdateScreenshot(screenshotModel);

    // Refresh categories in store
    const allCategories = await categoryRepository.getAllCategories();
    useCategoryStore.getState().setCategories(allCategories);

    console.log(
      `[SmartFolderService] Filed '${payload.fileName}' into: ${classification.folderHierarchy.join(' > ')} (${Math.round(classification.confidence * 100)}% conf)`
    );

    return screenshotModel;
  }

  /**
   * Reorganizes all currently unsorted screenshots locally.
   */
  async organizeAllUnsorted(): Promise<number> {
    const unsorted = await screenshotRepository.getAllScreenshots({ categoryId: 'unsorted' });
    console.log(`[SmartFolderService] Batch organizing ${unsorted.length} unsorted screenshots...`);

    let count = 0;
    for (const item of unsorted) {
      if (item.ocrText && item.ocrText.trim().length > 0) {
        await this.assignScreenshotToSmartFolder({
          screenshotId: item.id,
          fileName: item.fileName,
          filePath: item.filePath,
          ocrText: item.ocrText,
          fileSize: item.fileSize,
          width: item.width,
          height: item.height,
        });
        count++;
      }
    }
    return count;
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
}

export const smartFolderService = new SmartFolderService();

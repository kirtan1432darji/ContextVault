import { databaseService } from '../database';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { visionRepository } from '../database/repositories/VisionRepository';
import { CategoryModel, ScreenshotModel } from '../models';
import { useCategoryStore } from '../store/category.store';
import { useScreenshotStore } from '../store/screenshot.store';
import { searchIndexService } from './searchIndexService';

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

export class SmartFolderClassificationService {
  private static instance: SmartFolderClassificationService | null = null;

  static getInstance(): SmartFolderClassificationService {
    if (!SmartFolderClassificationService.instance) {
      SmartFolderClassificationService.instance = new SmartFolderClassificationService();
    }
    return SmartFolderClassificationService.instance;
  }

  // Built-in categories config
  private readonly CATEGORY_CONFIG: Record<
    SmartFolderCategory,
    { id: string; icon: string; color: string; keywords: string[]; entities: string[] }
  > = {
    Finance: {
      id: 'finance',
      icon: 'wallet-outline',
      color: '10B981',
      keywords: [
        'upi', 'payment', 'paid to', 'received from', 'transaction', 'transfer', 'gpay', 'google pay',
        'phonepe', 'paytm', 'bhim', 'bank', 'neft', 'rtgs', 'imps', 'debit', 'credit card', 'statement',
        'account balance', 'invoice', 'gstin', 'utr', 'txn', 'rupees', 'amount paid',
      ],
      entities: ['PhonePe', 'Google Pay', 'GPay', 'Paytm', 'BHIM', 'Razorpay', 'CRED', 'HDFC', 'SBI', 'ICICI', 'Axis'],
    },
    Shopping: {
      id: 'shopping',
      icon: 'bag-handle-outline',
      color: 'F97316',
      keywords: [
        'amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'tata cliq', 'order placed', 'order confirmed',
        'shipped', 'out for delivery', 'buy now', 'add to cart', 'wishlist', 'delivered on', 'return item',
        'track package', 'item total', 'shopping', 'ecommerce',
      ],
      entities: ['Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Ajio', 'Nike', 'Adidas', 'Puma'],
    },
    'Food Delivery': {
      id: 'food_delivery',
      icon: 'fast-food-outline',
      color: 'EF4444',
      keywords: [
        'swiggy', 'zomato', 'blinkit', 'zepto', 'dunzo', 'instamart', 'order delivered', 'restaurant',
        'delivering to', 'food preparation', 'cooking', 'delivery partner', 'delivery tip', 'dish', 'menu',
      ],
      entities: ['Swiggy', 'Zomato', 'Blinkit', 'Zepto', 'Dunzo', 'Instamart', 'Domino\'s', 'McDonald\'s', 'KFC', 'Starbucks'],
    },
    Chats: {
      id: 'chats',
      icon: 'chatbubble-ellipses-outline',
      color: '22C55E',
      keywords: [
        'whatsapp', 'telegram', 'signal', 'messenger', 'sms', 'message', 'typing...', 'online',
        'last seen', 'group chat', 'voice call', 'video call', 'unread messages',
      ],
      entities: ['WhatsApp', 'Telegram', 'Signal', 'Messenger'],
    },
    'Social Media': {
      id: 'social_media',
      icon: 'share-social-outline',
      color: 'EC4899',
      keywords: [
        'instagram', 'facebook', 'twitter', 'reddit', 'linkedin', 'snapchat', 'pinterest', 'threads',
        'reel', 'story', 'post', 'followers', 'following', 'like', 'comment', 'share', 'retweet',
      ],
      entities: ['Instagram', 'Facebook', 'Twitter', 'Reddit', 'LinkedIn', 'Snapchat', 'Pinterest'],
    },
    Travel: {
      id: 'travel',
      icon: 'airplane-outline',
      color: '06B6D4',
      keywords: [
        'irctc', 'train ticket', 'flight', 'boarding pass', 'airline', 'indigo', 'air india', 'vistara',
        'spicejet', 'pnr', 'seat no', 'terminal', 'gate', 'departure', 'arrival', 'booking.com', 'agoda',
        'makemytrip', 'cleartrip', 'goibibo', 'hotel booking', 'itinerary',
      ],
      entities: ['IRCTC', 'IndiGo', 'Air India', 'Vistara', 'MakeMyTrip', 'ClearTrip', 'Goibibo', 'Booking.com', 'Agoda'],
    },
    Health: {
      id: 'health',
      icon: 'medkit-outline',
      color: '14B8A6',
      keywords: [
        'prescription', 'rx', 'doctor', 'hospital', 'clinic', 'pharmacy', 'medicine', 'tablet', 'syrup',
        'dosage', 'blood test', 'lab report', 'diagnosis', 'apollo', '1mg', 'pharmeasy', 'netmeds', 'diagnostic',
      ],
      entities: ['Apollo', '1mg', 'PharmEasy', 'Netmeds', 'Tata 1mg', 'Practo', 'Dr Lal PathLabs'],
    },
    Education: {
      id: 'education',
      icon: 'school-outline',
      color: '3B82F6',
      keywords: [
        'notes', 'lecture', 'syllabus', 'course', 'tutorial', 'assignment', 'exam', 'quiz', 'classroom',
        'study', 'coursera', 'udemy', 'edx', 'khan academy', 'textbook', 'chapter', 'question paper',
      ],
      entities: ['Coursera', 'Udemy', 'edX', 'Khan Academy', 'Google Classroom', 'Unacademy', 'BYJU\'S'],
    },
    Work: {
      id: 'work',
      icon: 'briefcase-outline',
      color: '6366F1',
      keywords: [
        'slack', 'teams', 'microsoft teams', 'jira', 'confluence', 'sprint', 'trello', 'asana', 'github',
        'gitlab', 'pull request', 'merge request', 'commit', 'meeting', 'zoom', 'google meet', 'outlook',
        'standup', 'backlog', 'ticket', 'workplace', 'corporate',
      ],
      entities: ['Slack', 'Teams', 'Jira', 'GitHub', 'GitLab', 'Trello', 'Asana', 'Zoom', 'Google Meet', 'Outlook'],
    },
    Documents: {
      id: 'documents',
      icon: 'document-text-outline',
      color: 'F59E0B',
      keywords: [
        'aadhaar', 'pan card', 'passport', 'driving license', 'voter id', 'certificate', 'contract',
        'affidavit', 'agreement', 'official', 'government of india', 'income tax department', 'birth certificate',
      ],
      entities: ['Aadhaar', 'Income Tax Department', 'UIDAI', 'Passport Seva', 'Parivahan'],
    },
    Entertainment: {
      id: 'entertainment',
      icon: 'play-circle-outline',
      color: 'A855F7',
      keywords: [
        'youtube', 'netflix', 'spotify', 'prime video', 'hotstar', 'disney+', 'movie', 'song', 'music',
        'podcast', 'album', 'artist', 'stream', 'episode', 'series', 'gaming', 'trailer',
      ],
      entities: ['YouTube', 'Netflix', 'Spotify', 'Prime Video', 'Hotstar', 'Disney+'],
    },
    Utilities: {
      id: 'utilities',
      icon: 'flash-outline',
      color: 'EAB308',
      keywords: [
        'otp', 'verification code', 'one time password', 'do not share', 'recharge successful',
        'electricity bill', 'water bill', 'gas bill', 'broadband', 'wifi', 'dth', 'fastag', 'meter reading',
      ],
      entities: ['Airtel', 'Jio', 'Vi', 'BESCOM', 'Adani Electricity', 'Tata Power', 'Mahanagar Gas', 'FASTag'],
    },
    Other: {
      id: 'other',
      icon: 'help-circle-outline',
      color: '94A3B8',
      keywords: [],
      entities: [],
    },
  };

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
    const rawOcr = (input.ocrText || '').toLowerCase();
    const fileName = (input.fileName || '').toLowerCase();
    const sourceApp = (input.sourceApp || input.detectedApp || '').toLowerCase();
    const deviceFolder = (input.deviceFolder || '').toLowerCase();

    // -------------------------------------------------------------
    // Tier 1: Check cached Vision AI category in SQLite vision_cache
    // -------------------------------------------------------------
    try {
      const visionResult = await visionRepository.getVisionResult(input.screenshotId);
      if (visionResult) {
        const visionCategory = this.normalizeVisionCategory(visionResult.screen_type);
        if (visionCategory && visionCategory !== 'Other' && visionResult.confidence >= 0.7) {
          const config = this.CATEGORY_CONFIG[visionCategory];
          return {
            category: visionCategory,
            folderId: config.id,
            folderName: visionCategory,
            subcategory: visionResult.application_name || 'General',
            folderHierarchy: [visionCategory, visionResult.application_name || 'General'].filter(Boolean),
            confidence: Math.min(0.98, Number(visionResult.confidence) + 0.05),
            matchedTier: 'vision',
            tags: [visionCategory.toLowerCase(), (visionResult.application_name || '').toLowerCase()].filter(Boolean),
            suggestedIcon: config.icon,
            suggestedColor: config.color,
          };
        }
      }
    } catch {}

    // -------------------------------------------------------------
    // Tier 2: Extracted Entities (Merchants, Platforms, Apps)
    // -------------------------------------------------------------
    for (const [catName, cfg] of Object.entries(this.CATEGORY_CONFIG) as [SmartFolderCategory, any][]) {
      for (const ent of cfg.entities) {
        const entLower = ent.toLowerCase();
        if (
          rawOcr.includes(entLower) ||
          fileName.includes(entLower) ||
          sourceApp.includes(entLower)
        ) {
          return {
            category: catName,
            folderId: cfg.id,
            folderName: catName,
            subcategory: ent,
            folderHierarchy: [catName, ent],
            confidence: 0.94,
            matchedTier: 'entity',
            tags: [catName.toLowerCase(), ent.toLowerCase()],
            suggestedIcon: cfg.icon,
            suggestedColor: cfg.color,
          };
        }
      }
    }

    // -------------------------------------------------------------
    // Tier 3: OCR Keyword Scoring Dictionary
    // -------------------------------------------------------------
    const scores: Record<SmartFolderCategory, number> = {
      Finance: 0,
      Shopping: 0,
      'Food Delivery': 0,
      Chats: 0,
      'Social Media': 0,
      Travel: 0,
      Health: 0,
      Education: 0,
      Work: 0,
      Documents: 0,
      Entertainment: 0,
      Utilities: 0,
      Other: 0,
    };

    for (const [catName, cfg] of Object.entries(this.CATEGORY_CONFIG) as [SmartFolderCategory, any][]) {
      for (const kw of cfg.keywords) {
        if (rawOcr.includes(kw)) {
          scores[catName] += 1;
        }
      }
    }

    let topCategory: SmartFolderCategory = 'Other';
    let maxScore = 0;
    for (const [catName, score] of Object.entries(scores) as [SmartFolderCategory, number][]) {
      if (score > maxScore) {
        maxScore = score;
        topCategory = catName;
      }
    }

    if (maxScore >= 2) {
      const cfg = this.CATEGORY_CONFIG[topCategory];
      const confidence = Math.min(0.92, 0.72 + maxScore * 0.05);
      return {
        category: topCategory,
        folderId: cfg.id,
        folderName: topCategory,
        subcategory: 'General',
        folderHierarchy: [topCategory, 'General'],
        confidence,
        matchedTier: 'ocr',
        tags: [topCategory.toLowerCase()],
        suggestedIcon: cfg.icon,
        suggestedColor: cfg.color,
      };
    }

    // -------------------------------------------------------------
    // Tier 4: App Signature / Device Folder Heuristic
    // -------------------------------------------------------------
    if (sourceApp || deviceFolder) {
      const combinedApp = `${sourceApp} ${deviceFolder}`;
      if (combinedApp.includes('whatsapp') || combinedApp.includes('telegram')) {
        const sub = combinedApp.includes('whatsapp') ? 'WhatsApp' : 'Telegram';
        return {
          category: 'Chats',
          folderId: 'chats',
          folderName: 'Chats',
          subcategory: sub,
          folderHierarchy: ['Chats', sub],
          confidence: 0.90,
          matchedTier: 'app',
          tags: ['chats', sub.toLowerCase()],
          suggestedIcon: this.CATEGORY_CONFIG.Chats.icon,
          suggestedColor: this.CATEGORY_CONFIG.Chats.color,
        };
      }
      if (combinedApp.includes('instagram') || combinedApp.includes('twitter') || combinedApp.includes('reddit')) {
        return {
          category: 'Social Media',
          folderId: 'social_media',
          folderName: 'Social Media',
          subcategory: 'General',
          folderHierarchy: ['Social Media'],
          confidence: 0.88,
          matchedTier: 'app',
          tags: ['social_media'],
          suggestedIcon: this.CATEGORY_CONFIG['Social Media'].icon,
          suggestedColor: this.CATEGORY_CONFIG['Social Media'].color,
        };
      }
    }

    // -------------------------------------------------------------
    // Tier 5: Filename Heuristic
    // -------------------------------------------------------------
    for (const [catName, cfg] of Object.entries(this.CATEGORY_CONFIG) as [SmartFolderCategory, any][]) {
      for (const kw of cfg.keywords) {
        if (fileName.includes(kw)) {
          return {
            category: catName,
            folderId: cfg.id,
            folderName: catName,
            subcategory: 'General',
            folderHierarchy: [catName],
            confidence: 0.75,
            matchedTier: 'filename',
            tags: [catName.toLowerCase(), kw],
            suggestedIcon: cfg.icon,
            suggestedColor: cfg.color,
          };
        }
      }
    }

    // Fallback: Other / Unsorted
    return {
      category: 'Other',
      folderId: 'unsorted',
      folderName: 'Unsorted',
      subcategory: 'General',
      folderHierarchy: ['Unsorted'],
      confidence: 0.50,
      matchedTier: 'fallback',
      tags: ['unsorted'],
      suggestedIcon: this.CATEGORY_CONFIG.Other.icon,
      suggestedColor: this.CATEGORY_CONFIG.Other.color,
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
      (existing.classificationSource === 'manual' || !existing.isAutoCategorized) &&
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
      classificationSource: 'local',
      isAutoCategorized: true,
      isFavorite: existing?.isFavorite || false,
      isReviewed: classification.confidence >= 0.85,
      isSynced: false,
      ocrStatus: existing?.ocrStatus || (input.ocrText ? 'completed' : 'none'),
      ocrText: input.ocrText || existing?.ocrText,
      keywords: combinedKeywords,
      folderPath: classification.folderHierarchy,
      tags: combinedKeywords.slice(0, 4).map((kw) => ({
        id: `tag_${kw.toLowerCase().replace(/\s+/g, '_')}`,
        name: kw,
        colorHex: classification.suggestedColor,
      })),
      lastScannedAt: new Date().toISOString(),
    };

    // Save locally to SQLite
    await screenshotRepository.insertScreenshot(screenshotModel);
    await categoryRepository.updateAllAncestorCounts(assignedCategory.id);

    // Sync Zustand stores
    useScreenshotStore.getState().addOrUpdateScreenshot(screenshotModel);
    const allCategories = await categoryRepository.getAllCategories();
    useCategoryStore.getState().setCategories(allCategories);

    return screenshotModel;
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
   * Batch organizes a list of screenshots sequentially.
   */
  async classifyBatch(screenshots: ScreenshotModel[]): Promise<{ processed: number; moved: number }> {
    let moved = 0;
    for (const sc of screenshots) {
      if (sc.classificationSource === 'manual' && !sc.isAutoCategorized) {
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
      });
      if (updated.categoryId !== beforeFolder) {
        moved++;
      }
    }
    return { processed: screenshots.length, moved };
  }

  private normalizeVisionCategory(raw: string): SmartFolderCategory {
    const s = (raw || '').toLowerCase();
    if (s.includes('finance') || s.includes('payment') || s.includes('bank') || s.includes('invoice')) return 'Finance';
    if (s.includes('food') || s.includes('delivery') || s.includes('restaurant') || s.includes('swiggy') || s.includes('zomato')) return 'Food Delivery';
    if (s.includes('shop') || s.includes('order') || s.includes('amazon') || s.includes('flipkart')) return 'Shopping';
    if (s.includes('chat') || s.includes('message') || s.includes('whatsapp') || s.includes('telegram')) return 'Chats';
    if (s.includes('social') || s.includes('instagram') || s.includes('twitter') || s.includes('reddit')) return 'Social Media';
    if (s.includes('travel') || s.includes('flight') || s.includes('ticket') || s.includes('irctc')) return 'Travel';
    if (s.includes('health') || s.includes('medical') || s.includes('prescription')) return 'Health';
    if (s.includes('education') || s.includes('study') || s.includes('learning')) return 'Education';
    if (s.includes('work') || s.includes('slack') || s.includes('jira') || s.includes('code') || s.includes('tech') || s.includes('project')) return 'Work';
    if (s.includes('document') || s.includes('id') || s.includes('aadhaar')) return 'Documents';
    if (s.includes('entertainment') || s.includes('youtube') || s.includes('media')) return 'Entertainment';
    if (s.includes('utility') || s.includes('utilities') || s.includes('bill') || s.includes('otp')) return 'Utilities';
    return 'Other';
  }
}

export const smartFolderClassificationService = SmartFolderClassificationService.getInstance();

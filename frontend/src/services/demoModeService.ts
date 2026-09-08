import AsyncStorage from '@react-native-async-storage/async-storage';
import { databaseService } from '../database';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { useFolderContextStore } from '../store/folderContext.store';
import { loggerService } from './loggerService';
import { ScreenshotModel } from '../models';

export const STORAGE_KEY_DEMO_MODE = '@contextvault_demo_mode_active';

export interface DemoScreenshotItem extends ScreenshotModel {
  ocrText: string;
  blocksJson: string;
}

const DEMO_SCREENSHOTS: DemoScreenshotItem[] = [
  {
    id: 'demo_sc_01',
    fileName: 'Screenshot_GPay_Starbucks_450.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_GPay_Starbucks_450.png',
    fileSize: 342150,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_01',
    createdAt: new Date().toISOString(),
    categoryId: 'finance',
    categoryName: 'Finance',
    subcategory: 'UPI',
    confidence: 0.96,
    isAutoCategorized: true,
    isFavorite: true,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['UPI', 'Starbucks', '₹450', 'GPay', 'Coffee'],
    sourceApp: 'Google Pay',
    detectedApp: 'Google Pay',
    folderPath: ['Finance', 'UPI'],
    ocrText: 'Google Pay. Paid ₹450 to Starbucks Coffee India. Completed. UPI Transaction ID: 31459201948. Paid from HDFC Bank AC **4821.',
    blocksJson: JSON.stringify([
      { text: 'Paid ₹450 to Starbucks Coffee India', boundingBox: { x: 50, y: 120, width: 900, height: 80 } },
      { text: 'UPI Transaction ID: 31459201948', boundingBox: { x: 50, y: 220, width: 600, height: 40 } },
    ]),
  },
  {
    id: 'demo_sc_02',
    fileName: 'Screenshot_Amazon_Invoice_SonyHeadphones.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Amazon_Invoice_SonyHeadphones.png',
    fileSize: 489200,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_02',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    categoryId: 'finance',
    categoryName: 'Finance',
    subcategory: 'Invoices',
    confidence: 0.94,
    isAutoCategorized: true,
    isFavorite: false,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['Amazon', 'Invoice', 'Sony', 'WH-1000XM5', '₹24990'],
    sourceApp: 'Amazon Shopping',
    detectedApp: 'Amazon Shopping',
    folderPath: ['Finance', 'Invoices'],
    ocrText: 'Tax Invoice. Amazon Seller Services. Order #402-8823910-4102918. Sony WH-1000XM5 Wireless Noise Cancelling Headphones. Total Amount: ₹24,990.00. Payment Method: Credit Card.',
    blocksJson: JSON.stringify([
      { text: 'Order #402-8823910-4102918', boundingBox: { x: 40, y: 80, width: 700, height: 50 } },
      { text: 'Sony WH-1000XM5 Wireless Headphones', boundingBox: { x: 40, y: 160, width: 850, height: 60 } },
      { text: 'Total Amount: ₹24,990.00', boundingBox: { x: 40, y: 260, width: 500, height: 50 } },
    ]),
  },
  {
    id: 'demo_sc_03',
    fileName: 'Screenshot_IndiGo_BoardingPass_BLR.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_IndiGo_BoardingPass_BLR.png',
    fileSize: 512000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_03',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    categoryId: 'travel',
    categoryName: 'Travel',
    subcategory: 'Flights',
    confidence: 0.98,
    isAutoCategorized: true,
    isFavorite: true,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['IndiGo', 'Flight', '6E 2134', 'DEL', 'BLR', 'Seat 14B'],
    sourceApp: 'IndiGo App',
    detectedApp: 'IndiGo',
    folderPath: ['Travel', 'Flights'],
    ocrText: 'IndiGo Boarding Pass. Passenger: Kirtan Darji. Flight: 6E 2134. Delhi (DEL) to Bengaluru (BLR). Date: Tomorrow. Departure: 08:30 AM. Gate: 3. Seat: 14B. Zone 2.',
    blocksJson: JSON.stringify([
      { text: 'Flight 6E 2134 DEL -> BLR', boundingBox: { x: 60, y: 100, width: 800, height: 70 } },
      { text: 'Seat: 14B Gate: 3', boundingBox: { x: 60, y: 200, width: 500, height: 60 } },
    ]),
  },
  {
    id: 'demo_sc_04',
    fileName: 'Screenshot_Taj_Hotel_Bengaluru_Booking.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Taj_Hotel_Bengaluru_Booking.png',
    fileSize: 420000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_04',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    categoryId: 'travel',
    categoryName: 'Travel',
    subcategory: 'Hotels',
    confidence: 0.92,
    isAutoCategorized: true,
    isFavorite: false,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['MakeMyTrip', 'Taj West End', 'Hotel', 'Bengaluru', 'Check-in'],
    sourceApp: 'MakeMyTrip',
    detectedApp: 'MakeMyTrip',
    folderPath: ['Travel', 'Hotels'],
    ocrText: 'Booking Confirmed! MakeMyTrip. Taj West End, Race Course Road, Bengaluru. 2 Nights Stay. Check-in: 2:00 PM. Booking ID: MMT-89104820.',
    blocksJson: JSON.stringify([
      { text: 'Taj West End, Bengaluru', boundingBox: { x: 50, y: 100, width: 750, height: 60 } },
    ]),
  },
  {
    id: 'demo_sc_05',
    fileName: 'Screenshot_React_Native_SQLite_Schema.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_React_Native_SQLite_Schema.png',
    fileSize: 610000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_05',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    categoryId: 'development',
    categoryName: 'Development',
    subcategory: 'Code',
    confidence: 0.95,
    isAutoCategorized: true,
    isFavorite: true,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['TypeScript', 'SQLite', 'React Native', 'CREATE TABLE', 'PRAGMA'],
    sourceApp: 'VS Code Mobile',
    detectedApp: 'VS Code',
    folderPath: ['Development', 'Code'],
    ocrText: 'export const SCHEMA_SQL = [\n  `CREATE TABLE IF NOT EXISTS screenshots (id TEXT PRIMARY KEY, file_name TEXT, category_id TEXT);`,\n  `CREATE INDEX IF NOT EXISTS idx_screenshots_cat ON screenshots(category_id);`\n];',
    blocksJson: JSON.stringify([
      { text: 'CREATE TABLE IF NOT EXISTS screenshots', boundingBox: { x: 40, y: 80, width: 850, height: 50 } },
    ]),
  },
  {
    id: 'demo_sc_06',
    fileName: 'Screenshot_Android_Logcat_Crash_Exception.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Android_Logcat_Crash_Exception.png',
    fileSize: 390000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_06',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    categoryId: 'development',
    categoryName: 'Development',
    subcategory: 'Errors',
    confidence: 0.91,
    isAutoCategorized: true,
    isFavorite: false,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['Logcat', 'Crash', 'NullPointerException', 'MediaObserver', 'Android'],
    sourceApp: 'Terminal',
    detectedApp: 'Terminal',
    folderPath: ['Development', 'Errors'],
    ocrText: 'FATAL EXCEPTION: main\njava.lang.NullPointerException: Attempt to invoke virtual method on a null object reference at com.contextvault.MediaObserverModule.startObserving()',
    blocksJson: JSON.stringify([
      { text: 'FATAL EXCEPTION: main NullPointerException', boundingBox: { x: 40, y: 90, width: 800, height: 60 } },
    ]),
  },
  {
    id: 'demo_sc_07',
    fileName: 'Screenshot_Zara_Order_Receipt_3290.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Zara_Order_Receipt_3290.png',
    fileSize: 375000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_07',
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    categoryId: 'shopping',
    categoryName: 'Shopping',
    subcategory: 'Clothing',
    confidence: 0.93,
    isAutoCategorized: true,
    isFavorite: false,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['Zara', 'Linen Shirt', '₹3290', 'Order', 'Clothing'],
    sourceApp: 'Zara App',
    detectedApp: 'Zara',
    folderPath: ['Shopping', 'Clothing'],
    ocrText: 'ZARA India. Thank you for your order #ZA-99214. 100% Linen Regular Fit Shirt. Size: L. Price: ₹3,290.00. Free Standard Delivery.',
    blocksJson: JSON.stringify([
      { text: 'ZARA India Order #ZA-99214', boundingBox: { x: 40, y: 100, width: 700, height: 50 } },
      { text: 'Linen Shirt ₹3,290.00', boundingBox: { x: 40, y: 180, width: 600, height: 50 } },
    ]),
  },
  {
    id: 'demo_sc_08',
    fileName: 'Screenshot_Slack_Sprint_Demo_Checklist.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Slack_Sprint_Demo_Checklist.png',
    fileSize: 450000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_08',
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    categoryId: 'work',
    categoryName: 'Work',
    subcategory: 'Slack',
    confidence: 0.89,
    isAutoCategorized: true,
    isFavorite: true,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['Slack', 'Demo', 'Sprint RN-11', 'ContextVault', 'Engineering'],
    sourceApp: 'Slack',
    detectedApp: 'Slack',
    folderPath: ['Work', 'Slack'],
    ocrText: 'Engineering #demo-prep: Team, ContextVault Sprint RN-11 is ready. Offline demo mode active, APK compiled, ProGuard verified. Target demo start: 10:00 AM.',
    blocksJson: JSON.stringify([
      { text: 'Engineering #demo-prep: ContextVault RN-11', boundingBox: { x: 50, y: 80, width: 800, height: 60 } },
    ]),
  },
  {
    id: 'demo_sc_09',
    fileName: 'Screenshot_Apollo_Blood_Test_Report.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Apollo_Blood_Test_Report.png',
    fileSize: 520000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_09',
    createdAt: new Date(Date.now() - 3600000 * 42).toISOString(),
    categoryId: 'health',
    categoryName: 'Health',
    subcategory: 'Lab Reports',
    confidence: 0.94,
    isAutoCategorized: true,
    isFavorite: false,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['Apollo', 'Blood Test', 'Hemoglobin', 'Thyroid', 'Report'],
    sourceApp: 'Apollo 247',
    detectedApp: 'Apollo',
    folderPath: ['Health', 'Lab Reports'],
    ocrText: 'Apollo Diagnostics Laboratory Report. Patient: Kirtan Darji. Hemoglobin: 14.8 g/dL (Normal). Fasting Blood Sugar: 92 mg/dL. All parameters normal.',
    blocksJson: JSON.stringify([
      { text: 'Apollo Diagnostics Blood Report Normal', boundingBox: { x: 50, y: 100, width: 800, height: 60 } },
    ]),
  },
  {
    id: 'demo_sc_10',
    fileName: 'Screenshot_Transformer_Attention_ML_Notes.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Transformer_Attention_ML_Notes.png',
    fileSize: 410000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_10',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    categoryId: 'education',
    categoryName: 'Education',
    subcategory: 'Notes',
    confidence: 0.91,
    isAutoCategorized: true,
    isFavorite: true,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['Machine Learning', 'Transformer', 'Attention', 'QKV', 'Softmax'],
    sourceApp: 'Notion',
    detectedApp: 'Notion',
    folderPath: ['Education', 'Notes'],
    ocrText: 'Deep Learning Notes: Self-Attention Mechanism. Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V. Multi-Head Attention enables joint attendance to different subspaces.',
    blocksJson: JSON.stringify([
      { text: 'Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V', boundingBox: { x: 50, y: 120, width: 850, height: 60 } },
    ]),
  },
  {
    id: 'demo_sc_11',
    fileName: 'Screenshot_BookMyShow_Oppenheimer_IMAX.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_BookMyShow_Oppenheimer_IMAX.png',
    fileSize: 460000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_11',
    createdAt: new Date(Date.now() - 3600000 * 54).toISOString(),
    categoryId: 'entertainment',
    categoryName: 'Entertainment',
    subcategory: 'Cinema',
    confidence: 0.95,
    isAutoCategorized: true,
    isFavorite: false,
    isReviewed: true,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['BookMyShow', 'Oppenheimer', 'IMAX', 'Seat F11', 'Ticket'],
    sourceApp: 'BookMyShow',
    detectedApp: 'BookMyShow',
    folderPath: ['Entertainment', 'Cinema'],
    ocrText: 'BookMyShow Ticket. Oppenheimer (IMAX 70mm). PVR Forum Mall, Bengaluru. Audi 4. Seat: F11, F12. Showtime: Saturday 7:15 PM. Booking ID: WXY8910.',
    blocksJson: JSON.stringify([
      { text: 'Oppenheimer IMAX Audi 4 Seat F11', boundingBox: { x: 50, y: 100, width: 800, height: 60 } },
    ]),
  },
  {
    id: 'demo_sc_12',
    fileName: 'Screenshot_Tech_Meme_Works_On_My_Machine.png',
    filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Tech_Meme_Works_On_My_Machine.png',
    fileSize: 310000,
    width: 1080,
    height: 2400,
    deviceAssetId: 'demo_asset_12',
    createdAt: new Date(Date.now() - 3600000 * 60).toISOString(),
    categoryId: 'personal',
    categoryName: 'Personal',
    subcategory: 'Memes',
    confidence: 0.88,
    isAutoCategorized: true,
    isFavorite: false,
    isReviewed: false,
    isSynced: true,
    ocrStatus: 'completed',
    tags: [],
    keywords: ['Meme', 'Works on My Machine', 'Docker', 'Developer'],
    sourceApp: 'Reddit',
    detectedApp: 'Reddit',
    folderPath: ['Personal', 'Memes'],
    ocrText: 'Developer: "It works on my machine!" DevOps: "Then we will ship your machine to production, and that is how Docker was born."',
    blocksJson: JSON.stringify([
      { text: 'It works on my machine!', boundingBox: { x: 60, y: 120, width: 700, height: 60 } },
    ]),
  },
];

class DemoModeService {
  /**
   * Checks if demo mode is currently active.
   */
  async isDemoModeActive(): Promise<boolean> {
    const val = await AsyncStorage.getItem(STORAGE_KEY_DEMO_MODE);
    return val === 'true';
  }

  /**
   * Activates Demo Mode and populates realistic offline dataset:
   * Screenshots, OCR text, Smart folders, Living folder context, and AI chat history.
   */
  async loadDemoData(): Promise<number> {
    loggerService.info('App', 'Populating ContextVault Hackathon Demo dataset...');

    try {
      // 1. Insert screenshots and OCR cache records into SQLite
      for (const item of DEMO_SCREENSHOTS) {
        await databaseService.executeCommand(
          `INSERT OR REPLACE INTO screenshots 
          (id, file_name, file_path, file_size, device_asset_id, created_at, category_id, category_name, subcategory, confidence, is_auto_categorized, is_favorite, is_reviewed, is_synced, ocr_status, keywords, source_app, detected_app, folder_path, classification_source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.fileName,
            item.filePath,
            item.fileSize,
            item.deviceAssetId,
            item.createdAt,
            item.categoryId,
            item.categoryName,
            item.subcategory || '',
            item.confidence,
            item.isAutoCategorized ? 1 : 0,
            item.isFavorite ? 1 : 0,
            item.isReviewed ? 1 : 0,
            item.isSynced ? 1 : 0,
            item.ocrStatus || 'completed',
            JSON.stringify(item.keywords || []),
            item.sourceApp || 'Screenshots',
            item.detectedApp || '',
            JSON.stringify(item.folderPath || [item.categoryName]),
            'local',
          ]
        );

        // Insert OCR cache record
        await databaseService.executeCommand(
          `INSERT OR REPLACE INTO ocr_cache 
          (id, screenshot_id, extracted_text, normalized_text, processing_time, language, ocr_version, confidence, blocks_json, created_on)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `ocr_${item.id}`,
            item.id,
            item.ocrText,
            item.ocrText.toLowerCase(),
            280,
            'en',
            'MLKit-Text-16.0.0',
            item.confidence,
            item.blocksJson,
            item.createdAt,
          ]
        );
      }

      // 2. Populate Living Folder Contexts in SQLite
      const folderContexts = [
        {
          folderId: 'finance',
          summary: 'Contains 2 screenshots totaling ₹25,440. Includes ₹450 Starbucks coffee via Google Pay (UTR: 31459201948) and ₹24,990 Sony WH-1000XM5 headphones invoice from Amazon.',
          entities: JSON.stringify({ merchants: ['Starbucks', 'Amazon'], amounts: ['₹450', '₹24,990'], utr: '31459201948' }),
          tags: JSON.stringify(['UPI', 'Starbucks', 'Amazon', 'Invoice', 'GPay']),
        },
        {
          folderId: 'travel',
          summary: 'Contains IndiGo flight 6E 2134 boarding pass from Delhi (DEL) to Bengaluru (BLR) with Seat 14B, Gate 3, and Taj West End hotel booking on Race Course Road.',
          entities: JSON.stringify({ flight: '6E 2134', route: 'DEL -> BLR', seat: '14B', hotel: 'Taj West End' }),
          tags: JSON.stringify(['IndiGo', 'Flight', 'Seat 14B', 'Hotel', 'Bengaluru']),
        },
        {
          folderId: 'development',
          summary: 'Contains React Native SQLite schema code definitions, table creation scripts, indexing strategies, and Android native Logcat crash stack traces.',
          entities: JSON.stringify({ tech: ['React Native', 'SQLite', 'TypeScript', 'Android Logcat'] }),
          tags: JSON.stringify(['Code', 'SQLite', 'TypeScript', 'Crash', 'Logcat']),
        },
      ];

      for (const fc of folderContexts) {
        await databaseService.executeCommand(
          `INSERT OR REPLACE INTO folder_context
          (folder_id, summary, entities_json, tags_json, last_updated)
          VALUES (?, ?, ?, ?, ?)`,
          [fc.folderId, fc.summary, fc.entities, fc.tags, new Date().toISOString()]
        );
      }

      // 3. Populate Sample AI Chat History
      const demoChats = [
        {
          id: 'demo_chat_1',
          folderId: 'finance',
          role: 'user',
          message: 'How much did I pay for Starbucks coffee today?',
          createdOn: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: 'demo_chat_2',
          folderId: 'finance',
          role: 'assistant',
          message: 'You paid **₹450** to Starbucks Coffee India via Google Pay (UPI Transaction ID: `31459201948`) debited from HDFC Bank.',
          createdOn: new Date(Date.now() - 1750000).toISOString(),
        },
        {
          id: 'demo_chat_3',
          folderId: 'travel',
          role: 'user',
          message: 'What is my seat and departure gate for my flight to Bangalore?',
          createdOn: new Date(Date.now() - 1200000).toISOString(),
        },
        {
          id: 'demo_chat_4',
          folderId: 'travel',
          role: 'assistant',
          message: 'Your IndiGo flight **6E 2134** from Delhi to Bengaluru departs at **08:30 AM** from **Gate 3**. Your assigned seat is **14B** in Zone 2.',
          createdOn: new Date(Date.now() - 1150000).toISOString(),
        },
      ];

      for (const chat of demoChats) {
        await databaseService.executeCommand(
          `INSERT OR REPLACE INTO chat_history 
          (id, folder_id, role, message, created_on, sync_status)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [chat.id, chat.folderId, chat.role, chat.message, chat.createdOn, 'synced']
        );
      }

      // 4. Populate Recent Search Queries
      const demoSearches = [
        { id: 'search_1', query: 'Starbucks ₹450 UPI', count: 1 },
        { id: 'search_2', query: 'Indigo flight seat', count: 1 },
        { id: 'search_3', query: 'Amazon Sony invoice', count: 1 },
        { id: 'search_4', query: 'SQLite schema table', count: 1 },
      ];

      for (const s of demoSearches) {
        await databaseService.executeCommand(
          `INSERT OR REPLACE INTO recent_searches (id, query, timestamp, result_count)
          VALUES (?, ?, ?, ?)`,
          [s.id, s.query, new Date().toISOString(), s.count]
        );
      }

      // 5. Update Category screenshot counts
      await databaseService.executeCommand(
        `UPDATE categories SET screenshot_count = (SELECT COUNT(*) FROM screenshots WHERE category_id = categories.id)`
      );

      // 6. Refresh Zustand Stores
      await AsyncStorage.setItem(STORAGE_KEY_DEMO_MODE, 'true');
      const scItems = await screenshotRepository.getAllScreenshots();
      useScreenshotStore.getState().setScreenshots(scItems);
      await useCategoryStore.getState().loadCategories();
      await useFolderContextStore.getState().loadStatsAndRecents();

      loggerService.info('App', `Demo dataset activated: ${DEMO_SCREENSHOTS.length} screenshots populated.`);
      return DEMO_SCREENSHOTS.length;
    } catch (err: any) {
      loggerService.error('App', 'Failed to populate demo data', err);
      throw err;
    }
  }

  /**
   * Clears demo dataset and restores clean database state.
   */
  async clearDemoData(): Promise<void> {
    try {
      loggerService.info('App', 'Clearing demo dataset...');
      const demoIds = DEMO_SCREENSHOTS.map((s) => `'${s.id}'`).join(',');

      await databaseService.executeCommand(`DELETE FROM screenshots WHERE id IN (${demoIds})`);
      await databaseService.executeCommand(`DELETE FROM ocr_cache WHERE screenshot_id IN (${demoIds})`);
      await databaseService.executeCommand(`DELETE FROM chat_history WHERE id LIKE 'demo_chat_%'`);
      await databaseService.executeCommand(`DELETE FROM recent_searches WHERE id LIKE 'search_%'`);

      await databaseService.executeCommand(
        `UPDATE categories SET screenshot_count = (SELECT COUNT(*) FROM screenshots WHERE category_id = categories.id)`
      );

      await AsyncStorage.setItem(STORAGE_KEY_DEMO_MODE, 'false');
      const scItems = await screenshotRepository.getAllScreenshots();
      useScreenshotStore.getState().setScreenshots(scItems);
      await useCategoryStore.getState().loadCategories();
      await useFolderContextStore.getState().loadStatsAndRecents();

      loggerService.info('App', 'Demo dataset cleared.');
    } catch (err: any) {
      loggerService.error('App', 'Error clearing demo data', err);
      throw err;
    }
  }
}

export const demoModeService = new DemoModeService();

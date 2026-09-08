import { Share, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { databaseService } from '../database';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { useFolderContextStore } from '../store/folderContext.store';
import { useSettingsStore } from '../store/settings.store';
import { loggerService } from './loggerService';

export interface BackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  settings: Record<string, any>;
  data: {
    screenshots: any[];
    categories: any[];
    ocrCache: any[];
    folderContext: any[];
    chatHistory: any[];
    recentSearches: any[];
    savedSearches: any[];
  };
}

class BackupService {
  /**
   * Exports all SQLite data and application settings into a versioned JSON string.
   */
  async exportBackup(): Promise<string> {
    loggerService.info('Storage', 'Initiating full application backup export...');

    try {
      const [
        screenshots,
        categories,
        ocrCache,
        folderContext,
        chatHistory,
        recentSearches,
        savedSearches,
      ] = await Promise.all([
        databaseService.executeQuery('SELECT * FROM screenshots;'),
        databaseService.executeQuery('SELECT * FROM categories;'),
        databaseService.executeQuery('SELECT * FROM ocr_cache;'),
        databaseService.executeQuery('SELECT * FROM folder_context;'),
        databaseService.executeQuery('SELECT * FROM chat_history;'),
        databaseService.executeQuery('SELECT * FROM recent_searches;'),
        databaseService.executeQuery('SELECT * FROM saved_searches;'),
      ]);

      const settings = {
        themeMode: useSettingsStore.getState().themeMode,
        backendUrl: useSettingsStore.getState().backendUrl,
        autoScanOnLaunch: useSettingsStore.getState().autoScanOnLaunch,
        autoDetectScreenshots: useSettingsStore.getState().autoDetectScreenshots,
        screenshotNotifications: useSettingsStore.getState().screenshotNotifications,
      };

      const payload: BackupPayload = {
        app: 'ContextVault',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings,
        data: {
          screenshots,
          categories,
          ocrCache,
          folderContext,
          chatHistory,
          recentSearches,
          savedSearches,
        },
      };

      const json = JSON.stringify(payload, null, 2);
      loggerService.info('Storage', `Backup exported successfully (${json.length} bytes).`);
      return json;
    } catch (err: any) {
      loggerService.error('Storage', 'Error exporting backup', err);
      throw err;
    }
  }

  /**
   * Shares the exported backup JSON via native Android share sheet.
   */
  async shareBackup(): Promise<void> {
    try {
      const backupJson = await this.exportBackup();
      await Share.share({
        title: 'ContextVault_Backup.json',
        message: backupJson,
      });
    } catch (err: any) {
      loggerService.error('Storage', 'Failed to share backup file', err);
      throw err;
    }
  }

  /**
   * Imports a backup JSON string and restores SQLite database and application settings.
   */
  async importBackup(jsonString: string): Promise<{ success: boolean; counts: Record<string, number> }> {
    loggerService.info('Storage', 'Starting backup restoration...');

    try {
      const payload: BackupPayload = JSON.parse(jsonString);

      if (payload.app !== 'ContextVault' || !payload.data) {
        throw new Error('Invalid ContextVault backup file format.');
      }

      const { data, settings } = payload;
      const counts: Record<string, number> = {
        screenshots: 0,
        categories: 0,
        ocrCache: 0,
        folderContext: 0,
        chatHistory: 0,
      };

      // 1. Restore Categories
      if (data.categories && Array.isArray(data.categories)) {
        for (const cat of data.categories) {
          await databaseService.executeCommand(
            `INSERT OR REPLACE INTO categories 
            (id, name, parent_id, icon_name, color_hex, description, is_system, order_index, is_favorite, path, created_on, screenshot_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cat.id,
              cat.name,
              cat.parent_id || null,
              cat.icon_name || 'folder-outline',
              cat.color_hex || '#3B82F6',
              cat.description || '',
              cat.is_system ? 1 : 0,
              cat.order_index || 0,
              cat.is_favorite ? 1 : 0,
              cat.path || `/${cat.name}`,
              cat.created_on || new Date().toISOString(),
              cat.screenshot_count || 0,
            ]
          );
          counts.categories++;
        }
      }

      // 2. Restore Screenshots
      if (data.screenshots && Array.isArray(data.screenshots)) {
        for (const sc of data.screenshots) {
          await databaseService.executeCommand(
            `INSERT OR REPLACE INTO screenshots 
            (id, file_name, file_path, file_size, device_asset_id, created_at, category_id, category_name, subcategory, confidence, is_auto_categorized, is_favorite, needs_review, keywords, source_app, detected_app, folder_path, classification_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sc.id,
              sc.file_name,
              sc.file_path,
              sc.file_size || 0,
              sc.device_asset_id || '',
              sc.created_at,
              sc.category_id,
              sc.category_name,
              sc.subcategory || '',
              sc.confidence || 0.85,
              sc.is_auto_categorized ? 1 : 0,
              sc.is_favorite ? 1 : 0,
              sc.needs_review ? 1 : 0,
              sc.keywords || '[]',
              sc.source_app || 'Screenshots',
              sc.detected_app || '',
              sc.folder_path || '[]',
              sc.classification_source || 'local',
            ]
          );
          counts.screenshots++;
        }
      }

      // 3. Restore OCR Cache
      if (data.ocrCache && Array.isArray(data.ocrCache)) {
        for (const ocr of data.ocrCache) {
          await databaseService.executeCommand(
            `INSERT OR REPLACE INTO ocr_cache 
            (id, screenshot_id, extracted_text, normalized_text, processing_time, language, ocr_version, confidence, blocks_json, created_on)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              ocr.id,
              ocr.screenshot_id,
              ocr.extracted_text,
              ocr.normalized_text,
              ocr.processing_time || 0,
              ocr.language || 'en',
              ocr.ocr_version || 'MLKit-Text-16.0.0',
              ocr.confidence || 0.9,
              ocr.blocks_json || '[]',
              ocr.created_on || new Date().toISOString(),
            ]
          );
          counts.ocrCache++;
        }
      }

      // 4. Restore Living Folder Context
      if (data.folderContext && Array.isArray(data.folderContext)) {
        for (const fc of data.folderContext) {
          await databaseService.executeCommand(
            `INSERT OR REPLACE INTO folder_context 
            (folder_id, summary, entities_json, tags_json, last_updated)
            VALUES (?, ?, ?, ?, ?)`,
            [
              fc.folder_id,
              fc.summary,
              fc.entities_json || '{}',
              fc.tags_json || '[]',
              fc.last_updated || new Date().toISOString(),
            ]
          );
          counts.folderContext++;
        }
      }

      // 5. Restore Chat History
      if (data.chatHistory && Array.isArray(data.chatHistory)) {
        for (const ch of data.chatHistory) {
          await databaseService.executeCommand(
            `INSERT OR REPLACE INTO chat_history 
            (id, folder_id, role, message, created_on, sync_status)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              ch.id,
              ch.folder_id,
              ch.role,
              ch.message,
              ch.created_on || new Date().toISOString(),
              ch.sync_status || 'synced',
            ]
          );
          counts.chatHistory++;
        }
      }

      // 6. Restore Settings if present
      if (settings) {
        if (settings.themeMode) useSettingsStore.getState().setThemeMode(settings.themeMode);
        if (settings.backendUrl) useSettingsStore.getState().setBackendUrl(settings.backendUrl);
        if (typeof settings.autoScanOnLaunch === 'boolean') {
          useSettingsStore.getState().setAutoScanOnLaunch(settings.autoScanOnLaunch);
        }
        if (typeof settings.autoDetectScreenshots === 'boolean') {
          useSettingsStore.getState().setAutoDetectScreenshots(settings.autoDetectScreenshots);
        }
      }

      // 7. Refresh in-memory stores
      const scItems = await screenshotRepository.getAllScreenshots();
      useScreenshotStore.getState().setScreenshots(scItems);
      await Promise.all([
        useCategoryStore.getState().loadCategories(),
        useFolderContextStore.getState().loadStatsAndRecents(),
      ]);

      loggerService.info('Storage', 'Backup restoration completed successfully.', counts);
      return { success: true, counts };
    } catch (err: any) {
      loggerService.error('Storage', 'Failed to import backup', err);
      throw err;
    }
  }
}

export const backupService = new BackupService();

import axios from 'axios';
import { Result } from '../utils/result';
import { BackendConnectionManager } from './BackendConnectionManager';
import { visionImagePreprocessor } from '../vision/VisionImagePreprocessor';
import { visionRepository } from '../database/repositories/VisionRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { smartFolderClassificationService } from './SmartFolderClassificationService';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { databaseService } from '../database';
import { EnvironmentManager } from '../config/EnvironmentManager';
import {
  VisionStructuredOutput,
  VisionServerHealth,
  VisionModelInfo,
} from '../vision/types';

export type { VisionModelInfo };

export interface ScreenshotAnalysisResult extends VisionStructuredOutput {
  title: string;
  summary: string;
  confidence: number;
  screen_type: string;
  category: string;
  folder_hierarchy: string[];
  merchant?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  date?: string;
  entities: Record<string, any>;
  tags: string[];
  ocr_text: string;
  bullet_points: string[];
  cached?: boolean;
  processingTimeMs?: number;
}

export interface AnalyzeScreenshotParams {
  screenshotId: string;
  filePath: string;
  fileHash?: string;
  fileName?: string;
  forceRefresh?: boolean;
  imageDimensions?: { width?: number; height?: number };
}

export interface PingResult {
  online: boolean;
  latencyMs: number;
  status: string;
  model?: string;
  gpu?: string;
  error?: string;
}

/**
 * Extracts and normalizes production-ready metadata from a raw Vision AI gateway response.
 * Completely eliminates any frontend OCR parsing or fallback dependencies.
 */
export function extractMetadataFromVisionResponse(raw: any): ScreenshotAnalysisResult {
  if (!raw || typeof raw !== 'object') {
    return {
      title: 'Screenshot',
      summary: 'Screenshot analyzed by Vision AI',
      confidence: 0.95,
      screen_type: 'general',
      category: 'Other',
      folder_hierarchy: ['Other'],
      entities: {},
      tags: ['screenshot'],
      ocr_text: '',
      bullet_points: [],
    };
  }

  const extracted = raw.extracted_data || raw.scene || raw;
  const title = String(raw.title || extracted.title || raw.application || 'Screenshot');
  const summary = String(raw.summary || extracted.summary || title || 'Screenshot analyzed by Vision AI');

  // Confidence (0.0 to 1.0 or percentage)
  let confidence = Number(raw.confidence ?? extracted.confidence ?? 0.95);
  if (confidence > 1.0) {
    confidence = Math.round(confidence) <= 100 ? confidence / 100 : 0.95;
  }

  const screen_type = String(
    raw.screen_type || raw.screenType || extracted.screen_type || extracted.screenType || 'general'
  ).toLowerCase();

  const rawCat = raw.category || extracted.category || 'Other';
  const category =
    rawCat.charAt(0).toUpperCase() + rawCat.slice(1);

  // Entities
  const entities: Record<string, any> = {};
  const rawEntities = raw.entities || extracted.entities;
  if (rawEntities && typeof rawEntities === 'object') {
    Object.assign(entities, rawEntities);
  }

  // Merchant
  const merchant = raw.merchant || extracted.merchant || entities.merchant || raw.application || extracted.application || undefined;
  if (merchant) {
    entities.merchant = merchant;
  }

  // Amount
  let amount: number | undefined = undefined;
  if (raw.amount !== undefined && raw.amount !== null) {
    amount = Number(raw.amount);
  } else if (extracted.amount !== undefined && extracted.amount !== null) {
    amount = Number(extracted.amount);
  } else if (entities.amount !== undefined && entities.amount !== null) {
    amount = Number(entities.amount);
  }

  // Currency
  const currency = String(raw.currency || extracted.currency || entities.currency || 'INR');

  // Payment method
  const payment_method = raw.payment_method || extracted.payment_method || entities.payment_method || entities.paymentMethod || undefined;

  // Date
  const date = raw.date || extracted.date || entities.date || entities.transactionDate || new Date().toISOString();

  // Folder hierarchy
  let folder_hierarchy: string[] = [];
  if (Array.isArray(raw.folder_hierarchy) && raw.folder_hierarchy.length > 0) {
    folder_hierarchy = raw.folder_hierarchy;
  } else if (Array.isArray(extracted.folder_hierarchy) && extracted.folder_hierarchy.length > 0) {
    folder_hierarchy = extracted.folder_hierarchy;
  } else {
    folder_hierarchy = merchant && merchant.toLowerCase() !== category.toLowerCase()
      ? [category, merchant]
      : [category];
  }

  // Tags
  let tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags.map((t: any) => String(t).toLowerCase().trim()).filter(Boolean);
  } else if (Array.isArray(extracted.tags)) {
    tags = extracted.tags.map((t: any) => String(t).toLowerCase().trim()).filter(Boolean);
  }
  if (!tags.includes(category.toLowerCase())) {
    tags.push(category.toLowerCase());
  }

  // Bullet points
  const bullet_points: string[] = Array.isArray(raw.bullet_points)
    ? raw.bullet_points.map((p: any) => String(p).trim()).filter(Boolean)
    : Array.isArray(extracted.points)
    ? extracted.points.map((p: any) => String(p).trim()).filter(Boolean)
    : [];

  // OCR Text extracted exclusively from Vision AI
  let ocr_text = String(raw.ocr_text || extracted.ocr_text || raw.rawText || '').trim();
  if (!ocr_text) {
    const parts = [title, summary];
    if (merchant) parts.push(`Merchant: ${merchant}`);
    if (amount !== undefined) parts.push(`Amount: ${currency} ${amount}`);
    parts.push(...bullet_points);
    ocr_text = parts.filter(Boolean).join(' • ');
  }

  return {
    title,
    summary,
    confidence,
    screen_type,
    category,
    folder_hierarchy,
    merchant,
    amount,
    currency,
    payment_method,
    date,
    entities,
    tags,
    ocr_text,
    bullet_points,
  };
}

export class VisionAIService {
  /**
   * Pings the Local Vision AI Server through the Ubuntu FastAPI Gateway.
   * Enforces strict 5-second timeout.
   */
  async pingVisionServer(): Promise<PingResult> {
    const startTime = Date.now();
    const url = `${BackendConnectionManager.getApiUrl()}/vision/health`;

    try {
      const res = await axios.get<VisionServerHealth>(url, { timeout: 5000 });
      const latencyMs = Date.now() - startTime;
      const isHealthy = res.data && (res.data.status === 'healthy' || (res.data as any).online || res.data.modelLoaded);

      return {
        online: Boolean(isHealthy),
        latencyMs,
        status: res.data.status || 'unknown',
        model: res.data.model,
        gpu: res.data.gpu,
        error: isHealthy ? undefined : (res.data.error || 'Vision Server Unavailable'),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout =
        err?.code === 'ECONNABORTED' || (err?.message || '').toLowerCase().includes('timeout');

      return {
        online: false,
        latencyMs,
        status: isTimeout ? 'timeout' : 'offline',
        error: isTimeout ? 'Vision Server Timeout' : 'Vision Server Offline',
      };
    }
  }

  /**
   * Fetches active model parameters from the Local Vision Server.
   */
  async getModelInfo(): Promise<VisionModelInfo | null> {
    const url = `${BackendConnectionManager.getApiUrl()}/vision/model-info`;
    try {
      const res = await axios.get<VisionModelInfo>(url, { timeout: 5000 });
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Primary screenshot understanding engine.
   * Uploads image to Vision AI, normalizes metadata, persists to SQLite,
   * updates Smart Folder assignment, and returns ScreenshotAnalysisResult.
   * Completely independent of Google ML Kit.
   */
  async analyzeScreenshot(
    params: AnalyzeScreenshotParams
  ): Promise<Result<ScreenshotAnalysisResult>> {
    const { screenshotId, filePath, fileHash, fileName, forceRefresh } = params;
    const startTime = Date.now();

    if (!screenshotId || !filePath) {
      return Result.failure('Screenshot ID and file path are required for Vision AI.', 'INVALID_ARGS');
    }

    try {
      // 1. Check SQLite vision_cache first (if not forceRefresh)
      if (!forceRefresh) {
        if (fileHash) {
          const cachedByHash = await visionRepository.getByFileHash(fileHash);
          if (cachedByHash) {
            const structured = this.mapCacheRecordToAnalysisResult(cachedByHash);
            return Result.success({
              ...structured,
              cached: true,
              processingTimeMs: Date.now() - startTime,
            });
          }
        }

        const cachedById = await visionRepository.getVisionResult(screenshotId);
        if (cachedById) {
          const structured = this.mapCacheRecordToAnalysisResult(cachedById);
          return Result.success({
            ...structured,
            cached: true,
            processingTimeMs: Date.now() - startTime,
          });
        }
      }

      let analysisResult: ScreenshotAnalysisResult | null = null;
      let modelVersionUsed = 'local:Qwen2.5-VL-3B-Instruct';
      let preprocessedUri = filePath;

      // 2. Multimodal Vision Analysis via Local Qwen2.5-VL-3B Gateway
      if (!analysisResult) {
        // Health check before upload
        const health = await this.pingVisionServer();
        if (!health.online) {
          console.warn(`[VisionAIService] Vision server is offline: ${health.error}`);
          return Result.failure(
            health.error || 'Vision Server Offline',
            'VISION_SERVER_OFFLINE'
          );
        }

        // Image Preprocessing (max 1024px longest edge, maintain aspect ratio)
        const preprocessed = await visionImagePreprocessor.preprocess(
          filePath,
          params.imageDimensions
        );
        preprocessedUri = preprocessed.uri;

        // Send multipart request to Ubuntu FastAPI Gateway
        const endpoint = `${BackendConnectionManager.getApiUrl()}/vision/analyze`;
        const formData = new FormData();
        const uploadName = fileName || `screenshot_${Date.now()}.jpg`;

        formData.append('image', {
          uri: preprocessed.uri,
          type: 'image/jpeg',
          name: uploadName,
        } as any);

        const headers: Record<string, string> = {
          'Content-Type': 'multipart/form-data',
        };
        const qwenKey = EnvironmentManager.getQwenApiKey();
        if (qwenKey) {
          headers['Authorization'] = `Bearer ${qwenKey}`;
          headers['X-API-Key'] = qwenKey;
        }

        const response = await axios.post(endpoint, formData, {
          headers,
          timeout: 120000,
        });

        const raw = response.data;
        if (!raw) {
          return Result.failure('Invalid Vision Response: Empty data returned', 'INVALID_RESPONSE');
        }

        analysisResult = extractMetadataFromVisionResponse(raw);
        modelVersionUsed = 'local:Qwen2.5-VL-3B-Instruct';
      }

      const processingTimeMs = Date.now() - startTime;
      analysisResult.cached = false;
      analysisResult.processingTimeMs = processingTimeMs;

      // 6. Save to SQLite vision_cache
      await visionRepository.saveStructuredResult({
        screenshotId,
        fileHash,
        structured: {
          category: analysisResult.category,
          confidence: Math.round(analysisResult.confidence * 100),
          summary: analysisResult.summary,
          tags: analysisResult.tags,
          entities: analysisResult.entities,
        },
        modelVersion: modelVersionUsed,
      });

      // 7. Save to SQLite classification_cache
      try {
        await databaseService.executeCommand(
          `INSERT OR REPLACE INTO classification_cache 
          (id, screenshot_id, category, subcategory, tags_json, entities_json, confidence, summary, source, vision_version, cached_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `cache_${screenshotId}`,
            screenshotId,
            analysisResult.category,
            analysisResult.folder_hierarchy[1] || 'General',
            JSON.stringify(analysisResult.tags),
            JSON.stringify(analysisResult.entities),
            analysisResult.confidence,
            analysisResult.summary,
            'vision_ai',
            modelVersionUsed,
            new Date().toISOString(),
          ]
        );
      } catch (cacheErr) {
        console.warn('[VisionAIService] Error saving to classification_cache:', cacheErr);
      }

      // 8. Update screenshots table with Vision OCR text and analysis status
      try {
        await databaseService.executeCommand(
          `UPDATE screenshots SET 
            ocr_text = ?, 
            analysis_status = 'Completed', 
            analysis_processing_time = ?,
            ocr_status = 'completed'
           WHERE id = ?`,
          [analysisResult.ocr_text, processingTimeMs, screenshotId]
        );
      } catch (dbErr) {
        console.warn('[VisionAIService] Error updating screenshots table:', dbErr);
      }

      // 9. Automatic Smart Folder Integration
      await this.updateSmartFolderForScreenshot(screenshotId, analysisResult, preprocessedUri);

      return Result.success(analysisResult);
    } catch (err: any) {
      console.error(`[VisionAIService] Analysis failed for ${screenshotId}:`, err);
      const friendlyMessage = this.mapVisionError(err);
      return Result.failure(friendlyMessage, 'VISION_ANALYSIS_FAILED');
    }
  }

  /**
   * Batch analysis with Concurrency = 1 (sequential processing to protect RTX 4050 VRAM).
   */
  async analyzeBatch(
    items: AnalyzeScreenshotParams[],
    onProgress?: (current: number, total: number, result: ScreenshotAnalysisResult | null) => void
  ): Promise<{ successful: number; failed: number; results: (ScreenshotAnalysisResult | null)[] }> {
    let successful = 0;
    let failed = 0;
    const results: (ScreenshotAnalysisResult | null)[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const res = await this.analyzeScreenshot(item);

      if (res.isSuccess && res.data) {
        successful++;
        results.push(res.data);
        if (onProgress) onProgress(i + 1, items.length, res.data);
      } else {
        failed++;
        results.push(null);
        if (onProgress) onProgress(i + 1, items.length, null);
      }
    }

    return { successful, failed, results };
  }

  async getCacheStats(): Promise<{ cachedCount: number; lastCachedAt?: string }> {
    return visionRepository.getCacheStats();
  }

  async clearVisionCache(): Promise<void> {
    await visionRepository.clearCache();
  }

  /**
   * Updates Smart Folder category, cover image, confidence, counts, and Zustand stores.
   */
  private async updateSmartFolderForScreenshot(
    screenshotId: string,
    analysis: ScreenshotAnalysisResult,
    thumbnailPath?: string
  ): Promise<void> {
    try {
      const existing = await screenshotRepository.getScreenshotById(screenshotId);
      if (existing) {
        await smartFolderClassificationService.assignScreenshotToSmartFolder({
          screenshotId,
          fileName: existing.fileName,
          filePath: existing.filePath,
          localPath: existing.localPath,
          contentUri: existing.contentUri,
          thumbnailUri: thumbnailPath || existing.thumbnailUri,
          ocrText: analysis.ocr_text,
          fileSize: existing.fileSize,
          forceRefresh: true,
        });
      }
    } catch (err) {
      console.warn(`[VisionAIService] Failed to update Smart Folder for ${screenshotId}:`, err);
    }
  }

  private mapCacheRecordToAnalysisResult(cached: any): ScreenshotAnalysisResult {
    let entities: Record<string, any> = {};
    let tags: string[] = [];

    try {
      entities = JSON.parse(cached.detected_entities || '{}');
    } catch {}

    try {
      tags = JSON.parse(cached.detected_objects || '[]');
    } catch {}

    const catName = cached.screen_type
      ? cached.screen_type.charAt(0).toUpperCase() + cached.screen_type.slice(1)
      : 'Other';

    return {
      title: entities.title || catName,
      summary: cached.summary || '',
      confidence: cached.confidence <= 1 ? cached.confidence : cached.confidence / 100,
      screen_type: cached.screen_type || 'general',
      category: catName,
      folder_hierarchy: [catName],
      merchant: entities.merchant || cached.application_name,
      amount: entities.amount ? Number(entities.amount) : undefined,
      currency: entities.currency || 'INR',
      payment_method: entities.payment_method || entities.paymentMethod,
      date: entities.date || cached.created_at,
      entities,
      tags,
      ocr_text: cached.summary || '',
      bullet_points: [],
      cached: true,
    };
  }

  private mapVisionError(err: any): string {
    if (!err) return 'Unable to analyze screenshot';
    const code = (err.code || '').toUpperCase();
    const msg = (err.message || '').toLowerCase();
    const backendDetail = err.response?.data?.detail || err.response?.data?.message;

    if (backendDetail && typeof backendDetail === 'string') {
      if (backendDetail.includes('Offline')) return 'Vision Server Offline';
      if (backendDetail.includes('Timeout')) return 'Vision Server Timeout';
      if (backendDetail.includes('Invalid')) return 'Invalid AI Response';
      if (backendDetail.includes('Failed')) return 'Vision Analysis Failed';
    }

    if (code === 'ECONNREFUSED' || msg.includes('econnrefused')) {
      return 'Vision Server Offline';
    }

    if (code === 'ECONNABORTED' || msg.includes('timeout')) {
      return 'Vision Server Timeout';
    }

    return err.message || 'Vision Analysis Failed';
  }
}

export const visionAIService = new VisionAIService();

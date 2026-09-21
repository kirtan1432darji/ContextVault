import axios from 'axios';
import { Result } from '../utils/result';
import { BackendConnectionManager } from './BackendConnectionManager';
import { visionImagePreprocessor } from '../vision/VisionImagePreprocessor';
import { visionRepository } from '../database/repositories/VisionRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { smartFolderService } from './SmartFolderService';
import { smartFolderClassificationService } from './SmartFolderClassificationService';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import {
  VisionStructuredOutput,
  VisionServerHealth,
  VisionModelInfo,
} from '../vision/types';

export interface AnalyzeScreenshotParams {
  screenshotId: string;
  filePath: string;
  fileHash?: string;
  fileName?: string;
  ocrText?: string;
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
      const isHealthy = res.data && res.data.status === 'healthy';

      return {
        online: isHealthy,
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
   * Analyzes a single screenshot using the Local Vision AI Server on RTX 4050.
   *
   * Complete Pipeline:
   * 1. SHA-256 cache check (never re-analyze duplicate images).
   * 2. Quick 5s health check (aborts early with friendly message if offline).
   * 3. Image preprocessing (longest edge 1024px, JPEG quality 85%, EXIF stripped).
   * 4. Streaming upload to Ubuntu gateway: POST /api/vision/analyze
   * 5. Parse structured JSON (category, confidence, summary, tags, entities).
   * 6. Save metadata to SQLite (vision_cache & classification_cache).
   * 7. Automatic Smart Folder update (category, cover, confidence, count, stores).
   */
  async analyzeScreenshot(
    params: AnalyzeScreenshotParams
  ): Promise<Result<VisionStructuredOutput & { cached: boolean; processingTimeMs: number }>> {
    const { screenshotId, filePath, fileHash, fileName, ocrText, forceRefresh } = params;
    const startTime = Date.now();

    if (!screenshotId || !filePath) {
      return Result.failure('Screenshot ID and file path are required for Vision AI.', 'INVALID_ARGS');
    }

    try {
      // 1. SHA-256 & SQLite Cache Check
      if (!forceRefresh) {
        // Check by SHA-256 hash first
        if (fileHash) {
          const cachedByHash = await visionRepository.getByFileHash(fileHash);
          if (cachedByHash) {
            const structured = this.mapCacheRecordToStructured(cachedByHash);
            return Result.success({
              ...structured,
              cached: true,
              processingTimeMs: Date.now() - startTime,
            });
          }
        }

        // Check by screenshotId
        const cachedById = await visionRepository.getVisionResult(screenshotId);
        if (cachedById) {
          const structured = this.mapCacheRecordToStructured(cachedById);
          return Result.success({
            ...structured,
            cached: true,
            processingTimeMs: Date.now() - startTime,
          });
        }
      }

      // 2. Health check before upload (5-second timeout)
      const health = await this.pingVisionServer();
      if (!health.online) {
        console.warn(`[VisionAIService] Vision server is offline: ${health.error}`);
        return Result.failure(
          health.error || 'Vision Server Offline',
          'VISION_SERVER_OFFLINE'
        );
      }

      // 3. Image Preprocessing (max 1024px longest edge, maintain aspect ratio)
      const preprocessed = await visionImagePreprocessor.preprocess(
        filePath,
        params.imageDimensions
      );

      // 4. Send multipart request to Ubuntu FastAPI Gateway
      const endpoint = `${BackendConnectionManager.getApiUrl()}/vision/analyze`;
      const formData = new FormData();
      const uploadName = fileName || `screenshot_${Date.now()}.jpg`;

      formData.append('image', {
        uri: preprocessed.uri,
        type: 'image/jpeg',
        name: uploadName,
      } as any);

      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
      });

      const raw = response.data;
      if (!raw) {
        return Result.failure('Invalid Vision Response: Empty data returned', 'INVALID_RESPONSE');
      }

      // 5. Parse and normalize structured JSON (handles standard and extracted_data formats)
      const extractedData = raw.extracted_data || {};
      const points: string[] = Array.isArray(extractedData.points) ? extractedData.points : [];
      const title: string = extractedData.title || raw.title || '';

      const entities: Record<string, any> =
        typeof raw.entities === 'object' && raw.entities !== null ? { ...raw.entities } : {};

      if (title) {
        entities.title = title;
      }
      if (points.length > 0) {
        entities.points = points;
        for (const pt of points) {
          if (typeof pt === 'string') {
            const parts = pt.split(':');
            if (parts.length >= 2) {
              const key = parts[0].trim().toLowerCase();
              const val = parts.slice(1).join(':').trim();
              entities[key] = val;
            }
          }
        }
      }

      // Infer category if not directly provided
      let inferredCategory = raw.category;
      if (!inferredCategory) {
        const textToClassify = `${title} ${points.join(' ')}`.toLowerCase();
        if (
          textToClassify.includes('pay') ||
          textToClassify.includes('upi') ||
          textToClassify.includes('bank') ||
          textToClassify.includes('₹') ||
          textToClassify.includes('inr')
        ) {
          inferredCategory = 'Finance';
        } else if (
          textToClassify.includes('swiggy') ||
          textToClassify.includes('zomato') ||
          textToClassify.includes('food')
        ) {
          inferredCategory = 'Food Delivery';
        } else if (
          textToClassify.includes('amazon') ||
          textToClassify.includes('flipkart') ||
          textToClassify.includes('order')
        ) {
          inferredCategory = 'Shopping';
        } else {
          inferredCategory = 'Other';
        }
      }

      const summary =
        raw.summary ||
        (points.length > 0
          ? `${title ? `${title}: ` : ''}${points.join(' • ')}`
          : title || 'Screenshot analyzed by Local Vision AI.');

      const tags =
        Array.isArray(raw.tags) && raw.tags.length > 0
          ? raw.tags
          : [
              inferredCategory.toLowerCase(),
              ...Object.keys(entities).filter((k) => k !== 'points' && k !== 'title'),
            ];

      const structured: VisionStructuredOutput = {
        category: inferredCategory,
        confidence: Number(raw.confidence) || 100,
        summary,
        tags,
        entities,
      };

      // 6. Save to SQLite
      await visionRepository.saveStructuredResult({
        screenshotId,
        fileHash,
        structured,
        modelVersion: 'local:Qwen2.5-VL-3B-Instruct',
      });

      // 7. Automatic Smart Folder Integration
      await this.updateSmartFolderForScreenshot(screenshotId, structured, preprocessed.uri);

      const processingTimeMs = Date.now() - startTime;
      return Result.success({
        ...structured,
        cached: false,
        processingTimeMs,
      });
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
    onProgress?: (current: number, total: number, result: VisionStructuredOutput | null) => void
  ): Promise<{ successful: number; failed: number; results: (VisionStructuredOutput | null)[] }> {
    let successful = 0;
    let failed = 0;
    const results: (VisionStructuredOutput | null)[] = [];

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

  /**
   * Retrieves or computes a 40-80 word summary of a screenshot.
   */
  async summarizeScreenshot(screenshotId: string, filePath?: string): Promise<string> {
    const cached = await visionRepository.getVisionResult(screenshotId);
    if (cached && cached.summary) {
      return cached.summary;
    }

    if (filePath) {
      const res = await this.analyzeScreenshot({ screenshotId, filePath });
      if (res.isSuccess && res.data) {
        return res.data.summary;
      }
    }

    return 'No summary available.';
  }

  /**
   * Retrieves or computes category classification for a screenshot.
   */
  async classifyScreenshot(
    screenshotId: string,
    filePath?: string
  ): Promise<{ category: string; confidence: number }> {
    const cached = await visionRepository.getVisionResult(screenshotId);
    if (cached) {
      return {
        category: cached.screen_type,
        confidence: Math.round(cached.confidence * (cached.confidence <= 1 ? 100 : 1)),
      };
    }

    if (filePath) {
      const res = await this.analyzeScreenshot({ screenshotId, filePath });
      if (res.isSuccess && res.data) {
        return {
          category: res.data.category,
          confidence: res.data.confidence,
        };
      }
    }

    return { category: 'Other', confidence: 50 };
  }

  /**
   * Retrieves or extracts structured entities from a screenshot.
   */
  async extractEntities(
    screenshotId: string,
    filePath?: string
  ): Promise<Record<string, any>> {
    const cached = await visionRepository.getVisionResult(screenshotId);
    if (cached) {
      try {
        return JSON.parse(cached.detected_entities);
      } catch {
        return {};
      }
    }

    if (filePath) {
      const res = await this.analyzeScreenshot({ screenshotId, filePath });
      if (res.isSuccess && res.data) {
        return res.data.entities;
      }
    }

    return {};
  }

  /**
   * Clears the local SQLite vision cache.
   */
  async clearVisionCache(): Promise<void> {
    await visionRepository.clearCache();
  }

  /**
   * Updates Smart Folder category, cover image, confidence, counts, and Zustand stores.
   */
  private async updateSmartFolderForScreenshot(
    screenshotId: string,
    structured: VisionStructuredOutput,
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
          ocrText: existing.ocrText,
          fileSize: existing.fileSize,
          forceRefresh: true,
        });
      }
    } catch (err) {
      console.warn(`[VisionAIService] Failed to update Smart Folder for ${screenshotId}:`, err);
    }
  }

  private mapCacheRecordToStructured(cached: any): VisionStructuredOutput {
    let entities = {};
    let tags: string[] = [];

    try {
      entities = JSON.parse(cached.detected_entities || '{}');
    } catch {}

    try {
      tags = JSON.parse(cached.detected_objects || '[]');
    } catch {}

    return {
      category: cached.screen_type
        ? cached.screen_type.charAt(0).toUpperCase() + cached.screen_type.slice(1)
        : 'Other',
      confidence: Math.round(cached.confidence * (cached.confidence <= 1 ? 100 : 1)),
      summary: cached.summary || '',
      tags,
      entities,
    };
  }

  private mapVisionError(err: any): string {
    if (!err) return 'Unable to analyze screenshot';
    const code = (err.code || '').toUpperCase();
    const msg = (err.message || '').toLowerCase();
    const status = err.response?.status;
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
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || msg.includes('timeout')) {
      return 'Vision Server Timeout';
    }
    if (status === 503) {
      return 'Vision Server Offline';
    }
    if (status === 504) {
      return 'Vision Server Timeout';
    }
    if (status === 502 || msg.includes('json') || msg.includes('parse')) {
      return 'Invalid AI Response';
    }
    if (status === 500) {
      return 'Vision Analysis Failed';
    }

    return 'Unable to analyze screenshot';
  }

  private getCategoryIcon(cat: string): string {
    const c = cat.toLowerCase();
    if (c.includes('finance') || c.includes('payment')) return 'card-outline';
    if (c.includes('shop')) return 'cart-outline';
    if (c.includes('food')) return 'fast-food-outline';
    if (c.includes('travel')) return 'airplane-outline';
    if (c.includes('chat')) return 'chatbubble-ellipses-outline';
    if (c.includes('work') || c.includes('code')) return 'briefcase-outline';
    if (c.includes('health')) return 'heart-outline';
    return 'folder-outline';
  }

  private getCategoryColor(cat: string): string {
    const c = cat.toLowerCase();
    if (c.includes('finance') || c.includes('payment')) return '10B981';
    if (c.includes('shop')) return 'F59E0B';
    if (c.includes('food')) return 'EF4444';
    if (c.includes('travel')) return '06B6D4';
    if (c.includes('chat')) return 'EC4899';
    if (c.includes('work') || c.includes('code')) return '6366F1';
    if (c.includes('health')) return '14B8A6';
    return '64748B';
  }
}

export const visionAIService = new VisionAIService();

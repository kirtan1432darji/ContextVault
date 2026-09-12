import { Result } from '../utils/result';
import { visionImagePreprocessor } from './VisionImagePreprocessor';
import { visionPromptBuilder } from './VisionPromptBuilder';
import { visionModelManager } from './VisionModelManager';
import { visionResultParser } from './VisionResultParser';
import { visionRepository } from '../database/repositories/VisionRepository';
import { entityMergeService } from '../services/EntityMergeService';
import {
  VisionCacheRecord,
  VisionInferenceResult,
  VisionScene,
  UnifiedScreenshotMetadata,
} from './types';

export class VisionAIService {
  /**
   * Analyzes a screenshot visually.
   * Checks SQLite vision_cache first. If cache missed or forced refresh:
   * pre-processes image, formats domain prompt, runs multi-key failover inference,
   * parses structured scene JSON, and persists to SQLite vision_cache.
   */
  async analyzeScreenshot(params: {
    screenshotId: string;
    filePath: string;
    fileName?: string;
    ocrText?: string;
    forceRefresh?: boolean;
    imageDimensions?: { width?: number; height?: number };
  }): Promise<Result<VisionInferenceResult>> {
    const { screenshotId, filePath, fileName, ocrText, forceRefresh } = params;
    const startTime = Date.now();

    if (!screenshotId || !filePath) {
      return Result.failure('Screenshot ID and file path are required for Vision AI.', 'INVALID_ARGS');
    }

    try {
      // 1. Check SQLite vision_cache first (offline-first retrieval)
      if (!forceRefresh) {
        const cached = await visionRepository.getVisionResult(screenshotId);
        if (cached) {
          const cachedScene: VisionScene = {
            screenType: cached.screen_type,
            application: cached.application_name,
            summary: cached.summary,
            objects: this.safeJsonParse<string[]>(cached.detected_objects, []),
            entities: this.safeJsonParse<Record<string, any>>(cached.detected_entities, {}),
            confidence: cached.confidence,
            detectedLogos: this.safeJsonParse<string[]>(cached.detected_logos, []),
            detectedIcons: [],
            colors: [],
            language: 'en',
          };

          return Result.success({
            screenshotId,
            scene: cachedScene,
            processingTimeMs: Date.now() - startTime,
            modelVersion: cached.model_version,
            provider: 'sqlite_cache',
            cached: true,
          });
        }
      }

      // 2. Preprocess image (scale to max 1024px longest edge, maintain aspect ratio)
      const preprocessed = await visionImagePreprocessor.preprocess(
        filePath,
        params.imageDimensions
      );

      // 3. Build multimodal prompt (shopping, banking, code, chat, general)
      const prompt = visionPromptBuilder.buildPrompt({
        ocrText,
        fileName,
      });

      // 4. Run inference with multi-key failover:
      // Key 1 -> Key 2 -> Key 3 -> Key 4 -> LocalVisionFallbackAdapter
      const inference = await visionModelManager.executeWithFailover({
        image: preprocessed,
        prompt,
        ocrText,
        fileName,
      });

      // 5. Parse and validate structured VisionScene
      const parsedScene = visionResultParser.parse(inference.rawResponse, {
        summary: `Screenshot analyzed via ${inference.provider}`,
      });

      const processingTimeMs = Date.now() - startTime;

      // 6. Save to SQLite vision_cache
      const cacheRecord: VisionCacheRecord = {
        screenshot_id: screenshotId,
        screen_type: String(parsedScene.screenType || 'other'),
        application_name: parsedScene.application || 'Unknown',
        summary: parsedScene.summary || '',
        detected_objects: JSON.stringify(parsedScene.objects || []),
        detected_entities: JSON.stringify(parsedScene.entities || {}),
        detected_logos: JSON.stringify(parsedScene.detectedLogos || []),
        confidence: parsedScene.confidence || 0.88,
        processed_at: new Date().toISOString(),
        model_version: `${inference.provider}:${inference.modelVersion}`,
      };

      await visionRepository.saveVisionResult(cacheRecord);

      return Result.success({
        screenshotId,
        scene: parsedScene,
        processingTimeMs,
        modelVersion: inference.modelVersion,
        provider: inference.provider,
        cached: false,
        rawResponse: inference.rawResponse,
      });
    } catch (err: any) {
      console.warn(`[VisionAIService] Vision analysis failed for ${screenshotId}:`, err?.message);
      return Result.failure(err?.message || 'Vision AI processing failed', 'VISION_ERROR');
    }
  }

  /**
   * Convenience method to extract unified metadata merging OCR and Vision.
   */
  async getUnifiedMetadata(params: {
    screenshotId: string;
    filePath: string;
    ocrText?: string;
    fileName?: string;
  }): Promise<UnifiedScreenshotMetadata> {
    const visionRes = await this.analyzeScreenshot(params);

    const defaultScene: VisionScene = {
      screenType: 'other',
      application: 'Unknown',
      summary: '',
      objects: [],
      entities: {},
      confidence: 0.5,
      detectedLogos: [],
      detectedIcons: [],
      colors: [],
      language: 'en',
    };

    const scene = visionRes.isSuccess && visionRes.data ? visionRes.data.scene : defaultScene;

    return entityMergeService.merge({
      screenshotId: params.screenshotId,
      ocrText: params.ocrText,
      visionScene: scene,
    });
  }

  private safeJsonParse<T>(jsonStr: string, fallback: T): T {
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      return fallback;
    }
  }
}

export const visionAIService = new VisionAIService();

import { VisionScene } from './types';

export class VisionResultParser {
  /**
   * Safely parses raw model string response into a strongly validated VisionScene.
   */
  parse(rawOutput: string, fallbackDefaults?: Partial<VisionScene>): VisionScene {
    if (!rawOutput || typeof rawOutput !== 'string') {
      return this.buildDefaultScene('Empty model response', fallbackDefaults);
    }

    try {
      const jsonString = this.extractJsonString(rawOutput);
      const parsed = JSON.parse(jsonString);

      return this.validateAndNormalize(parsed, fallbackDefaults);
    } catch (err: any) {
      console.warn('[VisionResultParser] Failed to parse model JSON, using fallback:', err?.message);
      return this.buildDefaultScene(rawOutput.substring(0, 120), fallbackDefaults);
    }
  }

  /**
   * Extracts clean JSON substring from text that may contain markdown fences or surrounding chatter.
   */
  private extractJsonString(raw: string): string {
    let cleaned = raw.trim();

    // 1. Remove markdown code blocks (e.g. ```json ... ``` or ``` ...)
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1].trim();
    }

    // 2. Find first '{' and last '}'
    const firstOpen = cleaned.indexOf('{');
    const lastClose = cleaned.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      cleaned = cleaned.substring(firstOpen, lastClose + 1);
    }

    // 3. Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    return cleaned;
  }

  /**
   * Validates each field of the parsed object and fills in sensible defaults.
   */
  private validateAndNormalize(
    obj: any,
    fallback?: Partial<VisionScene>
  ): VisionScene {
    if (!obj || typeof obj !== 'object') {
      return this.buildDefaultScene('Invalid object structure', fallback);
    }

    const screenType =
      typeof obj.screenType === 'string' && obj.screenType.trim().length > 0
        ? obj.screenType.trim()
        : fallback?.screenType || 'other';

    const application =
      typeof obj.application === 'string' && obj.application.trim().length > 0
        ? obj.application.trim()
        : fallback?.application || 'Unknown Application';

    const summary =
      typeof obj.summary === 'string' && obj.summary.trim().length > 0
        ? obj.summary.trim()
        : fallback?.summary || 'Screenshot visual representation processed.';

    const objects = Array.isArray(obj.objects)
      ? obj.objects.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
      : fallback?.objects || [];

    const entities =
      obj.entities && typeof obj.entities === 'object' && !Array.isArray(obj.entities)
        ? obj.entities
        : fallback?.entities || {};

    let confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.88;
    if (confidence < 0 || confidence > 1) {
      confidence = Math.min(1.0, Math.max(0.0, confidence));
    }

    const detectedLogos = Array.isArray(obj.detectedLogos)
      ? obj.detectedLogos.filter((item: any) => typeof item === 'string')
      : fallback?.detectedLogos || [];

    const detectedIcons = Array.isArray(obj.detectedIcons)
      ? obj.detectedIcons.filter((item: any) => typeof item === 'string')
      : fallback?.detectedIcons || [];

    const colors = Array.isArray(obj.colors)
      ? obj.colors.filter((item: any) => typeof item === 'string')
      : fallback?.colors || ['#1E293B', '#FFFFFF'];

    const language =
      typeof obj.language === 'string' && obj.language.trim().length > 0
        ? obj.language.trim()
        : fallback?.language || 'en';

    return {
      screenType,
      application,
      summary,
      objects,
      entities,
      confidence,
      detectedLogos,
      detectedIcons,
      colors,
      language,
    };
  }

  private buildDefaultScene(
    hint: string,
    fallback?: Partial<VisionScene>
  ): VisionScene {
    return {
      screenType: fallback?.screenType || 'other',
      application: fallback?.application || 'Unknown Application',
      summary: fallback?.summary || `Screenshot analyzed (${hint}).`,
      objects: fallback?.objects || ['Screen Container', 'Text Block'],
      entities: fallback?.entities || {},
      confidence: fallback?.confidence || 0.75,
      detectedLogos: fallback?.detectedLogos || [],
      detectedIcons: fallback?.detectedIcons || ['back_button'],
      colors: fallback?.colors || ['#1E293B'],
      language: fallback?.language || 'en',
    };
  }
}

export const visionResultParser = new VisionResultParser();

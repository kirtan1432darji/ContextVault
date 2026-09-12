import { PreprocessedImage } from './types';
import { FileUtils } from '../utils/fileUtils';

export interface PreprocessorOptions {
  maxResolution?: number; // Target max longest edge (default: 1024px)
  preferredFormat?: 'jpeg' | 'rgb';
  jpegQuality?: number; // 0.0 - 1.0 (default: 0.85)
}

export class VisionImagePreprocessor {
  private readonly defaultMaxResolution: number = 1024;
  private readonly defaultQuality: number = 0.85;

  /**
   * Calculates target resolution maintaining the original aspect ratio
   * such that the longest edge does not exceed maxResolution.
   */
  calculateTargetDimensions(
    originalWidth: number,
    originalHeight: number,
    maxResolution: number = this.defaultMaxResolution
  ): { targetWidth: number; targetHeight: number; scaleFactor: number; aspectRatio: number } {
    const validWidth = originalWidth > 0 ? originalWidth : 1080;
    const validHeight = originalHeight > 0 ? originalHeight : 2400;
    const aspectRatio = validWidth / validHeight;

    const longestEdge = Math.max(validWidth, validHeight);
    const scaleFactor = longestEdge > maxResolution ? maxResolution / longestEdge : 1.0;

    const targetWidth = Math.max(1, Math.round(validWidth * scaleFactor));
    const targetHeight = Math.max(1, Math.round(validHeight * scaleFactor));

    return {
      targetWidth,
      targetHeight,
      scaleFactor,
      aspectRatio,
    };
  }

  /**
   * Preprocesses a screenshot image for vision inference.
   * Scales to 1024px longest edge, normalizes orientation, formats to RGB,
   * and prepares image metadata for on-device and cloud VLM pipelines.
   */
  async preprocess(
    filePath: string,
    metadata?: {
      width?: number;
      height?: number;
      orientation?: number;
      base64?: string;
    },
    options?: PreprocessorOptions
  ): Promise<PreprocessedImage> {
    const maxRes = options?.maxResolution || this.defaultMaxResolution;
    const normalizedUri = FileUtils.normalizeImageUri(filePath);

    const origW = metadata?.width || 1080;
    const origH = metadata?.height || 2400;
    const orientation = metadata?.orientation || 1;

    const { targetWidth, targetHeight, scaleFactor, aspectRatio } =
      this.calculateTargetDimensions(origW, origH, maxRes);

    // Estimate uncompressed and compressed image footprint
    const rawPixelCount = targetWidth * targetHeight;
    const rawRgbBytes = rawPixelCount * 3;
    // JPEG at 85% quality is typically ~0.15 - 0.25 bytes per pixel
    const compressedSizeEstimateBytes = Math.round(rawRgbBytes * 0.18);

    let base64Data = metadata?.base64;
    if (!base64Data && normalizedUri.startsWith('data:image/')) {
      const commaIdx = normalizedUri.indexOf(',');
      if (commaIdx !== -1) {
        base64Data = normalizedUri.substring(commaIdx + 1);
      }
    }

    return {
      uri: normalizedUri,
      width: targetWidth,
      height: targetHeight,
      originalWidth: origW,
      originalHeight: origH,
      scaleFactor,
      aspectRatio,
      format: 'jpeg',
      colorSpace: 'sRGB',
      orientation,
      base64: base64Data,
      compressedSizeEstimateBytes,
    };
  }
}

export const visionImagePreprocessor = new VisionImagePreprocessor();

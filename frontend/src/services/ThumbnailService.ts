import { Platform } from 'react-native';
import { mediaObserverService } from './backgroundDetection/mediaObserver';
import { MediaStorePathResolver } from '../utils/MediaStorePathResolver';

export class ThumbnailService {
  private static instance: ThumbnailService;

  public static getInstance(): ThumbnailService {
    if (!ThumbnailService.instance) {
      ThumbnailService.instance = new ThumbnailService();
    }
    return ThumbnailService.instance;
  }

  /**
   * Generates or reuses a 300px cached thumbnail for the provided screenshot URI or path.
   * If native thumbnail generation is unavailable, falls back to the resolved display URI.
   */
  async getOrCreateThumbnail(uriOrPath?: string | null, targetSize = 300): Promise<string | null> {
    if (!uriOrPath || typeof uriOrPath !== 'string') {
      return null;
    }

    const clean = uriOrPath.trim();
    if (!clean) return null;

    if (Platform.OS === 'android') {
      try {
        const thumbUri = await mediaObserverService.generateThumbnail(clean, targetSize);
        if (thumbUri) {
          return thumbUri;
        }
      } catch (err) {
        console.warn('[ThumbnailService] Native thumbnail generation failed:', err);
      }
    }

    // Fallback: Return normalized URI if native thumbnail generation fails
    return MediaStorePathResolver.normalizeFileUri(clean) || clean;
  }

  /**
   * Deletes a cached thumbnail file when its screenshot is deleted.
   */
  async deleteThumbnail(thumbnailUri?: string | null): Promise<boolean> {
    if (!thumbnailUri || typeof thumbnailUri !== 'string') {
      return false;
    }

    if (Platform.OS === 'android') {
      try {
        return await mediaObserverService.deleteThumbnail(thumbnailUri);
      } catch (err) {
        console.warn('[ThumbnailService] Failed to delete thumbnail:', err);
      }
    }

    return false;
  }
}

export const thumbnailService = ThumbnailService.getInstance();

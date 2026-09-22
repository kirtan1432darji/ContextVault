import { Platform } from 'react-native';
import { mediaObserverService } from './backgroundDetection/mediaObserver';
import { MediaStorePathResolver } from '../utils/MediaStorePathResolver';
import { getDatabase } from '../database';

export interface ThumbnailCacheStats {
  inMemoryCount: number;
  dbCount: number;
  totalSizeBytes: number;
}

export class ThumbnailService {
  private static instance: ThumbnailService;
  private memoryCache: Map<string, string> = new Map();
  private maxMemoryEntries = 200;

  public static getInstance(): ThumbnailService {
    if (!ThumbnailService.instance) {
      ThumbnailService.instance = new ThumbnailService();
    }
    return ThumbnailService.instance;
  }

  /**
   * Generates or reuses a cached thumbnail for the provided screenshot URI or path.
   * Leverages Android ContentResolver.loadThumbnail (API 29+) with in-memory
   * and SQLite caching. Falls back to Scoped Storage Content URI or normalized file URI.
   */
  async getOrCreateThumbnail(
    uriOrPath?: string | null,
    targetSize = 300,
    screenshotId?: string,
    fileHash?: string
  ): Promise<string | null> {
    if (!uriOrPath || typeof uriOrPath !== 'string') {
      return null;
    }

    const clean = uriOrPath.trim();
    if (!clean) return null;

    const cacheKey = `${clean}_${targetSize}`;

    // 1. In-memory check
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // 2. SQLite thumbnail_cache check
    if (screenshotId || fileHash) {
      try {
        const db = await getDatabase();
        let query = 'SELECT thumbnail_path FROM thumbnail_cache WHERE width = ?';
        const params: any[] = [targetSize];

        if (screenshotId && fileHash) {
          query += ' AND (screenshot_id = ? OR file_hash = ?) LIMIT 1';
          params.push(screenshotId, fileHash);
        } else if (screenshotId) {
          query += ' AND screenshot_id = ? LIMIT 1';
          params.push(screenshotId);
        } else {
          query += ' AND file_hash = ? LIMIT 1';
          params.push(fileHash);
        }

        const [results] = await db.executeSql(query, params);
        if (results && results.rows.length > 0) {
          const cachedPath = results.rows.item(0).thumbnail_path;
          if (cachedPath) {
            this.setMemoryCache(cacheKey, cachedPath);
            return cachedPath;
          }
        }
      } catch (e) {
        // Non-critical: continue to generation
      }
    }

    // 3. Android Native Hardware-Accelerated Generation
    if (Platform.OS === 'android') {
      try {
        const thumbUri = await mediaObserverService.generateThumbnail(clean, targetSize);
        if (thumbUri) {
          this.setMemoryCache(cacheKey, thumbUri);

          // Persist to SQLite thumbnail_cache
          if (screenshotId || fileHash) {
            try {
              const db = await getDatabase();
              const id = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              await db.executeSql(
                `INSERT OR REPLACE INTO thumbnail_cache (id, screenshot_id, file_hash, thumbnail_path, width, height)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, screenshotId || id, fileHash || null, thumbUri, targetSize, targetSize]
              );
            } catch (dbErr) {
              // Ignore insertion error
            }
          }

          return thumbUri;
        }
      } catch (err) {
        console.warn('[ThumbnailService] Native thumbnail generation failed:', err);
      }
    }

    // 4. Fallback: Return normalized URI if native generation fails
    const fallback = MediaStorePathResolver.normalizeFileUri(clean) || clean;
    this.setMemoryCache(cacheKey, fallback);
    return fallback;
  }

  /**
   * Deletes a cached thumbnail file when its screenshot is deleted.
   */
  async deleteThumbnail(thumbnailUri?: string | null): Promise<boolean> {
    if (!thumbnailUri || typeof thumbnailUri !== 'string') {
      return false;
    }

    // Remove from in-memory cache
    for (const [key, val] of this.memoryCache.entries()) {
      if (val === thumbnailUri) {
        this.memoryCache.delete(key);
      }
    }

    // Remove from SQLite cache
    try {
      const db = await getDatabase();
      await db.executeSql('DELETE FROM thumbnail_cache WHERE thumbnail_path = ?', [thumbnailUri]);
    } catch {
      // Non-critical
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

  /**
   * Queries cache statistics for diagnostics.
   */
  async getCacheStats(): Promise<ThumbnailCacheStats> {
    let dbCount = 0;
    try {
      const db = await getDatabase();
      const [results] = await db.executeSql('SELECT COUNT(*) as count FROM thumbnail_cache');
      if (results && results.rows.length > 0) {
        dbCount = results.rows.item(0).count;
      }
    } catch {}

    // Estimated size: ~35KB per 300x300 compressed JPEG/WebP thumbnail
    const totalSizeBytes = dbCount * 35840;

    return {
      inMemoryCount: this.memoryCache.size,
      dbCount,
      totalSizeBytes,
    };
  }

  /**
   * Clears the thumbnail cache.
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    try {
      const db = await getDatabase();
      await db.executeSql('DELETE FROM thumbnail_cache');
    } catch {}
  }

  private setMemoryCache(key: string, value: string): void {
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, value);
  }
}

export const thumbnailService = ThumbnailService.getInstance();

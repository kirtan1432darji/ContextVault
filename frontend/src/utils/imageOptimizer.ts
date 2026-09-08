export interface CachedThumbnail {
  uri: string;
  timestamp: number;
  width: number;
  height: number;
}

class ImageOptimizer {
  private cache: Map<string, CachedThumbnail> = new Map();
  private maxCacheEntries = 120;

  /**
   * Registers a thumbnail in the fast memory cache.
   */
  rememberThumbnail(uri: string, width = 200, height = 200): void {
    if (this.cache.size >= this.maxCacheEntries) {
      // Evict oldest entry (LRU)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(uri, {
      uri,
      timestamp: Date.now(),
      width,
      height,
    });
  }

  isCached(uri: string): boolean {
    return this.cache.has(uri);
  }

  /**
   * Clears the thumbnail memory cache.
   */
  clearMemoryCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Estimates memory usage in bytes for the thumbnail memory cache.
   */
  getEstimatedMemoryBytes(): number {
    return this.cache.size * 250; // Lightweight metadata footprint
  }
}

export const imageOptimizer = new ImageOptimizer();

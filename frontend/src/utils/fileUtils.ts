export const FileUtils = {
  formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  getFileName(filePath: string): string {
    if (!filePath) return '';
    return filePath.split(/[/\\]/).pop() || '';
  },

  getFileExtension(filePath: string): string {
    if (!filePath) return '';
    const parts = filePath.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  },

  generateCompositeHash(filePath: string, fileSize: number, timestamp: number): string {
    let hash = 0;
    const str = `${filePath}_${fileSize}_${timestamp}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  },

  /**
   * Generates a 64-char pseudo-SHA256 hex string from composite attributes
   * when native hash is unavailable.
   */
  generateFallbackSHA256(filePath: string, fileSize: number, timestamp: number): string {
    const raw = `${filePath}:${fileSize}:${timestamp}:contextvault`;
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const p1 = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
    const p2 = (4294967296 * (2097151 & h1) + (h2 >>> 0)).toString(16).padStart(16, '0');
    const p3 = (h1 >>> 0).toString(16).padStart(16, '0');
    const p4 = (h2 >>> 0).toString(16).padStart(16, '0');
    return (p1 + p2 + p3 + p4).substring(0, 64);
  },

  /**
   * Normalizes a local or remote screenshot file path into a valid URI
   * that React Native Image components can reliably resolve.
   */
  normalizeImageUri(filePath: string): string {
    if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
      return '';
    }
    const trimmed = filePath.trim();

    // 1. Android Content URI (e.g. content://media/external/images/media/123)
    if (trimmed.startsWith('content://')) {
      return trimmed;
    }

    // 2. Web or Remote URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // 3. Base64 Data URI
    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }

    // 4. Already has file:// scheme
    if (trimmed.startsWith('file://')) {
      return trimmed;
    }

    // 5. Windows path (e.g. C:\path\to\image.png or C:/path/to/image.png)
    if (/^[a-zA-Z]:[/\\]/.test(trimmed)) {
      const forwardSlashes = trimmed.replace(/\\/g, '/');
      return `file:///${forwardSlashes}`;
    }

    // 6. Absolute Unix / Android path (e.g. /storage/emulated/0/...)
    if (trimmed.startsWith('/')) {
      return `file://${trimmed}`;
    }

    // 7. Fallback prefix with file://
    return `file://${trimmed}`;
  },

  /**
   * Checks if a given URI string is structurally non-empty and well-formed.
   */
  isValidImageUri(uri: string): boolean {
    if (!uri || typeof uri !== 'string') return false;
    const clean = uri.trim();
    if (clean.length === 0) return false;
    return (
      clean.startsWith('content://') ||
      clean.startsWith('file://') ||
      clean.startsWith('http://') ||
      clean.startsWith('https://') ||
      clean.startsWith('data:image/')
    );
  },
};

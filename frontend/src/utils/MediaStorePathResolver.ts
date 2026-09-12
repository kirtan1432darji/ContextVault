import { Platform } from 'react-native';

export interface ScreenshotSourceInput {
  thumbnailUri?: string | null;
  contentUri?: string | null;
  localPath?: string | null;
  filePath?: string | null;
  deviceAssetId?: string | null;
}

/**
 * ContextVault MediaStore Path & URI Resolver
 * Fully handles Scoped Storage (Android 10 Q through Android 15 Vanilla Ice Cream)
 * and resolves content://, file://, and document provider URIs for reliable React Native image rendering.
 */
export class MediaStorePathResolver {
  /**
   * Transparent 1x1 PNG data URI used as a safe placeholder fallback
   * when no valid URI or cached thumbnail is available.
   */
  public static readonly PLACEHOLDER_DATA_URI =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  /**
   * Checks whether a URI string has the content:// scheme.
   */
  public static isContentUri(uri?: string | null): boolean {
    return Boolean(uri && uri.trim().startsWith('content://'));
  }

  /**
   * Checks whether a URI string has the file:// scheme.
   */
  public static isFileUri(uri?: string | null): boolean {
    return Boolean(uri && uri.trim().startsWith('file://'));
  }

  /**
   * Checks if an ID string represents a pure numeric MediaStore row ID.
   */
  public static isNumericId(val?: string | null): boolean {
    return Boolean(val && /^\d+$/.test(val.trim()));
  }

  /**
   * Extracts the numeric MediaStore ID from various Android URI formats:
   * 1. Plain numeric ID (e.g. "1000045231")
   * 2. MediaStore images URI (e.g. "content://media/external/images/media/1000045231")
   * 3. Document Provider URI (e.g. "content://com.android.providers.media.documents/document/image%3A1000045231")
   */
  public static extractMediaStoreId(raw?: string | null): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim();

    // Direct numeric ID
    if (/^\d+$/.test(clean)) {
      return clean;
    }

    // MediaStore images URI
    const mediaMatch = clean.match(/content:\/\/media\/external\/images\/media\/(\d+)/i);
    if (mediaMatch && mediaMatch[1]) {
      return mediaMatch[1];
    }

    // Document Provider URI (e.g. image%3A12345 or image:12345)
    const docMatch = clean.match(/image(?:%3A|:)(\d+)/i);
    if (docMatch && docMatch[1]) {
      return docMatch[1];
    }

    return null;
  }

  /**
   * Constructs or normalizes a MediaStore Content URI for the given ID or path.
   * e.g. "12345" -> "content://media/external/images/media/12345"
   */
  public static resolveContentUri(idOrUri?: string | null): string | null {
    if (!idOrUri) return null;
    const clean = idOrUri.trim();

    if (clean.startsWith('content://media/external/images/media/')) {
      return clean;
    }

    const mediaId = this.extractMediaStoreId(clean);
    if (mediaId) {
      return `content://media/external/images/media/${mediaId}`;
    }

    if (clean.startsWith('content://')) {
      return clean;
    }

    return null;
  }

  /**
   * Normalizes raw filesystem paths into valid file:// URIs that React Native can read.
   * Handles Windows drive paths and Unix/Android absolute paths.
   */
  public static normalizeFileUri(rawPath?: string | null): string | null {
    if (!rawPath || typeof rawPath !== 'string') return null;
    const clean = rawPath.trim();
    if (!clean) return null;

    if (clean.startsWith('file://')) {
      return clean;
    }

    if (clean.startsWith('content://') || clean.startsWith('http') || clean.startsWith('data:')) {
      return clean;
    }

    // Windows absolute path: C:\path or C:/path
    if (/^[a-zA-Z]:[/\\]/.test(clean)) {
      return `file:///${clean.replace(/\\/g, '/')}`;
    }

    // Android / Unix absolute path: /storage/emulated/0/...
    if (clean.startsWith('/')) {
      return `file://${clean}`;
    }

    return `file://${clean}`;
  }

  /**
   * Resolves an ordered list of candidate URIs for displaying a screenshot.
   * Fallback order:
   * 1. thumbnailUri (fastest, memory efficient)
   * 2. contentUri (Scoped Storage compatible)
   * 3. localPath or filePath (direct normalized file://)
   */
  public static getCandidateUris(source?: ScreenshotSourceInput | null): string[] {
    const candidates: string[] = [];
    if (!source) return candidates;

    const add = (uri?: string | null) => {
      if (uri && typeof uri === 'string') {
        const clean = uri.trim();
        if (clean && !candidates.includes(clean)) {
          candidates.push(clean);
        }
      }
    };

    // 1. Cached 300px thumbnail URI
    if (source.thumbnailUri) {
      const normalizedThumb = this.normalizeFileUri(source.thumbnailUri);
      add(normalizedThumb);
    }

    // 2. MediaStore Content URI (works natively with Fresco on Android 11-15)
    if (source.contentUri) {
      const resolvedContent = this.resolveContentUri(source.contentUri);
      add(resolvedContent);
    } else if (source.deviceAssetId) {
      const resolvedFromAsset = this.resolveContentUri(source.deviceAssetId);
      add(resolvedFromAsset);
    }

    // 3. Normalized local file URI
    const rawPath = source.localPath || source.filePath;
    if (rawPath) {
      if (rawPath.startsWith('content://')) {
        add(rawPath);
      } else {
        const normalizedFile = this.normalizeFileUri(rawPath);
        add(normalizedFile);
      }
    }

    return candidates;
  }

  /**
   * Primary shared helper required across all components:
   * `getDisplayImageSource(screenshot)`
   * 
   * Fallback order:
   * 1. thumbnailUri
   * 2. contentUri
   * 3. localPath / filePath
   * 4. placeholder image
   * 
   * Returns a React Native ImageSource object `{ uri: string }`.
   */
  public static getDisplayImageSource(source?: ScreenshotSourceInput | null): { uri: string } {
    const candidates = this.getCandidateUris(source);
    if (candidates.length > 0) {
      return { uri: candidates[0] };
    }
    return { uri: this.PLACEHOLDER_DATA_URI };
  }
}

export const getDisplayImageSource = (source?: ScreenshotSourceInput | null): { uri: string } =>
  MediaStorePathResolver.getDisplayImageSource(source);

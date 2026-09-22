import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ViewStyle,
  ImageStyle,
  StyleProp,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';
import { ScreenshotModel } from '../models';
import { MediaStorePathResolver, ScreenshotSourceInput, getDisplayImageSource } from '../utils/MediaStorePathResolver';
import { thumbnailService } from '../services/ThumbnailService';

export { getDisplayImageSource };

export interface ScreenshotImageThumbnailProps {
  screenshot?: Partial<ScreenshotModel> | null;
  filePath?: string;
  localPath?: string;
  contentUri?: string;
  thumbnailUri?: string;
  deviceAssetId?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  borderRadius?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  showLoadingIndicator?: boolean;
  fallbackIcon?: string;
  fallbackIconSize?: number;
  onPress?: () => void;
  onError?: () => void;
  enableRetry?: boolean;
}

const ScreenshotImageThumbnailBase: React.FC<ScreenshotImageThumbnailProps> = ({
  screenshot,
  filePath,
  localPath,
  contentUri,
  thumbnailUri,
  deviceAssetId,
  style,
  imageStyle,
  borderRadius = 12,
  resizeMode = 'cover',
  showLoadingIndicator = false,
  fallbackIcon = 'image-outline',
  fallbackIconSize = 24,
  onPress,
  onError,
  enableRetry = false,
}) => {
  const theme = useAppTheme();

  const candidateUris = useMemo(() => {
    const input: ScreenshotSourceInput = screenshot
      ? {
          thumbnailUri: screenshot.thumbnailUri,
          contentUri: screenshot.contentUri,
          localPath: screenshot.localPath,
          filePath: screenshot.filePath,
          deviceAssetId: screenshot.deviceAssetId,
        }
      : {
          thumbnailUri,
          contentUri,
          localPath,
          filePath,
          deviceAssetId,
        };
    return MediaStorePathResolver.getCandidateUris(input);
  }, [screenshot, thumbnailUri, contentUri, localPath, filePath, deviceAssetId]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [cachedThumbUri, setCachedThumbUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setHasError(false);
    setCachedThumbUri(null);

    const initial = candidateUris[0];
    if (initial) {
      setIsLoading(true);
      if (!initial.includes('thumb_')) {
        thumbnailService
          .getOrCreateThumbnail(initial, 300, screenshot?.id)
          .then((cached) => {
            if (cached && cached !== initial) {
              setCachedThumbUri(cached);
            }
          })
          .catch(() => {});
      }
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  }, [candidateUris, screenshot?.id]);

  const activeUri = cachedThumbUri || candidateUris[candidateIndex] || '';

  const handleImageError = () => {
    if (candidateIndex + 1 < candidateUris.length) {
      // Advance to next candidate URI (e.g. fallback from MediaStore Content URI to File URI or vice versa)
      setCandidateIndex((prev) => prev + 1);
    } else {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setCandidateIndex(0);
    setIsLoading(true);
  };

  const handleImageLoaded = () => {
    setIsLoading(false);
  };

  const content = (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0',
        },
        style,
      ]}
    >
      {activeUri && !hasError ? (
        <>
          <Image
            source={{ uri: activeUri, cache: 'force-cache' }}
            style={[styles.image, { borderRadius }, imageStyle]}
            resizeMode={resizeMode}
            onLoadStart={() => setIsLoading(true)}
            onLoad={handleImageLoaded}
            onLoadEnd={() => setIsLoading(false)}
            onError={handleImageError}
            progressiveRenderingEnabled
          />
          {isLoading && showLoadingIndicator && (
            <View style={[styles.loadingOverlay, { borderRadius }]}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          )}
        </>
      ) : (
        <TouchableOpacity
          disabled={!enableRetry}
          onPress={handleRetry}
          style={styles.fallbackContainer}
          testID="thumbnail-fallback"
          accessibilityLabel={enableRetry ? 'Retry loading image' : undefined}
          accessibilityRole={enableRetry ? 'button' : undefined}
        >
          <Icon
            name={fallbackIcon}
            size={fallbackIconSize}
            color={theme.isDark ? '#64748B' : '#94A3B8'}
          />
          {enableRetry && (
            <View style={styles.retryBadge}>
              <Icon name="refresh" size={10} color={theme.colors.primary} />
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="View screenshot preview"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export const ScreenshotImageThumbnail = React.memo(ScreenshotImageThumbnailBase);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  retryBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 8,
    padding: 2,
  },
});

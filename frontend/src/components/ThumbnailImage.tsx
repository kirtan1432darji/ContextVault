import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Image,
  Animated,
  StyleSheet,
  ViewStyle,
  ImageStyle,
  StyleProp,
  TouchableOpacity,
  ActivityIndicator,
  DimensionValue,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';
import { MediaStorePathResolver, ScreenshotSourceInput } from '../utils/MediaStorePathResolver';
import { thumbnailService } from '../services/ThumbnailService';

export interface ThumbnailImageProps {
  source?: ScreenshotSourceInput | null;
  uri?: string | null;
  filePath?: string | null;
  contentUri?: string | null;
  thumbnailUri?: string | null;
  deviceAssetId?: string | null;
  size?: DimensionValue;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  resizeMode?: 'cover' | 'contain' | 'center';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  showLoadingShimmer?: boolean;
  fallbackIcon?: string;
  fallbackIconSize?: number;
  onPress?: () => void;
  onError?: () => void;
  enableRetry?: boolean;
  testID?: string;
}

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  source,
  uri,
  filePath,
  contentUri,
  thumbnailUri,
  deviceAssetId,
  size,
  width = '100%',
  height = '100%',
  borderRadius = 12,
  resizeMode = 'cover',
  style,
  imageStyle,
  showLoadingShimmer = true,
  fallbackIcon = 'image-outline',
  fallbackIconSize = 24,
  onPress,
  onError,
  enableRetry = true,
  testID = 'thumbnail-image',
}) => {
  const theme = useAppTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const candidateUris = useMemo(() => {
    const input: ScreenshotSourceInput = source
      ? source
      : {
          thumbnailUri,
          contentUri: contentUri || uri,
          filePath: filePath || uri,
          deviceAssetId,
        };
    return MediaStorePathResolver.getCandidateUris(input);
  }, [source, uri, filePath, contentUri, thumbnailUri, deviceAssetId]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [resolvedUri, setResolvedUri] = useState<string>(candidateUris[0] || '');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setHasError(false);
    fadeAnim.setValue(0);

    const initial = candidateUris[0];
    if (initial) {
      setResolvedUri(initial);
      setIsLoading(true);

      // Opportunistically pre-fetch cached thumbnail if not already a thumb
      if (!initial.includes('thumb_')) {
        thumbnailService
          .getOrCreateThumbnail(initial, typeof size === 'number' ? size : 300)
          .then((cached) => {
            if (cached && cached !== initial) {
              setResolvedUri(cached);
            }
          })
          .catch(() => {});
      }
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  }, [candidateUris, size]);

  const handleLoadSuccess = () => {
    setIsLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const handleImageError = () => {
    if (candidateIndex + 1 < candidateUris.length) {
      const nextIndex = candidateIndex + 1;
      setCandidateIndex(nextIndex);
      setResolvedUri(candidateUris[nextIndex]);
      setIsLoading(true);
    } else {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setCandidateIndex(0);
    setResolvedUri(candidateUris[0] || '');
    setIsLoading(true);
  };

  const containerStyle: ViewStyle = {
    width: size || width,
    height: size || height,
    borderRadius,
    backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const content = (
    <View style={[containerStyle, style]} testID={testID}>
      {resolvedUri && !hasError ? (
        <>
          <Animated.Image
            source={{ uri: resolvedUri, cache: 'force-cache' }}
            style={[
              styles.image,
              { borderRadius, opacity: fadeAnim },
              imageStyle,
            ]}
            resizeMode={resizeMode}
            onLoad={handleLoadSuccess}
            onError={handleImageError}
          />
          {isLoading && showLoadingShimmer && (
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
          testID={`${testID}-fallback`}
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

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
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

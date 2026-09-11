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
import { FileUtils } from '../utils/fileUtils';

export interface ScreenshotImageThumbnailProps {
  filePath: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  borderRadius?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  showLoadingIndicator?: boolean;
  fallbackIcon?: string;
  fallbackIconSize?: number;
  onPress?: () => void;
  onError?: () => void;
}

const ScreenshotImageThumbnailBase: React.FC<ScreenshotImageThumbnailProps> = ({
  filePath,
  style,
  imageStyle,
  borderRadius = 12,
  resizeMode = 'cover',
  showLoadingIndicator = false,
  fallbackIcon = 'image-outline',
  fallbackIconSize = 24,
  onPress,
  onError,
}) => {
  const theme = useAppTheme();
  const normalizedUri = useMemo(() => FileUtils.normalizeImageUri(filePath), [filePath]);

  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (filePath && filePath.trim().length > 0) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [filePath]);

  const handleImageError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
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
      {normalizedUri && !hasError ? (
        <>
          <Image
            source={{ uri: normalizedUri, cache: 'force-cache' }}
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
        <View style={styles.fallbackContainer} testID="thumbnail-fallback">
          <Icon
            name={fallbackIcon}
            size={fallbackIconSize}
            color={theme.isDark ? '#64748B' : '#94A3B8'}
          />
        </View>
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
});

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';

interface ScreenshotImageThumbnailProps {
  filePath: string;
  style?: ViewStyle;
  borderRadius?: number;
}

export const ScreenshotImageThumbnail: React.FC<ScreenshotImageThumbnailProps> = ({
  filePath,
  style,
  borderRadius = 12,
}) => {
  const theme = useAppTheme();
  const uri = filePath.startsWith('http') || filePath.startsWith('file://')
    ? filePath
    : `file://${filePath}`;

  return (
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
      {filePath ? (
        <Image
          source={{ uri }}
          style={[styles.image, { borderRadius }]}
          resizeMode="cover"
        />
      ) : (
        <Icon name="image-outline" size={28} color={theme.colors.textMuted} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

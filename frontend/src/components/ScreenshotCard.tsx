import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';
import { ScreenshotModel } from '../models';
import { ThumbnailImage } from './ThumbnailImage';
import { ConfidenceBadge } from './ConfidenceBadge';

export interface ScreenshotCardProps {
  screenshot: ScreenshotModel;
  onPress: () => void;
  onLongPress?: () => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  itemWidth?: number;
  itemHeight?: number;
  style?: ViewStyle;
}

export const ScreenshotCard: React.FC<ScreenshotCardProps> = ({
  screenshot,
  onPress,
  onLongPress,
  isSelectMode = false,
  isSelected = false,
  itemWidth,
  itemHeight = 180,
  style,
}) => {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        {
          width: itemWidth || '100%',
          backgroundColor: theme.colors.card,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
        },
        isSelected && styles.cardSelected,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Screenshot ${screenshot.fileName}`}
    >
      <View style={[styles.thumbWrapper, { height: itemHeight }]}>
        <ThumbnailImage
          source={screenshot}
          borderRadius={10}
          resizeMode="cover"
        />

        {screenshot.isFavorite && (
          <View style={styles.favBadgeOverlay}>
            <Icon name="heart" size={12} color="#EF4444" />
          </View>
        )}

        {isSelectMode && (
          <View
            style={[
              styles.selectCheckboxOverlay,
              isSelected && { backgroundColor: `${theme.colors.primary}30` },
            ]}
          >
            <Icon
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isSelected ? theme.colors.primary : '#FFFFFF'}
            />
          </View>
        )}
      </View>

      <View style={styles.detailsContainer}>
        <Text
          numberOfLines={1}
          style={[styles.fileName, { color: theme.colors.textPrimary }]}
        >
          {screenshot.fileName}
        </Text>

        <View style={styles.metaRow}>
          <Text
            numberOfLines={1}
            style={[styles.folderName, { color: theme.colors.textSecondary }]}
          >
            {screenshot.categoryName || 'Unsorted'}
          </Text>
          {screenshot.confidence !== undefined && screenshot.confidence > 0 && (
            <ConfidenceBadge confidence={screenshot.confidence} showPercent={false} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardSelected: {
    borderWidth: 2,
  },
  thumbWrapper: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  favBadgeOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 3,
  },
  selectCheckboxOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 12,
    padding: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  detailsContainer: {
    padding: 8,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderName: {
    fontSize: 11,
    flex: 1,
    marginRight: 4,
  },
});

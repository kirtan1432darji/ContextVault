import React from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { ScreenshotModel } from '../models';
import { ThumbnailImage } from './ThumbnailImage';
import { useAppTheme } from '../theme';

export interface ScreenshotCarouselProps {
  screenshots: ScreenshotModel[];
  onSelectScreenshot: (screenshot: ScreenshotModel) => void;
  isLoading?: boolean;
  maxItems?: number;
  style?: ViewStyle;
  emptyTitle?: string;
  onRefresh?: () => void;
}

export const ScreenshotCarousel: React.FC<ScreenshotCarouselProps> = ({
  screenshots,
  onSelectScreenshot,
  isLoading = false,
  maxItems = 20,
  style,
  emptyTitle = 'No recent screenshots',
}) => {
  const theme = useAppTheme();
  const displayItems = screenshots.slice(0, maxItems);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (displayItems.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
            borderColor: theme.colors.border,
          },
          style,
        ]}
      >
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          {emptyTitle}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={displayItems}
      keyExtractor={(item) => item.id}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={5}
      removeClippedSubviews={true}
      contentContainerStyle={[styles.listContent, style]}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onSelectScreenshot(item)}
          style={styles.itemTouch}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Open screenshot ${item.fileName}`}
        >
          <ThumbnailImage
            source={item}
            width={120}
            height={160}
            borderRadius={10}
            resizeMode="cover"
          />
          <Text
            numberOfLines={1}
            style={[styles.itemText, { color: theme.colors.textSecondary }]}
          >
            {item.fileName}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
};

export const Carousel = ScreenshotCarousel;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  itemTouch: {
    marginRight: 12,
    width: 120,
  },
  itemText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

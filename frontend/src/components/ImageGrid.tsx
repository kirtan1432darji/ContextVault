import React from 'react';
import {
  FlatList,
  Dimensions,
  StyleSheet,
  View,
  ListRenderItem,
  RefreshControl,
} from 'react-native';
import { ScreenshotModel } from '../models';
import { ScreenshotCard } from './ScreenshotCard';
import { EmptyStateView } from './EmptyStateView';
import { useAppTheme } from '../theme';

const { width } = Dimensions.get('window');

export interface ImageGridProps {
  screenshots: ScreenshotModel[];
  onSelectScreenshot: (screenshot: ScreenshotModel) => void;
  onLongPressScreenshot?: (screenshot: ScreenshotModel) => void;
  numColumns?: number;
  isSelectMode?: boolean;
  selectedIds?: Set<string>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onEndReached?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  ListHeaderComponent?: React.ReactElement | null;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  screenshots,
  onSelectScreenshot,
  onLongPressScreenshot,
  numColumns = 2,
  isSelectMode = false,
  selectedIds = new Set(),
  onRefresh,
  isRefreshing = false,
  onEndReached,
  emptyTitle = 'No Screenshots Found',
  emptyDescription = 'Take screenshots or pull down to refresh.',
  ListHeaderComponent,
}) => {
  const theme = useAppTheme();
  const padding = 16;
  const spacing = 12;
  const itemWidth = (width - padding * 2 - spacing * (numColumns - 1)) / numColumns;

  const renderItem: ListRenderItem<ScreenshotModel> = ({ item }) => (
    <ScreenshotCard
      screenshot={item}
      itemWidth={itemWidth}
      itemHeight={itemWidth * 1.3}
      isSelectMode={isSelectMode}
      isSelected={selectedIds.has(item.id)}
      onPress={() => onSelectScreenshot(item)}
      onLongPress={() => onLongPressScreenshot?.(item)}
    />
  );

  return (
    <FlatList
      data={screenshots}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      contentContainerStyle={[styles.container, { padding }]}
      columnWrapperStyle={styles.columnWrapper}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={true}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        <EmptyStateView
          iconName="images-outline"
          title={emptyTitle}
          description={emptyDescription}
        />
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
});

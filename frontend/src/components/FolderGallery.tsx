import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ScreenshotModel } from '../models';
import { ImageGrid } from './ImageGrid';
import { FolderHeader } from './FolderHeader';

export interface FolderGalleryProps {
  folderName: string;
  count: number;
  totalBytes?: number;
  coverUri?: string | null;
  lastUpdated?: string;
  iconName?: string;
  colorHex?: string;
  screenshots: ScreenshotModel[];
  onSelectScreenshot: (screenshot: ScreenshotModel) => void;
  onLongPressScreenshot?: (screenshot: ScreenshotModel) => void;
  isSelectMode?: boolean;
  selectedIds?: Set<string>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onEndReached?: () => void;
  style?: ViewStyle;
}

export const FolderGallery: React.FC<FolderGalleryProps> = ({
  folderName,
  count,
  totalBytes,
  coverUri,
  lastUpdated,
  iconName,
  colorHex,
  screenshots,
  onSelectScreenshot,
  onLongPressScreenshot,
  isSelectMode = false,
  selectedIds = new Set(),
  onRefresh,
  isRefreshing = false,
  onEndReached,
  style,
}) => {
  const header = useMemo(
    () => (
      <FolderHeader
        title={folderName}
        count={count}
        totalBytes={totalBytes}
        coverUri={coverUri}
        lastUpdated={lastUpdated}
        iconName={iconName}
        colorHex={colorHex}
      />
    ),
    [folderName, count, totalBytes, coverUri, lastUpdated, iconName, colorHex]
  );

  return (
    <View style={[styles.container, style]}>
      <ImageGrid
        screenshots={screenshots}
        onSelectScreenshot={onSelectScreenshot}
        onLongPressScreenshot={onLongPressScreenshot}
        isSelectMode={isSelectMode}
        selectedIds={selectedIds}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onEndReached={onEndReached}
        ListHeaderComponent={header}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

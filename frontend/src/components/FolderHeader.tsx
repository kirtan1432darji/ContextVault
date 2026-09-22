import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';
import { FileUtils } from '../utils/fileUtils';
import { ThumbnailImage } from './ThumbnailImage';

export interface FolderHeaderProps {
  title: string;
  count: number;
  totalBytes?: number;
  coverUri?: string | null;
  lastUpdated?: string;
  iconName?: string;
  colorHex?: string;
  style?: ViewStyle;
}

export const FolderHeader: React.FC<FolderHeaderProps> = ({
  title,
  count,
  totalBytes = 0,
  coverUri,
  lastUpdated,
  iconName = 'folder-outline',
  colorHex = '6366F1',
  style,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {coverUri ? (
          <View style={styles.coverWrapper}>
            <ThumbnailImage
              uri={coverUri}
              size={64}
              borderRadius={10}
              fallbackIcon={iconName}
            />
          </View>
        ) : (
          <View style={[styles.iconBox, { backgroundColor: `#${colorHex}15` }]}>
            <Icon name={iconName} size={30} color={`#${colorHex}`} />
          </View>
        )}

        <View style={styles.metaCol}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {count} {count === 1 ? 'screenshot' : 'screenshots'}
            {totalBytes > 0 && ` • ${FileUtils.formatBytes(totalBytes)}`}
          </Text>
          {lastUpdated && (
            <Text style={[styles.updatedText, { color: theme.colors.textSecondary }]}>
              Updated {new Date(lastUpdated).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverWrapper: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 14,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  metaCol: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  updatedText: {
    fontSize: 11,
  },
});

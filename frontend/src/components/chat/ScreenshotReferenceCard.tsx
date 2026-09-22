import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { ScreenshotModel } from '../../models';
import { ScreenshotImageThumbnail } from '../ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../ConfidenceBadge';

interface ScreenshotReferenceCardProps {
  screenshot: ScreenshotModel;
  onPress: (screenshot: ScreenshotModel) => void;
  style?: any;
}

export const ScreenshotReferenceCard: React.FC<ScreenshotReferenceCardProps> = ({
  screenshot,
  onPress,
  style,
}) => {
  const theme = useAppTheme();

  // Extract merchant
  const merchant =
    (screenshot.entities as any)?.merchant ||
    (screenshot.entities as any)?.merchants?.[0] ||
    (screenshot.subcategory && screenshot.subcategory !== 'General' ? screenshot.subcategory : null);

  // Extract amount
  let amountStr: string | null = null;
  if ((screenshot.entities as any)?.amount) {
    amountStr = `₹${(screenshot.entities as any).amount}`;
  } else if ((screenshot.entities as any)?.amounts?.[0]) {
    amountStr = `₹${(screenshot.entities as any).amounts[0]}`;
  } else {
    const amtTag = screenshot.tags?.find((t) => t.name.startsWith('₹') || t.name.startsWith('amt_'));
    if (amtTag) {
      amountStr = amtTag.name.replace('amt_', '₹');
    }
  }

  // Format date
  const dateStr = screenshot.createdAt ? screenshot.createdAt.split('T')[0] : '';

  const thumbUri =
    screenshot.thumbnailUri ||
    screenshot.contentUri ||
    screenshot.localPath ||
    screenshot.filePath;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(screenshot)}
      style={[
        styles.card,
        {
          backgroundColor: theme.isDark ? '#1E293B' : '#FFFFFF',
          borderColor: theme.isDark ? '#334155' : '#E2E8F0',
        },
        style,
      ]}
    >
      <View style={styles.thumbContainer}>
        <ScreenshotImageThumbnail
          thumbnailUri={thumbUri}
          filePath={screenshot.filePath || thumbUri}
          style={styles.thumb}
          borderRadius={8}
        />
      </View>

      <View style={styles.infoCol}>
        <View style={styles.topRow}>
          <View style={styles.folderBadge}>
            <Icon name="folder-outline" size={10} color={theme.colors.primary} style={{ marginRight: 3 }} />
            <Text numberOfLines={1} style={[styles.folderText, { color: theme.colors.primary }]}>
              {screenshot.categoryName || screenshot.categoryId || 'Folder'}
            </Text>
          </View>

          {screenshot.confidence !== undefined && (
            <ConfidenceBadge confidence={screenshot.confidence} showPercent={true} />
          )}
        </View>

        <Text numberOfLines={1} style={[styles.fileName, { color: theme.colors.textPrimary }]}>
          {screenshot.fileName}
        </Text>

        <View style={styles.metaRow}>
          {merchant && (
            <View style={[styles.metaChip, { backgroundColor: `${theme.colors.secondary || '#8B5CF6'}15` }]}>
              <Icon name="business-outline" size={10} color={theme.colors.secondary || '#8B5CF6'} style={{ marginRight: 2 }} />
              <Text numberOfLines={1} style={[styles.metaChipText, { color: theme.colors.secondary || '#8B5CF6' }]}>
                {merchant}
              </Text>
            </View>
          )}

          {amountStr && (
            <View style={[styles.metaChip, { backgroundColor: '#10B98115' }]}>
              <Text numberOfLines={1} style={[styles.metaChipText, { color: '#10B981', fontWeight: '700' }]}>
                {amountStr}
              </Text>
            </View>
          )}

          {dateStr ? (
            <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
              {dateStr}
            </Text>
          ) : null}
        </View>
      </View>

      <Icon name="chevron-forward" size={14} color={theme.colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginRight: 10,
  },
  thumb: {
    width: 52,
    height: 52,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F115',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: '65%',
  },
  folderText: {
    fontSize: 10,
    fontWeight: '600',
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  metaChipText: {
    fontSize: 10,
  },
  dateText: {
    fontSize: 10,
    marginLeft: 2,
  },
  chevron: {
    marginLeft: 6,
  },
});

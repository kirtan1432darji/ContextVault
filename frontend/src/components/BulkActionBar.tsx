import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';

export interface BulkActionBarProps {
  selectedCount: number;
  onMove: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onShare: () => void;
  onCancel: () => void;
  isAllFavorite?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onMove,
  onFavorite,
  onDelete,
  onShare,
  onCancel,
  isAllFavorite = false,
}) => {
  const theme = useAppTheme();

  if (selectedCount === 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          shadowColor: '#000000',
        },
      ]}
    >
      {/* Selection Count Pill */}
      <View style={styles.countContainer}>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Cancel selection"
        >
          <Icon name="close" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: `${theme.colors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
            {selectedCount}
          </Text>
        </View>
        <Text style={[styles.selectedLabel, { color: theme.colors.textPrimary }]}>
          Selected
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {/* 1. Move */}
        <TouchableOpacity
          onPress={onMove}
          style={styles.actionBtn}
          activeOpacity={0.7}
          accessibilityLabel="Move selected screenshots"
        >
          <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
            <Icon name="folder-outline" size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>Move</Text>
        </TouchableOpacity>

        {/* 2. Favorite / Unfavorite */}
        <TouchableOpacity
          onPress={onFavorite}
          style={styles.actionBtn}
          activeOpacity={0.7}
          accessibilityLabel="Toggle favorite for selected screenshots"
        >
          <View style={[styles.iconCircle, { backgroundColor: '#EF444418' }]}>
            <Icon
              name={isAllFavorite ? 'heart-dislike-outline' : 'heart'}
              size={18}
              color="#EF4444"
            />
          </View>
          <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>
            {isAllFavorite ? 'Unfavorite' : 'Favorite'}
          </Text>
        </TouchableOpacity>

        {/* 3. Delete to Recycle Bin */}
        <TouchableOpacity
          onPress={onDelete}
          style={styles.actionBtn}
          activeOpacity={0.7}
          accessibilityLabel="Move selected to Recycle Bin"
        >
          <View style={[styles.iconCircle, { backgroundColor: '#EF444418' }]}>
            <Icon name="trash-outline" size={18} color="#EF4444" />
          </View>
          <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>

        {/* 4. Share */}
        <TouchableOpacity
          onPress={onShare}
          style={styles.actionBtn}
          activeOpacity={0.7}
          accessibilityLabel="Share selected screenshots"
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.isDark ? '#334155' : '#F1F5F9' },
            ]}
          >
            <Icon name="share-social-outline" size={18} color={theme.colors.textPrimary} />
          </View>
          <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#64748B40',
  },
  closeBtn: {
    padding: 4,
    marginRight: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-around',
    paddingLeft: 6,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});

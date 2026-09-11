import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useNotificationStore } from '../store/notification.store';
import { VaultNotificationItem, NotificationType } from '../models/notification.model';
import { ModernCard } from '../components/ModernCard';

type FilterType = 'all' | NotificationType;

export const NotificationCenterScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  });

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to remove all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearAll },
      ]
    );
  };

  const handleNotificationPress = (item: VaultNotificationItem) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }

    if (item.targetScreen === 'FolderContext' && item.targetParams?.categoryName) {
      navigation.navigate('FolderContext', {
        categoryId: item.targetParams.categoryId || item.targetParams.categoryName.toLowerCase(),
        categoryName: item.targetParams.categoryName,
      });
    } else if (item.targetScreen === 'FolderDetail' && item.targetParams?.categoryName) {
      navigation.navigate('FolderDetail', {
        categoryId: item.targetParams.categoryId || item.targetParams.categoryName.toLowerCase(),
        categoryName: item.targetParams.categoryName,
      });
    } else if (item.targetScreen === 'Dashboard') {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  const getTypeVisuals = (type: NotificationType) => {
    switch (type) {
      case 'ocr':
        return { icon: 'document-text-outline', color: '#10B981', label: 'OCR' };
      case 'sync':
        return { icon: 'sync-outline', color: '#3B82F6', label: 'AI Sync' };
      case 'context':
        return { icon: 'sparkles-outline', color: '#8B5CF6', label: 'Context' };
      case 'review':
        return { icon: 'alert-circle-outline', color: '#F59E0B', label: 'Review' };
      case 'screenshot':
      default:
        return { icon: 'camera-outline', color: '#6366F1', label: 'Detection' };
    }
  };

  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: VaultNotificationItem }) => {
    const visuals = getTypeVisuals(item.type);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(item)}
      >
        <ModernCard
          style={[
            styles.notifCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: item.isRead ? theme.colors.border : `${theme.colors.primary}50`,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.badgeRow}>
              <View style={[styles.typeIconBox, { backgroundColor: `${visuals.color}15` }]}>
                <Icon name={visuals.icon} size={16} color={visuals.color} />
              </View>
              <Text style={[styles.typeLabel, { color: visuals.color }]}>
                {visuals.label}
              </Text>
              {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
            </View>

            <View style={styles.actionRow}>
              <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>
                {formatTimestamp(item.timestamp)}
              </Text>
              <TouchableOpacity
                onPress={() => deleteNotification(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.deleteBtn}
              >
                <Icon name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.notifTitle, { color: theme.colors.textPrimary }]}>
            {item.title}
          </Text>
          <Text style={[styles.notifBody, { color: theme.colors.textSecondary }]} numberOfLines={3}>
            {item.body}
          </Text>
        </ModernCard>
      </TouchableOpacity>
    );
  };

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ocr', label: 'OCR' },
    { key: 'sync', label: 'AI Sync' },
    { key: 'context', label: 'Context' },
    { key: 'review', label: 'Reviews' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              Notification Center
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={[styles.smallActionBtn, { borderColor: theme.colors.border }]}
            >
              <Icon name="checkmark-done-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={[styles.smallActionBtn, { borderColor: theme.colors.border, marginLeft: 8 }]}
            >
              <Icon name="trash-outline" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterOptions}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isSelected = activeFilter === item.key;
            return (
              <TouchableOpacity
                onPress={() => setActiveFilter(item.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : theme.isDark
                      ? '#1E293B'
                      : '#F1F5F9',
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: `${theme.colors.primary}12` }]}>
              <Icon name="notifications-off-outline" size={38} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
              No Notifications
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              {activeFilter === 'all'
                ? 'Alerts about OCR processing, AI sync, and context generation will appear here.'
                : `No ${activeFilter.toUpperCase()} alerts found.`}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    paddingVertical: 8,
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  notifCard: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    marginRight: 10,
  },
  deleteBtn: {
    padding: 2,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

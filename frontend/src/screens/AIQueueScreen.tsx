import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import {
  aiProcessingQueue,
  QueueItem,
  QueuePriority,
  QueueState,
  QueueStats,
} from '../services/background';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'AIQueue'>;

type FilterTab = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

export const AIQueueScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    averageProcessingTimeMs: 0,
  });
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const currentStats = await aiProcessingQueue.getStats();
      setStats(currentStats);
      setIsPaused(aiProcessingQueue.isPaused());

      const stateFilter = activeTab === 'all' ? undefined : (activeTab as QueueState);
      const queueItems = await aiProcessingQueue.getItems(stateFilter, 100);
      setItems(queueItems);
    } catch (err) {
      console.warn('[AIQueueScreen] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Subscribe to live background queue events
  useEffect(() => {
    const unsubscribe = aiProcessingQueue.subscribe(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleTogglePause = () => {
    if (isPaused) {
      aiProcessingQueue.resume();
      setIsPaused(false);
    } else {
      aiProcessingQueue.pause();
      setIsPaused(true);
    }
  };

  const handleRetryFailed = async () => {
    try {
      setActionInProgress('retry_failed');
      const count = await aiProcessingQueue.retryFailed();
      Alert.alert('Queue Resumed', `Re-queued ${count} failed items for processing.`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Retry Error', err?.message || 'Failed to retry failed items.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClearCompleted = async () => {
    try {
      const count = await aiProcessingQueue.clearCompleted();
      Alert.alert('Queue Cleared', `Removed ${count} completed items from history.`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Clear Error', err?.message || 'Failed to clear completed items.');
    }
  };

  const handleEnqueueAllPending = async () => {
    try {
      setActionInProgress('enqueue_all');
      const count = await aiProcessingQueue.enqueueAllPending();
      Alert.alert('Enqueued', `Added ${count} screenshots to the background AI queue.`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Enqueue Error', err?.message || 'Failed to enqueue screenshots.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePrioritizeItem = async (item: QueueItem) => {
    try {
      await aiProcessingQueue.bumpPriority(item.id, 'critical');
      await loadData();
    } catch (err: any) {
      Alert.alert('Priority Error', err?.message || 'Failed to prioritize item.');
    }
  };

  const handleRetrySingleItem = async (item: QueueItem) => {
    try {
      await aiProcessingQueue.retryItem(item.id);
      await loadData();
    } catch (err: any) {
      Alert.alert('Retry Error', err?.message || 'Failed to retry item.');
    }
  };

  const handleCancelItem = async (item: QueueItem) => {
    try {
      await aiProcessingQueue.cancelItem(item.id);
      await loadData();
    } catch (err: any) {
      Alert.alert('Cancel Error', err?.message || 'Failed to cancel item.');
    }
  };

  const renderPriorityBadge = (priority: QueuePriority) => {
    let color = theme.colors.textSecondary;
    let bg = `${theme.colors.textSecondary}15`;

    switch (priority) {
      case 'critical':
        color = '#DC2626';
        bg = '#DC262620';
        break;
      case 'high':
        color = '#EA580C';
        bg = '#EA580C20';
        break;
      case 'medium':
        color = theme.colors.primary;
        bg = `${theme.colors.primary}20`;
        break;
      case 'low':
        color = '#64748B';
        bg = '#64748B20';
        break;
    }

    return (
      <View style={[styles.priorityPill, { backgroundColor: bg }]}>
        <Text style={[styles.priorityText, { color }]}>{priority.toUpperCase()}</Text>
      </View>
    );
  };

  const renderStateBadge = (state: QueueState) => {
    let color = theme.colors.textSecondary;
    let bg = `${theme.colors.textSecondary}15`;
    let iconName = 'time-outline';

    switch (state) {
      case 'processing':
        color = theme.colors.primary;
        bg = `${theme.colors.primary}20`;
        iconName = 'sync-outline';
        break;
      case 'completed':
        color = theme.colors.success;
        bg = `${theme.colors.success}20`;
        iconName = 'checkmark-circle-outline';
        break;
      case 'failed':
        color = theme.colors.error;
        bg = `${theme.colors.error}20`;
        iconName = 'alert-circle-outline';
        break;
      case 'cancelled':
        color = '#94A3B8';
        bg = '#94A3B820';
        iconName = 'close-circle-outline';
        break;
      case 'pending':
      default:
        color = '#F59E0B';
        bg = '#F59E0B20';
        iconName = 'hourglass-outline';
        break;
    }

    return (
      <View style={[styles.statePill, { backgroundColor: bg }]}>
        {state === 'processing' ? (
          <ActivityIndicator size="small" color={color} style={{ marginRight: 4 }} />
        ) : (
          <Icon name={iconName} size={12} color={color} style={{ marginRight: 4 }} />
        )}
        <Text style={[styles.stateText, { color }]}>
          {state.charAt(0).toUpperCase() + state.slice(1)}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: QueueItem }) => {
    const isProcessing = item.state === 'processing';
    const isPending = item.state === 'pending';
    const isFailed = item.state === 'failed';

    return (
      <ModernCard style={styles.itemCard}>
        <View style={styles.itemRow}>
          {/* Thumbnail */}
          <View style={[styles.thumbnailContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            {item.thumbnailUri || item.contentUri || item.localPath ? (
              <Image
                source={{ uri: item.thumbnailUri || item.contentUri || item.localPath }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            ) : (
              <Icon name="image-outline" size={24} color={theme.colors.textSecondary} />
            )}
          </View>

          {/* Details */}
          <View style={styles.itemDetails}>
            <View style={styles.itemTitleRow}>
              <Text
                style={[styles.itemFileName, { color: theme.colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {item.fileName || 'Screenshot'}
              </Text>
              {renderPriorityBadge(item.priority)}
            </View>

            <View style={styles.itemSubRow}>
              {renderStateBadge(item.state)}
              {item.categoryName ? (
                <Text style={[styles.itemCategory, { color: theme.colors.textSecondary }]}>
                  📁 {item.categoryName}
                </Text>
              ) : null}
            </View>

            {item.processingTimeMs > 0 && (
              <Text style={[styles.itemTiming, { color: theme.colors.textSecondary }]}>
                Processed in {item.processingTimeMs}ms
              </Text>
            )}

            {isFailed && item.errorMessage && (
              <View style={[styles.errorBox, { backgroundColor: `${theme.colors.error}15` }]}>
                <Text style={[styles.errorText, { color: theme.colors.error }]} numberOfLines={2}>
                  {item.errorMessage}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Item Action Buttons */}
        <View style={styles.itemActionsRow}>
          {isPending && (
            <>
              <TouchableOpacity
                style={[styles.itemActionBtn, { borderColor: theme.colors.primary }]}
                onPress={() => handlePrioritizeItem(item)}
              >
                <Icon name="flash" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.itemActionText, { color: theme.colors.primary }]}>
                  Analyze Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.itemActionBtn, { borderColor: theme.colors.border }]}
                onPress={() => handleCancelItem(item)}
              >
                <Icon name="close" size={13} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.itemActionText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}

          {isFailed && (
            <TouchableOpacity
              style={[styles.itemActionBtn, { borderColor: theme.colors.primary }]}
              onPress={() => handleRetrySingleItem(item)}
            >
              <Icon name="refresh" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.itemActionText, { color: theme.colors.primary }]}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </ModernCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            AI Processing Queue
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Automated OCR + RTX 4050 Vision AI
          </Text>
        </View>
        {stats.completed > 0 && (
          <TouchableOpacity
            onPress={handleClearCompleted}
            style={[styles.clearBtn, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.clearBtnText, { color: theme.colors.textSecondary }]}>
              Clear Done
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Top Metrics Grid */}
      <View style={styles.metricsContainer}>
        <ModernCard style={styles.metricsCard}>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: '#F59E0B' }]}>{stats.pending}</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Pending</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                {stats.processing}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Processing
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: theme.colors.success }]}>
                {stats.completed}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Completed
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: theme.colors.error }]}>{stats.failed}</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Failed</Text>
            </View>
          </View>

          {stats.averageProcessingTimeMs > 0 && (
            <View style={styles.latencyRow}>
              <Icon name="speedometer-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.latencyText, { color: theme.colors.textSecondary }]}>
                Average processing time: {stats.averageProcessingTimeMs}ms
              </Text>
            </View>
          )}
        </ModernCard>
      </View>

      {/* 3. Global Queue Control Buttons */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[
            styles.controlBtn,
            { backgroundColor: isPaused ? theme.colors.success : '#F59E0B' },
          ]}
          onPress={handleTogglePause}
        >
          <Icon
            name={isPaused ? 'play' : 'pause'}
            size={16}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.controlBtnText}>{isPaused ? 'Resume Queue' : 'Pause Queue'}</Text>
        </TouchableOpacity>

        {stats.failed > 0 && (
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleRetryFailed}
            disabled={actionInProgress === 'retry_failed'}
          >
            {actionInProgress === 'retry_failed' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.controlBtnText}>Retry Failed ({stats.failed})</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlBtnOutline, { borderColor: theme.colors.border }]}
          onPress={handleEnqueueAllPending}
          disabled={actionInProgress === 'enqueue_all'}
        >
          <Icon name="scan-outline" size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
          <Text style={[styles.controlBtnOutlineText, { color: theme.colors.textPrimary }]}>
            Scan & Analyze All
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Filter Tabs */}
      <View style={styles.tabsContainer}>
        {(['all', 'pending', 'processing', 'completed', 'failed'] as FilterTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabBtn,
                isActive && {
                  backgroundColor: `${theme.colors.primary}20`,
                  borderColor: theme.colors.primary,
                },
                !isActive && { borderColor: theme.colors.border },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                  isActive && { fontWeight: '700' },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 5. Queue Items List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loaderText, { color: theme.colors.textSecondary }]}>
            Loading AI Queue...
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="layers-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                Queue is empty
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                {activeTab === 'all'
                  ? 'All screenshot AI analysis jobs have completed!'
                  : `No items in ${activeTab} status.`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  metricsCard: {
    padding: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  latencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#64748B30',
  },
  latencyText: {
    fontSize: 11,
    marginLeft: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  controlBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  controlBtnOutlineText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 40,
  },
  itemCard: {
    padding: 12,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemFileName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '800',
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stateText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemCategory: {
    fontSize: 11,
  },
  itemTiming: {
    fontSize: 10,
    marginTop: 3,
  },
  errorBox: {
    padding: 6,
    borderRadius: 4,
    marginTop: 6,
  },
  errorText: {
    fontSize: 11,
  },
  itemActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#64748B20',
  },
  itemActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  itemActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});

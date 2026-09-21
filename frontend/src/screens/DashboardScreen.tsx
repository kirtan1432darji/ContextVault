import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { useScannerStore } from '../store/scanner.store';
import { useSearchStore } from '../store/search.store';
import { ModernCard } from '../components/ModernCard';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { FileUtils } from '../utils/fileUtils';
import { DateFormatter } from '../utils/dateFormatter';
import { smartFolderService } from '../services/SmartFolderService';
import { screenshotListenerService } from '../services/ScreenshotListenerService';
import { mediaStoreService } from '../services/mediaStoreService';
import { screenshotRepository, chatRepository, RecentChatFolderSummary, searchRepository, RecentSearchItem, SavedSearchItem } from '../database/repositories';
import { useFolderContextStore } from '../store/folderContext.store';
import { useAuthStore } from '../store/auth.store';
import { useNotificationStore } from '../store/notification.store';
import { FeatureLockCard, GuestUpgradeBottomSheet } from '../components';
import { aiProcessingQueue, QueueStats, QueueItem } from '../services/background';
import { dailyDigestService, DailyDigest } from '../services/memory';

export const DashboardScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const screenshots = useScreenshotStore((s) => s.screenshots);
  const setScreenshots = useScreenshotStore((s) => s.setScreenshots);
  const needsReviewList = useScreenshotStore((s) => s.needsReviewList);
  const categories = useCategoryStore((s) => s.categories);
  const loadCategories = useCategoryStore((s) => s.loadCategories);

  // Sprint RN-06 Context Store State
  const contextsGeneratedToday = useFolderContextStore((s) => s.contextsGeneratedToday);
  const aiSyncedToday = useFolderContextStore((s) => s.aiSyncedToday);
  const recentlyUpdatedContexts = useFolderContextStore((s) => s.recentlyUpdatedContexts);
  const loadStatsAndRecents = useFolderContextStore((s) => s.loadStatsAndRecents);
  const [needsReviewCount, setNeedsReviewCount] = useState(0);

  // Sprint RN-07 Context AI Chat State
  const [recentChats, setRecentChats] = useState<RecentChatFolderSummary[]>([]);

  // Sprint RN-08 Global AI Search State
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);

  // Sprint P0 Guest Mode State
  const isGuest = useAuthStore((s) => s.isGuest);
  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string>('AI Features');

  const handleRestrictedAction = useCallback((featureName: string) => {
    setLockedFeatureName(featureName);
    setGuestModalVisible(true);
  }, []);

  const [isOrganizing, setIsOrganizing] = useState(false);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  // Sprint RN-03 Scanner Store State
  const isListening = useScannerStore((s) => s.isListening);
  const scannedToday = useScannerStore((s) => s.scannedToday);
  const pendingProcessing = useScannerStore((s) => s.pendingProcessing);
  const lastScreenshot = useScannerStore((s) => s.lastScreenshot);
  const startScanner = useScannerStore((s) => s.startScanner);
  const stopScanner = useScannerStore((s) => s.stopScanner);
  const simulateScreenshot = useScannerStore((s) => s.simulateScreenshot);

  // Sprint RN-04 OCR Pipeline State
  const ocrCompletedToday = useScannerStore((s) => s.ocrCompletedToday);
  const ocrPending = useScannerStore((s) => s.ocrPending);
  const ocrFailed = useScannerStore((s) => s.ocrFailed);
  const avgProcessingTimeMs = useScannerStore((s) => s.avgProcessingTimeMs);

  // Sprint P5-A Background AI Processing Queue State
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    averageProcessingTimeMs: 0,
  });
  const [currentQueueItem, setCurrentQueueItem] = useState<QueueItem | null>(null);
  const [isQueueProcessing, setIsQueueProcessing] = useState<boolean>(false);
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);

  const loadQueueData = useCallback(async () => {
    try {
      const stats = await aiProcessingQueue.getStats();
      setQueueStats(stats);
      setIsQueueProcessing(aiProcessingQueue.isProcessing());
      setIsQueuePaused(aiProcessingQueue.isPaused());
      setCurrentQueueItem(aiProcessingQueue.getCurrentItem());
    } catch (err) {
      console.warn('[DashboardScreen] Failed to load queue stats:', err);
    }
  }, []);

  const [todayDigest, setTodayDigest] = useState<DailyDigest | null>(null);

  const loadTodayDigest = useCallback(async () => {
    try {
      const digest = await dailyDigestService.getTodayDigest();
      setTodayDigest(digest);
    } catch (err) {
      console.warn('[DashboardScreen] Failed to load today digest:', err);
    }
  }, []);

  const loadRecentChats = useCallback(async () => {
    try {
      const chats = await chatRepository.getRecentChatFolders(4);
      setRecentChats(chats || []);
    } catch (err) {
      console.warn('Failed to load recent chats for dashboard:', err);
    }
  }, []);

  const loadRecentSearches = useCallback(async () => {
    try {
      const items = await searchRepository.getRecentSearches(6);
      setRecentSearches(items || []);
    } catch (err) {
      console.warn('Failed to load recent searches for dashboard:', err);
    }
  }, []);

  const loadSavedSearches = useCallback(async () => {
    try {
      const items = await searchRepository.getSavedSearches();
      setSavedSearches(items || []);
    } catch (err) {
      console.warn('Failed to load saved searches for dashboard:', err);
    }
  }, []);

  // Reload chats, recent searches, saved searches, and today digest whenever dashboard comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecentChats();
      loadRecentSearches();
      loadSavedSearches();
      loadQueueData();
      loadTodayDigest();
    }, [loadRecentChats, loadRecentSearches, loadSavedSearches, loadQueueData, loadTodayDigest])
  );

  // Subscribe to live background AI queue events
  useEffect(() => {
    const unsub = aiProcessingQueue.subscribe(() => {
      loadQueueData();
      loadTodayDigest();
    });
    return () => unsub();
  }, [loadQueueData, loadTodayDigest]);

  // Load fresh categories & screenshots & context stats on mount
  useEffect(() => {
    loadCategories();
    loadStatsAndRecents();
    loadRecentChats();
    loadRecentSearches();
    loadSavedSearches();
    loadQueueData();
    loadTodayDigest();
    screenshotRepository.getNeedsReviewCount().then(setNeedsReviewCount);
    screenshotRepository.getAllScreenshots().then((items) => {
      setScreenshots(items || []);
      // Discover and sync device screenshots in background on mount
      mediaStoreService.scanAndSyncScreenshots().catch(() => {});
      aiProcessingQueue.retryFailed().catch(() => {});
    });
  }, [loadCategories, setScreenshots, loadStatsAndRecents, loadRecentChats, loadRecentSearches, loadSavedSearches, loadQueueData, loadTodayDigest]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadCategories(),
        loadStatsAndRecents(),
        loadRecentChats(),
        loadRecentSearches(),
        loadSavedSearches(),
        loadQueueData(),
        loadTodayDigest(),
        screenshotRepository.getNeedsReviewCount().then(setNeedsReviewCount),
        mediaStoreService.scanAndSyncScreenshots().then(async () => {
          const items = await screenshotRepository.getAllScreenshots();
          setScreenshots(items || []);
        }),
        aiProcessingQueue.retryFailed().catch(() => {}),
        screenshotListenerService.refreshStoreCounts(),
      ]);
    } catch (err) {
      console.warn('Dashboard refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [loadCategories, loadStatsAndRecents, loadRecentChats, loadRecentSearches, loadSavedSearches, setScreenshots, loadQueueData, loadTodayDigest]);

  const totalCount = screenshots.length;
  const organizedCount = screenshots.filter((s) => s.categoryId && s.categoryId !== 'unsorted').length;
  const matchRate = totalCount > 0 ? Math.round((organizedCount / totalCount) * 100) : 0;

  // Sprint RN-05 Smart Folder Metrics & Lists
  const unsortedCount = useMemo(() => {
    return screenshots.filter((s) => !s.categoryId || s.categoryId === 'unsorted').length;
  }, [screenshots]);

  const [folderSort, setFolderSort] = useState<'count' | 'recent'>('count');

  const displayedFolders = useMemo(() => {
    const list = [...categories].filter((c) => c.id !== 'unsorted');
    if (folderSort === 'recent') {
      return list.sort((a, b) => new Date(b.updatedAt || b.createdOn || 0).getTime() - new Date(a.updatedAt || a.createdOn || 0).getTime()).slice(0, 8);
    }
    return list.sort((a, b) => (b.screenshotCount || 0) - (a.screenshotCount || 0)).slice(0, 8);
  }, [categories, folderSort]);

  const topFolders = useMemo(() => {
    return [...categories]
      .filter((c) => c.id !== 'unsorted')
      .sort((a, b) => (b.screenshotCount || 0) - (a.screenshotCount || 0))
      .slice(0, 6);
  }, [categories]);

  const recentFolders = useMemo(() => {
    return [...categories]
      .filter((c) => c.id !== 'unsorted' && (c.updatedAt || c.createdOn))
      .sort((a, b) => new Date(b.updatedAt || b.createdOn || 0).getTime() - new Date(a.updatedAt || a.createdOn || 0).getTime())
      .slice(0, 6);
  }, [categories]);

  const classifiedToday = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const localClassified = screenshots.filter(
      (s) => s.isAutoCategorized && s.createdAt && s.createdAt.startsWith(todayStr)
    ).length;
    return Math.max(localClassified, ocrCompletedToday);
  }, [screenshots, ocrCompletedToday]);

  const handleOrganizeUnsorted = async () => {
    setIsOrganizing(true);
    try {
      const count = await smartFolderService.organizeAllUnsorted();
      await loadCategories();
      const updatedScreenshots = await screenshotRepository.getAllScreenshots();
      setScreenshots(updatedScreenshots);
      Alert.alert('Smart Folders', `Organized ${count} unsorted screenshots into smart folders.`);
    } catch (err: any) {
      Alert.alert('Organization Error', err?.message || 'Failed to auto-organize.');
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleToggleScanner = async () => {
    if (isListening) {
      await stopScanner();
    } else {
      await startScanner();
    }
  };

  const renderLastScreenshotStatus = (status?: string) => {
    if (!status) return null;
    let bg = '#64748B20';
    let textColor = '#64748B';

    switch (status) {
      case 'Pending':
        bg = '#F59E0B20';
        textColor = '#F59E0B';
        break;
      case 'Processing':
        bg = '#3B82F620';
        textColor = '#3B82F6';
        break;
      case 'Completed':
        bg = '#10B98120';
        textColor = '#10B981';
        break;
      case 'Failed':
        bg = '#EF444420';
        textColor = '#EF4444';
        break;
    }

    return (
      <View style={[styles.statusMiniChip, { backgroundColor: bg }]}>
        <Text style={[styles.statusMiniText, { color: textColor }]}>{status}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* 1. Header & Title */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.brandTitle, { color: theme.colors.textPrimary }]}>
            ContextVault
          </Text>
          <Text style={[styles.brandSubtitle, { color: theme.colors.textSecondary }]}>
            Automatic Screenshot Intelligence
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('NotificationCenter')}
            style={[
              styles.iconButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                marginRight: 8,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open Notification Center"
          >
            <Icon name="notifications-outline" size={20} color={theme.colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={[styles.headerUnreadBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.headerUnreadBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'Settings' })}
            style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Open ContextVault Settings"
          >
            <Icon name="cog-outline" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Guest Mode Banner (Sprint P0) */}
      {isGuest && (
        <View
          style={[
            styles.guestBanner,
            {
              backgroundColor: theme.isDark ? '#1F2937' : '#FEF3C7',
              borderColor: theme.isDark ? '#374151' : '#FDE68A',
            },
          ]}
        >
          <View style={styles.guestBannerLeft}>
            <View
              style={[
                styles.guestBadgeIcon,
                { backgroundColor: theme.isDark ? '#374151' : '#FBBF2420' },
              ]}
            >
              <Icon name="person-outline" size={18} color={theme.colors.accent} />
            </View>
            <View style={styles.guestBannerTextGroup}>
              <View style={styles.rowCenter}>
                <Text style={[styles.guestBannerTitle, { color: theme.colors.textPrimary }]}>
                  Guest Mode
                </Text>
                <View style={[styles.guestLockPill, { backgroundColor: `${theme.colors.accent}20` }]}>
                  <Icon name="lock-closed" size={10} color={theme.colors.accent} style={{ marginRight: 3 }} />
                  <Text style={[styles.guestLockPillText, { color: theme.colors.accent }]}>Local Only</Text>
                </View>
              </View>
              <Text style={[styles.guestBannerSubtitle, { color: theme.colors.textSecondary }]}>
                AI features are locked until you sign in.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.guestBannerSignInBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Sign in to unlock AI features"
          >
            <Text style={styles.guestBannerSignInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Ask ContextVault Hero Search Bar (Sprint RN-08) */}
      <View style={styles.heroSearchSection}>
        <TouchableOpacity
          onPress={() => navigation.navigate('GlobalAISearch', { autoFocus: true })}
          style={[
            styles.heroSearchBar,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Ask ContextVault Global AI Search"
        >
          <View style={styles.heroSearchLeft}>
            <View style={[styles.heroSparkleBox, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Icon name="sparkles" size={16} color={theme.colors.primary} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={styles.rowCenter}>
                <Text style={[styles.heroSearchTitle, { color: theme.colors.textPrimary }]}>
                  Ask ContextVault
                </Text>
                <View style={[styles.aiPill, { backgroundColor: `${theme.colors.accent}18` }]}>
                  <Text style={[styles.aiPillText, { color: theme.colors.accent }]}>Global AI</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.heroSearchPlaceholder, { color: theme.colors.textSecondary }]}>
                Search receipts, UPI, Amazon, Flutter code...
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              useSearchStore.getState().setVoiceModalOpen(true);
              navigation.navigate('GlobalAISearch', { autoFocus: false });
            }}
            style={[styles.heroMicBtn, { backgroundColor: `${theme.colors.primary}18` }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Search by Voice"
          >
            <Icon name="mic" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Saved Searches Chips under hero bar */}
        {savedSearches.length > 0 && (
          <View style={styles.heroRecentStrip}>
            <Icon name="bookmark" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroRecentScroll}>
              {savedSearches.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('GlobalAISearch', { initialQuery: item.query })}
                  style={[
                    styles.heroSavedChip,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: `${item.colorHex || theme.colors.primary}40`,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={item.iconName || 'bookmark'}
                    size={11}
                    color={item.colorHex || theme.colors.primary}
                    style={{ marginRight: 5 }}
                  />
                  <Text numberOfLines={1} style={[styles.heroSavedChipText, { color: theme.colors.textPrimary }]}>
                    {item.title || item.query}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent Search Chips under hero bar */}
        {recentSearches.length > 0 && (
          <View style={styles.heroRecentStrip}>
            <Icon name="time-outline" size={13} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroRecentScroll}>
              {recentSearches.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('GlobalAISearch', { initialQuery: item.query })}
                  style={[
                    styles.heroRecentChip,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.heroRecentChipText, { color: theme.colors.textPrimary }]}>
                    {item.query}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* 3. Stats Header Card */}
      <ModernCard style={styles.statsCard}>
        <View style={styles.statCol}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            <AnimatedCounter value={totalCount} />
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Screenshots
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statCol}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            <AnimatedCounter value={organizedCount} />
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Organized
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statCol}>
          <Text style={[styles.statValue, { color: theme.colors.accent }]}>
            {matchRate}%
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Accuracy
          </Text>
        </View>
      </ModernCard>

      {/* Quick Action Hub (Sprint P0) */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => navigation.navigate('ScannerStatus')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.primary + '15' }]}>
            <Icon name="scan-outline" size={22} color={theme.colors.primary} />
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.textPrimary }]}>
            Scan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => navigation.navigate('GlobalAISearch', { autoFocus: false })}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.info + '15' }]}>
            <Icon name="search-outline" size={22} color={theme.colors.info} />
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.textPrimary }]}>
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Folders' })}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.warning + '15' }]}>
            <Icon name="folder-outline" size={22} color={theme.colors.warning} />
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.textPrimary }]}>
            Folders
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => navigation.navigate('FolderAnalytics')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.success + '15' }]}>
            <Icon name="analytics-outline" size={22} color={theme.colors.success} />
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.textPrimary }]}>
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Automatic Screenshot Detection Engine Hero Card (Sprint RN-03) */}
      <ModernCard style={styles.heroEngineCard}>
        {/* Top Header: Title, Status Indicator, and Diagnostics button */}
        <View style={styles.engineHeaderRow}>
          <View style={styles.engineStatusBadge}>
            <View
              style={[
                styles.livePulseDot,
                { backgroundColor: isListening ? theme.colors.success : theme.colors.warning },
              ]}
            />
            <Text style={[styles.engineStatusText, { color: theme.colors.textPrimary }]}>
              {isListening ? 'Scanner Running' : 'Scanner Paused'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('ScannerStatus')}
            style={[styles.engineDetailsBtn, { borderColor: theme.colors.border }]}
          >
            <Icon
              name="pulse-outline"
              size={14}
              color={theme.colors.primary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.engineDetailsBtnText, { color: theme.colors.primary }]}>
              Diagnostics
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real-time metrics strip */}
        <View style={styles.engineMetricsRow}>
          <View style={styles.engineMetricItem}>
            <Text style={[styles.engineMetricNum, { color: theme.colors.primary }]}>
              <AnimatedCounter value={scannedToday} />
            </Text>
            <Text style={[styles.engineMetricLabel, { color: theme.colors.textSecondary }]}>
              Today's Screenshots
            </Text>
          </View>

          <View style={[styles.engineMetricDivider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.engineMetricItem}>
            <View style={styles.rowCenter}>
              <Text style={[styles.engineMetricNum, { color: theme.colors.accent }]}>
                <AnimatedCounter value={pendingProcessing} />
              </Text>
              {pendingProcessing > 0 && (
                <View
                  style={[
                    styles.processingIndicator,
                    { backgroundColor: theme.colors.accent + '20' },
                  ]}
                >
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.accent}
                    style={{ transform: [{ scale: 0.6 }] }}
                  />
                </View>
              )}
            </View>
            <Text style={[styles.engineMetricLabel, { color: theme.colors.textSecondary }]}>
              Pending Processing
            </Text>
          </View>
        </View>

        {/* Last Detected Screenshot */}
        <View
          style={[
            styles.lastDetectedContainer,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <View style={styles.lastDetectedHeader}>
            <Text style={[styles.lastDetectedTitle, { color: theme.colors.textSecondary }]}>
              LAST DETECTED SCREENSHOT
            </Text>
            {renderLastScreenshotStatus(lastScreenshot?.status)}
          </View>

          {lastScreenshot ? (
            <TouchableOpacity
              onPress={() => {
                if (lastScreenshot.id) {
                  navigation.navigate('ScreenshotDetail', { id: lastScreenshot.id });
                }
              }}
              activeOpacity={lastScreenshot.id ? 0.7 : 1}
              style={styles.lastItemRow}
            >
              <ScreenshotImageThumbnail
                screenshot={lastScreenshot}
                filePath={lastScreenshot.filePath}
                localPath={lastScreenshot.localPath}
                contentUri={lastScreenshot.contentUri}
                thumbnailUri={lastScreenshot.thumbnailUri}
                deviceAssetId={lastScreenshot.deviceAssetId}
                style={styles.lastItemThumb}
                borderRadius={8}
                showLoadingIndicator
                enableRetry
              />
              <View style={styles.lastItemDetails}>
                <Text
                  numberOfLines={1}
                  style={[styles.lastItemName, { color: theme.colors.textPrimary }]}
                >
                  {lastScreenshot.fileName}
                </Text>
                <Text style={[styles.lastItemTime, { color: theme.colors.textSecondary }]}>
                  {FileUtils.formatBytes(lastScreenshot.fileSize)} • Detected automatically
                </Text>
              </View>
              {lastScreenshot.id ? (
                <Icon name="chevron-forward" size={16} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
              ) : null}
            </TouchableOpacity>
          ) : (
            <View style={styles.lastItemEmptyRow}>
              <Icon
                name="radio-outline"
                size={16}
                color={theme.colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.lastItemEmptyText, { color: theme.colors.textSecondary }]}>
                Waiting for screenshots from device MediaStore...
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.engineActionsRow}>
          <TouchableOpacity
            onPress={handleToggleScanner}
            style={[
              styles.engineToggleBtn,
              {
                backgroundColor: isListening
                  ? theme.isDark
                    ? '#334155'
                    : '#E2E8F0'
                  : theme.colors.primary,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Pause background screenshot scanner' : 'Resume background screenshot scanner'}
          >
            <Icon
              name={isListening ? 'pause-outline' : 'play-outline'}
              size={15}
              color={isListening ? theme.colors.textPrimary : '#FFFFFF'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.engineToggleBtnText,
                { color: isListening ? theme.colors.textPrimary : '#FFFFFF' },
              ]}
            >
              {isListening ? 'Pause Scanner' : 'Resume Scanner'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => simulateScreenshot()}
            style={[styles.engineSimulateBtn, { borderColor: theme.colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Simulate synthetic screenshot capture"
          >
            <Icon
              name="camera-outline"
              size={15}
              color={theme.colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.engineSimulateBtnText, { color: theme.colors.primary }]}>
              Simulate Capture
            </Text>
          </TouchableOpacity>
        </View>
      </ModernCard>

      {/* 4. Sprint RN-04: Google ML Kit OCR Processing Engine Card */}
      <ModernCard style={styles.ocrStatsCard}>
        <View style={styles.ocrTitleRow}>
          <View style={styles.ocrTitleLeft}>
            <View style={[styles.ocrBadgeIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
              <Icon name="scan-outline" size={18} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.ocrSectionTitle, { color: theme.colors.textPrimary }]}>
                Google ML Kit OCR Engine
              </Text>
              <Text style={[styles.ocrSectionSubtitle, { color: theme.colors.textSecondary }]}>
                On-device privacy-first text extraction
              </Text>
            </View>
          </View>
          <View style={[styles.avgTimePill, { backgroundColor: `${theme.colors.accent}15` }]}>
            <Icon name="flash" size={12} color={theme.colors.accent} style={{ marginRight: 3 }} />
            <Text style={[styles.avgTimeText, { color: theme.colors.accent }]}>
              {avgProcessingTimeMs > 0 ? `${avgProcessingTimeMs}ms avg` : 'Fast ~180ms'}
            </Text>
          </View>
        </View>

        <View style={styles.ocrMetricsGrid}>
          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.success }]}>
              <AnimatedCounter value={ocrCompletedToday} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              OCR Completed
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.accent }]}>
              <AnimatedCounter value={ocrPending} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              OCR Pending
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text
              style={[
                styles.ocrMetricValue,
                { color: ocrFailed > 0 ? theme.colors.error : theme.colors.textSecondary },
              ]}
            >
              <AnimatedCounter value={ocrFailed} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              OCR Failed
            </Text>
          </View>
        </View>
      </ModernCard>

      {/* 4b. Sprint P5-A: Background AI Processing Queue Card */}
      <ModernCard style={styles.ocrStatsCard}>
        <View style={styles.ocrTitleRow}>
          <View style={styles.ocrTitleLeft}>
            <View style={[styles.ocrBadgeIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
              <Icon name="hardware-chip" size={18} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.ocrSectionTitle, { color: theme.colors.textPrimary }]}>
                AI Processing Queue
              </Text>
              <Text style={[styles.ocrSectionSubtitle, { color: theme.colors.textSecondary }]}>
                Sequential OCR + Local Vision AI (RTX 4050)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AIQueue')}
            style={[styles.avgTimePill, { backgroundColor: `${theme.colors.primary}15` }]}
          >
            <Text style={[styles.avgTimeText, { color: theme.colors.primary }]}>Manage Queue ›</Text>
          </TouchableOpacity>
        </View>

        {/* Live status & progress bar */}
        {queueStats.total > 0 && (
          <View style={{ marginTop: 10, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' }}>
                {isQueueProcessing
                  ? `Analyzing: ${currentQueueItem?.fileName || 'Processing...'}`
                  : isQueuePaused
                  ? 'Queue Paused'
                  : queueStats.pending > 0
                  ? `${queueStats.pending} waiting in queue`
                  : 'All screenshots analyzed'}
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>
                {queueStats.total > 0
                  ? `${Math.round((queueStats.completed / queueStats.total) * 100)}%`
                  : '100%'}
              </Text>
            </View>
            <View
              style={{
                height: 6,
                backgroundColor: theme.colors.surfaceVariant,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${
                    queueStats.total > 0
                      ? Math.min(100, Math.round((queueStats.completed / queueStats.total) * 100))
                      : 0
                  }%`,
                  backgroundColor: theme.colors.primary,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        )}

        <View style={styles.ocrMetricsGrid}>
          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: '#F59E0B' }]}>
              <AnimatedCounter value={queueStats.pending} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Pending
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.primary }]}>
              <AnimatedCounter value={queueStats.processing} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Active
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.success }]}>
              <AnimatedCounter value={queueStats.completed} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Completed
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text
              style={[
                styles.ocrMetricValue,
                { color: queueStats.failed > 0 ? theme.colors.error : theme.colors.textSecondary },
              ]}
            >
              <AnimatedCounter value={queueStats.failed} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Failed
            </Text>
          </View>
        </View>
      </ModernCard>

      {/* 4c. Sprint P6-A: Today's AI Digest & Memory Highlights */}
      <ModernCard style={styles.ocrStatsCard}>
        <View style={styles.ocrTitleRow}>
          <View style={styles.ocrTitleLeft}>
            <View style={[styles.ocrBadgeIcon, { backgroundColor: `${theme.colors.accent}18` }]}>
              <Icon name="sparkles" size={18} color={theme.colors.accent} />
            </View>
            <View>
              <Text style={[styles.ocrSectionTitle, { color: theme.colors.textPrimary }]}>
                Today's AI Memory Digest
              </Text>
              <Text style={[styles.ocrSectionSubtitle, { color: theme.colors.textSecondary }]}>
                {todayDigest?.dateFormatted || 'Today in ContextVault'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('MemoryTimeline')}
            style={[styles.avgTimePill, { backgroundColor: `${theme.colors.accent}15` }]}
          >
            <Text style={[styles.avgTimeText, { color: theme.colors.accent }]}>View Timeline ›</Text>
          </TouchableOpacity>
        </View>

        {/* AI Summary Text */}
        <Text
          style={{
            fontSize: 13,
            color: theme.colors.textPrimary,
            lineHeight: 18,
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          {todayDigest?.summary || "Analyzing today's memories..."}
        </Text>

        {/* 4 Metrics Strip: Shots, Spent, Orders, Travel */}
        <View style={styles.ocrMetricsGrid}>
          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.primary }]}>
              <AnimatedCounter value={todayDigest?.totalScreenshots || 0} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Shots Today
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.success }]}>
              {todayDigest && todayDigest.payments.totalAmount > 0
                ? `₹${todayDigest.payments.totalAmount.toLocaleString('en-IN')}`
                : '₹0'}
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Spent Today
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: '#F59E0B' }]}>
              <AnimatedCounter value={todayDigest?.orders.count || 0} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Orders Today
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.info }]}>
              <AnimatedCounter value={todayDigest?.travel.count || 0} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Travel Today
            </Text>
          </View>
        </View>
      </ModernCard>

      {/* 5. Sprint RN-06: Context Folders & Backend AI Sync Metrics */}
      <ModernCard style={styles.ocrStatsCard}>
        <View style={styles.ocrTitleRow}>
          <View style={styles.ocrTitleLeft}>
            <View style={[styles.ocrBadgeIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
              <Icon name="sparkles" size={18} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.ocrSectionTitle, { color: theme.colors.textPrimary }]}>
                Folder Context & AI Sync
              </Text>
              <Text style={[styles.ocrSectionSubtitle, { color: theme.colors.textSecondary }]}>
                Living intelligence & backend classification
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => isGuest && handleRestrictedAction('AI Sync')}
            disabled={!isGuest}
            style={[
              styles.avgTimePill,
              { backgroundColor: isGuest ? `${theme.colors.accent}15` : `${theme.colors.success}15` },
            ]}
          >
            <Icon
              name={isGuest ? 'lock-closed' : 'shield-checkmark'}
              size={12}
              color={isGuest ? theme.colors.accent : theme.colors.success}
              style={{ marginRight: 3 }}
            />
            <Text
              style={[
                styles.avgTimeText,
                { color: isGuest ? theme.colors.accent : theme.colors.success },
              ]}
            >
              {isGuest ? 'Login required' : 'Active'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ocrMetricsGrid}>
          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.primary }]}>
              <AnimatedCounter value={contextsGeneratedToday} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Contexts Today
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.success }]}>
              <AnimatedCounter value={aiSyncedToday} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              AI Synced Today
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text
              style={[
                styles.ocrMetricValue,
                { color: needsReviewCount > 0 ? theme.colors.accent : theme.colors.textSecondary },
              ]}
            >
              <AnimatedCounter value={needsReviewCount} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              Needs Review
            </Text>
          </View>
        </View>
      </ModernCard>

      {/* 6. Sprint RN-07: Context AI Chat / Feature Lock */}
      {isGuest ? (
        <FeatureLockCard
          title="Context AI Chat Locked"
          featureName="Context AI Chat"
          description="Sign in to chat with screenshots inside folders, ask natural language questions, and extract entities."
          onSignIn={() => navigation.navigate('Login')}
          onCreateAccount={() => navigation.navigate('Register')}
        />
      ) : recentChats.length > 0 ? (
        <ModernCard style={styles.chatResumeCard}>
          <View style={styles.chatResumeHeader}>
            <View style={styles.rowCenter}>
              <View style={[styles.chatAvatarIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Icon name="sparkles" size={16} color={theme.colors.primary} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.chatResumeHeading, { color: theme.colors.textPrimary }]}>
                  Continue AI Conversation
                </Text>
                <Text style={[styles.chatResumeSubheading, { color: theme.colors.textSecondary }]}>
                  Living folder intelligence
                </Text>
              </View>
            </View>
            <View style={[styles.chatActivePill, { backgroundColor: `${theme.colors.success}15` }]}>
              <View style={[styles.livePulseDot, { backgroundColor: theme.colors.success, marginRight: 5 }]} />
              <Text style={[styles.chatActiveText, { color: theme.colors.success }]}>Active</Text>
            </View>
          </View>

          {/* Primary / Most Recent Chat Target */}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ContextAIChat', {
                categoryId: recentChats[0].folderId,
                categoryName: recentChats[0].folderName,
              })
            }
            style={[
              styles.chatPrimaryBox,
              {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.chatFolderRow}>
              <View style={styles.rowCenter}>
                <Icon
                  name={recentChats[0].iconName || 'folder'}
                  size={16}
                  color={recentChats[0].colorHex || theme.colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.chatFolderName, { color: theme.colors.textPrimary }]}>
                  {recentChats[0].folderName}
                </Text>
              </View>
              {recentChats[0].lastUpdated && (
                <Text style={[styles.chatTimestamp, { color: theme.colors.textSecondary }]}>
                  {new Date(recentChats[0].lastUpdated).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </View>

            <View style={styles.chatMessageSnippetRow}>
              <Icon
                name={recentChats[0].lastMessageRole === 'user' ? 'person-outline' : 'chatbox-ellipses'}
                size={14}
                color={theme.colors.textSecondary}
                style={{ marginRight: 6, marginTop: 2 }}
              />
              <Text
                numberOfLines={2}
                style={[styles.chatSnippetText, { color: theme.colors.textPrimary }]}
              >
                {recentChats[0].lastMessage}
              </Text>
            </View>

            <View style={styles.chatResumeActionRow}>
              <Text style={[styles.chatCountBadge, { color: theme.colors.textSecondary }]}>
                {recentChats[0].messageCount} message{recentChats[0].messageCount > 1 ? 's' : ''}
              </Text>
              <View style={styles.rowCenter}>
                <Text style={[styles.chatResumeBtnText, { color: theme.colors.primary }]}>
                  Resume Chat
                </Text>
                <Icon name="chevron-forward" size={14} color={theme.colors.primary} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Secondary recent chats if more than 1 */}
          {recentChats.length > 1 && (
            <View style={styles.otherChatsRow}>
              <Text style={[styles.otherChatsLabel, { color: theme.colors.textSecondary }]}>
                Also active:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginLeft: 8 }}>
                {recentChats.slice(1).map((chat) => (
                  <TouchableOpacity
                    key={chat.folderId}
                    onPress={() =>
                      navigation.navigate('ContextAIChat', {
                        categoryId: chat.folderId,
                        categoryName: chat.folderName,
                      })
                    }
                    style={[
                      styles.miniChatChip,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Icon
                      name="chatbubble-outline"
                      size={12}
                      color={chat.colorHex || theme.colors.primary}
                      style={{ marginRight: 4 }}
                    />
                    <Text numberOfLines={1} style={[styles.miniChatChipText, { color: theme.colors.textPrimary }]}>
                      {chat.folderName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ModernCard>
      ) : (
        /* Promo / Quick Start Card when no conversation exists yet */
        <ModernCard style={styles.chatPromoCard}>
          <View style={styles.chatPromoLeft}>
            <View style={[styles.chatAvatarIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Icon name="sparkles" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.chatPromoTitle, { color: theme.colors.textPrimary }]}>
                Chat with Context AI
              </Text>
              <Text style={[styles.chatPromoDesc, { color: theme.colors.textSecondary }]}>
                Ask questions, find receipts, or summarize info across your smart screenshot folders.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              const target = topFolders[0] || categories[0];
              navigation.navigate('ContextAIChat', {
                categoryId: target?.id,
                categoryName: target?.name || 'All Screenshots',
              });
            }}
            style={[styles.chatStartBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Icon name="chatbubbles" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.chatStartBtnText}>Start AI Chat</Text>
          </TouchableOpacity>
        </ModernCard>
      )}

      {/* 7. Sprint RN-06: Recently Updated Contexts */}
      {recentlyUpdatedContexts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Recently Updated Contexts
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Folders' })}>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>All Folders</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recentlyUpdatedContexts}
            keyExtractor={(item) => item.categoryId}
            renderItem={({ item }) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              const catName = cat ? cat.name : item.categoryName;
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (isGuest) {
                      handleRestrictedAction('Folder Context');
                      return;
                    }
                    navigation.navigate('FolderContext', {
                      categoryId: item.categoryId,
                      categoryName: catName,
                    });
                  }}
                  style={[styles.recentContextCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                >
                  <View style={styles.recentContextTop}>
                    <Icon name="folder-open" size={16} color={cat?.color || theme.colors.primary} />
                    <Text numberOfLines={1} style={[styles.recentContextName, { color: theme.colors.textPrimary }]}>
                      {catName}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={[styles.recentContextSummary, { color: theme.colors.textSecondary }]}>
                    {item.summary}
                  </Text>
                  {item.lastUpdatedAt && (
                    <Text style={[styles.recentContextTime, { color: theme.colors.textMuted }]}>
                      Updated {new Date(item.lastUpdatedAt).toLocaleDateString()}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* 7. Recent Screenshots Carousel */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Recent Screenshots ({screenshots.length})
          </Text>
          {screenshots.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Folders' })}>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All</Text>
            </TouchableOpacity>
          )}
        </View>
        {screenshots.length === 0 ? (
          <View
            style={[
              styles.emptyRecentCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <Icon name="images-outline" size={32} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyRecentTitle, { color: theme.colors.textPrimary }]}>
              No screenshots detected yet
            </Text>
            <Text style={[styles.emptyRecentSubtitle, { color: theme.colors.textSecondary }]}>
              Screenshots on your device are detected automatically.
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={screenshots.slice(0, 20)}
            keyExtractor={(item) => item.id}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
                style={styles.recentItem}
              >
                <ScreenshotImageThumbnail
                  screenshot={item}
                  filePath={item.filePath}
                  localPath={item.localPath}
                  contentUri={item.contentUri}
                  thumbnailUri={item.thumbnailUri}
                  deviceAssetId={item.deviceAssetId}
                  style={styles.recentThumb}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.recentCategory, { color: theme.colors.textSecondary }]}
                >
                  {item.fileName}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* 8. Needs Review Queue */}
      {needsReviewList.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.rowCenter}>
              <Icon name="alert-circle-outline" size={18} color={theme.colors.warning} />
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginLeft: 6 }]}>
                Needs Review ({needsReviewList.length})
              </Text>
            </View>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={needsReviewList.slice(0, 6)}
            keyExtractor={(item) => item.id}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
                style={styles.reviewItem}
              >
                <ScreenshotImageThumbnail
                  screenshot={item}
                  filePath={item.filePath}
                  localPath={item.localPath}
                  contentUri={item.contentUri}
                  thumbnailUri={item.thumbnailUri}
                  deviceAssetId={item.deviceAssetId}
                  style={styles.reviewThumb}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.reviewText, { color: theme.colors.textSecondary }]}
                >
                  {item.fileName}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* 7. Smart Folders Engine Section (Sprint RN-05) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Smart Folders
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Folders' })}>
            <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>All Folders</Text>
          </TouchableOpacity>
        </View>

        {/* Uncategorized quick-organize banner */}
        {unsortedCount > 0 && (
          <ModernCard style={[styles.uncategorizedCard, { borderColor: `${theme.colors.warning}50` }]}>
            <View style={styles.uncategorizedContent}>
              <View
                style={[
                  styles.uncategorizedIconBox,
                  { backgroundColor: `${theme.colors.warning}18` },
                ]}
              >
                <Icon name="file-tray-full-outline" size={24} color={theme.colors.warning} />
              </View>
              <View style={styles.uncategorizedTextContainer}>
                <Text style={[styles.uncategorizedTitle, { color: theme.colors.textPrimary }]}>
                  {unsortedCount} Uncategorized Screenshot{unsortedCount > 1 ? 's' : ''}
                </Text>
                <Text style={[styles.uncategorizedSubtitle, { color: theme.colors.textSecondary }]}>
                  Auto-classify into dynamic smart folders & topics
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleOrganizeUnsorted}
              disabled={isOrganizing}
              style={[styles.organizeBtn, { backgroundColor: theme.colors.primary }]}
            >
              {isOrganizing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="sparkles" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.organizeBtnText}>Auto-Organize</Text>
                </>
              )}
            </TouchableOpacity>
          </ModernCard>
        )}

        {/* Smart Folder Engine Metrics Strip */}
        <View
          style={[
            styles.sfEngineStatsRow,
            {
              backgroundColor: theme.isDark ? '#1E293B50' : '#F8FAFC',
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.sfEngineStatCol}>
            <Text style={[styles.sfEngineStatValue, { color: theme.colors.success }]}>
              <AnimatedCounter value={classifiedToday} />
            </Text>
            <Text style={[styles.sfEngineStatLabel, { color: theme.colors.textSecondary }]}>
              Classified Today
            </Text>
          </View>
          <View style={[styles.sfEngineStatDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.sfEngineStatCol}>
            <Text style={[styles.sfEngineStatValue, { color: theme.colors.primary }]}>
              <AnimatedCounter value={categories.filter((c) => c.id !== 'unsorted').length} />
            </Text>
            <Text style={[styles.sfEngineStatLabel, { color: theme.colors.textSecondary }]}>
              Smart Folders
            </Text>
          </View>
          <View style={[styles.sfEngineStatDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.sfEngineStatCol}>
            <Text
              style={[
                styles.sfEngineStatValue,
                {
                  color: unsortedCount > 0 ? theme.colors.warning : theme.colors.textSecondary,
                },
              ]}
            >
              <AnimatedCounter value={unsortedCount} />
            </Text>
            <Text style={[styles.sfEngineStatLabel, { color: theme.colors.textSecondary }]}>
              Uncategorized
            </Text>
          </View>
        </View>

        {/* Smart Folders Grid */}
        <View style={[styles.subSectionHeader, { alignItems: 'center', justifyContent: 'space-between' }]}>
          <View>
            <Text style={[styles.subSectionTitle, { color: theme.colors.textPrimary }]}>
              Smart Folders
            </Text>
            <Text style={[styles.subSectionBadge, { color: theme.colors.textSecondary }]}>
              {folderSort === 'count' ? 'Ranked by items' : 'Recently active'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: theme.colors.surfaceVariant, borderRadius: 8, padding: 2 }}>
            <TouchableOpacity
              onPress={() => setFolderSort('count')}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: folderSort === 'count' ? theme.colors.primary : 'transparent',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: folderSort === 'count' ? '#FFFFFF' : theme.colors.textSecondary }}>
                Most Items
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFolderSort('recent')}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: folderSort === 'recent' ? theme.colors.primary : 'transparent',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: folderSort === 'recent' ? '#FFFFFF' : theme.colors.textSecondary }}>
                Recent
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.foldersGrid}>
          {displayedFolders.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() =>
                navigation.navigate('FolderDetail', {
                  categoryId: cat.id,
                  categoryName: cat.name,
                })
              }
              style={[
                styles.folderCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {/* Cover Thumbnail or Header Placeholder */}
              {cat.coverUri ? (
                <View style={styles.folderCoverContainer}>
                  <ScreenshotImageThumbnail
                    thumbnailUri={cat.coverUri}
                    filePath={cat.coverUri}
                    style={styles.folderCoverImage}
                    resizeMode="cover"
                  />
                  <View style={styles.folderCoverOverlay} />
                </View>
              ) : (
                <View
                  style={[
                    styles.folderCoverPlaceholder,
                    { backgroundColor: `${cat.colorHex || cat.color || theme.colors.primary}15` },
                  ]}
                />
              )}

              {/* Icon & Confidence Row */}
              <View style={styles.folderCardHeader}>
                <View
                  style={[
                    styles.folderIconBox,
                    {
                      backgroundColor: `${cat.colorHex || cat.color || theme.colors.primary}25`,
                      borderColor: theme.colors.card,
                    },
                  ]}
                >
                  <Icon
                    name={cat.iconName || cat.icon || 'folder-outline'}
                    size={20}
                    color={cat.colorHex || cat.color || theme.colors.primary}
                  />
                </View>
                {cat.averageConfidence && cat.averageConfidence > 0 ? (
                  <View style={[styles.folderConfidenceBadge, { backgroundColor: '#10B98120' }]}>
                    <Text style={[styles.folderConfidenceText, { color: '#10B981' }]}>
                      {Math.round(cat.averageConfidence > 1 ? cat.averageConfidence : cat.averageConfidence * 100)}% AI
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                numberOfLines={1}
                style={[styles.folderName, { color: theme.colors.textPrimary }]}
              >
                {cat.name}
              </Text>

              <View style={styles.folderMetaRow}>
                <Text style={[styles.folderCount, { color: theme.colors.textSecondary }]}>
                  {cat.screenshotCount || 0} items
                </Text>
                {cat.storageSizeBytes && cat.storageSizeBytes > 0 ? (
                  <Text style={[styles.folderSizeText, { color: theme.colors.textSecondary }]}>
                    • {FileUtils.formatBytes(cat.storageSizeBytes)}
                  </Text>
                ) : null}
              </View>

              <Text style={[styles.folderTimeText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {cat.updatedAt || cat.createdOn ? DateFormatter.formatRelative(cat.updatedAt || cat.createdOn!) : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recently Created Folders */}
        {recentFolders.length > 0 && (
          <View style={styles.recentFoldersSection}>
            <View style={styles.subSectionHeader}>
              <View style={styles.rowCenter}>
                <Icon
                  name="time-outline"
                  size={15}
                  color={theme.colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.subSectionTitle, { color: theme.colors.textPrimary }]}>
                  Recently Created Folders
                </Text>
              </View>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentFolders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('FolderDetail', {
                      categoryId: item.id,
                      categoryName: item.name,
                    })
                  }
                  style={[
                    styles.recentFolderCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.recentFolderIconBox,
                      { backgroundColor: `${item.colorHex || item.color || theme.colors.primary}18` },
                    ]}
                  >
                    <Icon
                      name={item.iconName || item.icon || 'folder-outline'}
                      size={18}
                      color={item.colorHex || item.color || theme.colors.primary}
                    />
                  </View>
                  <View style={styles.recentFolderInfo}>
                    <Text
                      numberOfLines={1}
                      style={[styles.recentFolderName, { color: theme.colors.textPrimary }]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.recentFolderSub, { color: theme.colors.textSecondary }]}
                    >
                      {item.path || `${item.screenshotCount || 0} items`}
                    </Text>
                  </View>
                  <View style={[styles.newBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <Text style={[styles.newBadgeText, { color: theme.colors.primary }]}>NEW</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
      <GuestUpgradeBottomSheet
        visible={guestModalVisible}
        onDismiss={() => setGuestModalVisible(false)}
        featureName={lockedFeatureName}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 16,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroEngineCard: {
    marginBottom: 16,
    padding: 16,
  },
  engineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  engineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  engineStatusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  engineDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  engineDetailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  engineMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F030',
    marginBottom: 14,
  },
  engineMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  engineMetricNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  engineMetricLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  engineMetricDivider: {
    width: 1,
    height: 28,
  },
  processingIndicator: {
    marginLeft: 6,
    borderRadius: 8,
    padding: 2,
  },
  lastDetectedContainer: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  lastDetectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lastDetectedTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusMiniChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusMiniText: {
    fontSize: 10,
    fontWeight: '700',
  },
  lastItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastItemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 10,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lastItemDetails: {
    flex: 1,
  },
  lastItemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  lastItemTime: {
    fontSize: 11,
    marginTop: 2,
  },
  lastItemEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  lastItemEmptyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  engineActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  engineToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  engineToggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  engineSimulateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  engineSimulateBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ocrStatsCard: {
    marginBottom: 24,
    padding: 16,
  },
  ocrTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ocrTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ocrBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ocrSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ocrSectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  avgTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  avgTimeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ocrMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ocrMetricBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  ocrMetricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  ocrMetricTitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentItem: {
    width: 120,
    marginRight: 12,
  },
  recentThumb: {
    width: 120,
    height: 160,
    borderRadius: 10,
    marginBottom: 6,
  },
  recentCategory: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyRecentCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  emptyRecentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyRecentSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  reviewItem: {
    width: 100,
    marginRight: 10,
  },
  reviewThumb: {
    width: 100,
    height: 130,
    borderRadius: 10,
    marginBottom: 4,
  },
  reviewText: {
    fontSize: 11,
    fontWeight: '500',
  },
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  folderCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  folderCoverContainer: {
    height: 60,
    width: '100%',
    position: 'relative',
  },
  folderCoverImage: {
    width: '100%',
    height: 60,
  },
  folderCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  folderCoverPlaceholder: {
    height: 28,
    width: '100%',
  },
  folderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: -14,
    marginBottom: 4,
  },
  folderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  folderConfidenceBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  folderConfidenceText: {
    fontSize: 9,
    fontWeight: '700',
  },
  folderName: {
    fontSize: 13,
    fontWeight: '700',
    marginHorizontal: 8,
    marginBottom: 2,
  },
  folderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  folderSizeText: {
    fontSize: 10,
  },
  folderTimeText: {
    fontSize: 10,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  uncategorizedCard: {
    marginBottom: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  uncategorizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  uncategorizedIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  uncategorizedTextContainer: {
    flex: 1,
  },
  uncategorizedTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  uncategorizedSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  organizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  organizeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sfEngineStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sfEngineStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  sfEngineStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  sfEngineStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  sfEngineStatDivider: {
    width: 1,
    height: 28,
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  subSectionBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
  recentFoldersSection: {
    marginTop: 10,
  },
  recentFolderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    minWidth: 180,
    maxWidth: 220,
  },
  recentFolderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  recentFolderInfo: {
    flex: 1,
    marginRight: 6,
  },
  recentFolderName: {
    fontSize: 13,
    fontWeight: '700',
  },
  recentFolderSub: {
    fontSize: 10,
    marginTop: 1,
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recentContextCard: {
    width: 220,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 12,
  },
  recentContextTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  recentContextName: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
    flex: 1,
  },
  recentContextSummary: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  recentContextTime: {
    fontSize: 10,
    fontWeight: '500',
  },
  chatResumeCard: {
    padding: 16,
    marginBottom: 16,
  },
  chatResumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chatAvatarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatResumeHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  chatResumeSubheading: {
    fontSize: 11,
    marginTop: 1,
  },
  chatActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chatActiveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatPrimaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  chatFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chatFolderName: {
    fontSize: 14,
    fontWeight: '700',
  },
  chatTimestamp: {
    fontSize: 11,
  },
  chatMessageSnippetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  chatSnippetText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  chatResumeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#64748B30',
  },
  chatCountBadge: {
    fontSize: 11,
  },
  chatResumeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 2,
  },
  otherChatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
  },
  otherChatsLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniChatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  miniChatChipText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120,
  },
  chatPromoCard: {
    padding: 16,
    marginBottom: 16,
  },
  chatPromoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chatPromoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  chatPromoDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  chatStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  chatStartBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroSearchSection: {
    marginBottom: 16,
  },
  heroSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  heroSearchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  heroSparkleBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSearchTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  aiPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSearchPlaceholder: {
    fontSize: 12,
    marginTop: 2,
  },
  heroMicBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRecentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  heroRecentScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRecentChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  heroRecentChipText: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 140,
  },
  heroSavedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  heroSavedChipText: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 140,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  guestBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  guestBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBannerTextGroup: {
    flex: 1,
    marginLeft: 10,
  },
  guestBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  guestLockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  guestLockPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  guestBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  guestBannerSignInBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBannerSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});

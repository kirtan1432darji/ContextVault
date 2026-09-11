import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import {
  storageManagerService,
  StorageBreakdown,
  DuplicateDetectionResult,
  CleanupRecommendation,
} from '../services/storageManagerService';

export const StorageScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [recommendations, setRecommendations] = useState<CleanupRecommendation[]>([]);
  const [expandedDuplicateGroupId, setExpandedDuplicateGroupId] = useState<string | null>(null);

  const loadStorage = useCallback(async () => {
    try {
      const [bd, dups] = await Promise.all([
        storageManagerService.getStorageBreakdown(),
        storageManagerService.findDuplicates(),
      ]);
      setBreakdown(bd);
      setDuplicateResult(dups);
      setRecommendations(storageManagerService.getCleanupRecommendations(bd, dups));
    } catch (err) {
      console.warn('[StorageScreen] Failed to load storage stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  const handleVacuum = async () => {
    setActionInProgress('vacuum');
    try {
      await storageManagerService.vacuumDatabase();
      Alert.alert('Database Optimized', 'SQLite database has been defragmented and unallocated space reclaimed.');
      await loadStorage();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to vacuum database.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClearOCR = () => {
    Alert.alert(
      'Clear OCR Cache',
      'This will remove cached extracted text records. Original screenshots in your device gallery will NOT be affected. Ready to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress('ocr');
            try {
              await storageManagerService.clearOCRCache();
              await loadStorage();
              Alert.alert('Cleared', 'OCR cache removed successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear OCR cache.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleClearSearch = () => {
    Alert.alert('Clear Search History', 'Clear all recent search queries and cached search terms?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setActionInProgress('search');
          try {
            await storageManagerService.clearSearchCache();
            await loadStorage();
            Alert.alert('Cleared', 'Search history cleared.');
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to clear search cache.');
          } finally {
            setActionInProgress(null);
          }
        },
      },
    ]);
  };

  const handleClearChat = () => {
    Alert.alert('Clear Chat History', 'Delete all conversation messages across all folder context chats?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          setActionInProgress('chat');
          try {
            await storageManagerService.clearChatHistory();
            await loadStorage();
            Alert.alert('Deleted', 'Chat history cleared successfully.');
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to clear chat history.');
          } finally {
            setActionInProgress(null);
          }
        },
      },
    ]);
  };

  const handleClearMemory = () => {
    storageManagerService.clearThumbnailMemoryCache();
    loadStorage();
    Alert.alert('Memory Freed', 'Thumbnail preview memory cache cleared.');
  };

  const handleCleanSingleDuplicate = (duplicateId: string) => {
    Alert.alert(
      'Remove Duplicate Record',
      'Unindex this duplicate screenshot from ContextVault? The original photo file on your device remains completely untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Duplicate',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(`dup_${duplicateId}`);
            try {
              await storageManagerService.cleanDuplicates([duplicateId]);
              await loadStorage();
              Alert.alert('Duplicate Removed', 'Redundant screenshot entry removed from ContextVault.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove duplicate.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleCleanAllDuplicates = () => {
    const totalDups = duplicateResult?.totalDuplicates || 0;
    const bytes = duplicateResult?.reclaimableBytes || 0;
    if (totalDups === 0) {
      Alert.alert('No Duplicates', 'No duplicate screenshots found.');
      return;
    }

    Alert.alert(
      'Clean All Duplicates',
      `Unindex all ${totalDups} duplicate screenshot records? This frees ~${storageManagerService.formatBytes(
        bytes
      )} of index and cache space. Original photos in your device gallery will NOT be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clean All Duplicates',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress('clean_all_duplicates');
            try {
              const allDupIds =
                duplicateResult?.groups.flatMap((g) => g.duplicates.map((d) => d.id)) || [];
              const count = await storageManagerService.cleanDuplicates(allDupIds);
              await loadStorage();
              Alert.alert('Duplicates Cleaned', `Successfully unindexed ${count} duplicate screenshot records.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clean duplicates.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleQuickClean = () => {
    const totalDups = duplicateResult?.totalDuplicates || 0;
    Alert.alert(
      'Quick Clean (Recommended)',
      `Execute safe non-destructive storage optimization?\n\n• Prune completed background scanner tasks\n• Purge OCR text caches\n• Flush preview thumbnail memory\n• Defragment SQLite database\n${
        totalDups > 0 ? `• Clean ${totalDups} duplicate screenshot records\n` : ''
      }\nOriginal device photos are never deleted or modified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Optimize Now',
          onPress: async () => {
            setActionInProgress('quick_clean');
            try {
              const allDupIds =
                duplicateResult?.groups.flatMap((g) => g.duplicates.map((d) => d.id)) || [];
              const res = await storageManagerService.executeQuickClean(allDupIds);
              await loadStorage();
              Alert.alert(
                'Storage Optimized',
                `Optimization complete!\n• Duplicates cleaned: ${res.duplicatesCleaned}\n• Caches purged\n• SQLite database defragmented.`
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to execute quick clean.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleExecuteRecommendation = (rec: CleanupRecommendation) => {
    switch (rec.type) {
      case 'duplicates':
        handleCleanAllDuplicates();
        break;
      case 'ocr_cache':
        handleClearOCR();
        break;
      case 'database_vacuum':
        handleVacuum();
        break;
      case 'pending_queue':
        (async () => {
          setActionInProgress('pending');
          try {
            await storageManagerService.clearCompletedPending();
            await loadStorage();
            Alert.alert('Queue Cleaned', 'Completed scanner queue tasks removed.');
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to clean queue.');
          } finally {
            setActionInProgress(null);
          }
        })();
        break;
      case 'search_cache':
        handleClearSearch();
        break;
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Caches & Defragment',
      'This will purge all temporary OCR caches, search history, completed queue items, and defragment the SQLite database. Screenshots and folders will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge & Defragment',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress('all');
            try {
              await storageManagerService.clearAllCaches();
              await loadStorage();
              Alert.alert('Success', 'All caches purged and SQLite database optimized.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear caches.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const total = breakdown?.totalBytes || 1;
  const dbPct = Math.max(5, Math.round(((breakdown?.databaseSizeBytes || 0) / total) * 100));
  const ocrPct = Math.max(2, Math.round(((breakdown?.ocrCacheBytes || 0) / total) * 100));
  const searchPct = Math.max(1, Math.round(((breakdown?.searchCacheBytes || 0) / total) * 100));
  const chatPct = Math.max(1, Math.round(((breakdown?.chatHistoryBytes || 0) / total) * 100));

  const categorizedPct =
    (breakdown?.screenshotRecordCount || 0) > 0
      ? Math.round(
          ((breakdown?.categorizedCount || 0) / (breakdown?.screenshotRecordCount || 1)) * 100
        )
      : 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go Back"
        >
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Storage Manager
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Screenshot counts, deduplication & cache optimization
          </Text>
        </View>
        <TouchableOpacity
          onPress={loadStorage}
          style={styles.refreshBtn}
          accessibilityRole="button"
          accessibilityLabel="Refresh Storage Stats"
        >
          <Icon name="refresh-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Analyzing vault storage & duplicates...
            </Text>
          </View>
        ) : (
          <>
            {/* 1. Screenshot Vault Breakdown Card */}
            <ModernCard style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.itemTitleRow}>
                  <Icon name="images-outline" size={20} color={theme.colors.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Screenshot Vault Metrics
                  </Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: `${theme.colors.primary}15` }]}>
                  <Text style={[styles.badgePillText, { color: theme.colors.primary }]}>
                    {breakdown?.screenshotRecordCount || 0} Total
                  </Text>
                </View>
              </View>

              <View style={styles.metricsGrid}>
                {/* Categorized */}
                <View style={[styles.metricBox, { backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC' }]}>
                  <View style={styles.metricHeaderRow}>
                    <Icon name="folder-outline" size={16} color="#10B981" />
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                      Organized
                    </Text>
                  </View>
                  <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                    {breakdown?.categorizedCount || 0}
                  </Text>
                  <Text style={[styles.metricSub, { color: '#10B981' }]}>
                    {categorizedPct}% in smart folders
                  </Text>
                </View>

                {/* Unsorted */}
                <View style={[styles.metricBox, { backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC' }]}>
                  <View style={styles.metricHeaderRow}>
                    <Icon name="file-tray-outline" size={16} color="#F59E0B" />
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                      Unsorted
                    </Text>
                  </View>
                  <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                    {breakdown?.unsortedCount || 0}
                  </Text>
                  <Text style={[styles.metricSub, { color: theme.colors.textMuted }]}>
                    Awaiting organization
                  </Text>
                </View>

                {/* Favorites */}
                <View style={[styles.metricBox, { backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC' }]}>
                  <View style={styles.metricHeaderRow}>
                    <Icon name="star-outline" size={16} color="#EAB308" />
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                      Favorites
                    </Text>
                  </View>
                  <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                    {breakdown?.favoritesCount || 0}
                  </Text>
                  <Text style={[styles.metricSub, { color: theme.colors.textMuted }]}>
                    Starred screenshots
                  </Text>
                </View>

                {/* Needs Review */}
                <View style={[styles.metricBox, { backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC' }]}>
                  <View style={styles.metricHeaderRow}>
                    <Icon name="alert-circle-outline" size={16} color="#EF4444" />
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                      Needs Review
                    </Text>
                  </View>
                  <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                    {breakdown?.needsReviewCount || 0}
                  </Text>
                  <Text style={[styles.metricSub, { color: theme.colors.textMuted }]}>
                    Low confidence / review
                  </Text>
                </View>
              </View>

              {/* Device Footprint Banner */}
              <View
                style={[
                  styles.deviceFootprintRow,
                  {
                    backgroundColor: theme.isDark ? '#131B2E' : '#EFF6FF',
                    borderColor: `${theme.colors.primary}30`,
                  },
                ]}
              >
                <Icon name="phone-portrait-outline" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.deviceFootprintTitle, { color: theme.colors.textPrimary }]}>
                    Device Media Storage Footprint
                  </Text>
                  <Text style={[styles.deviceFootprintSubtitle, { color: theme.colors.textSecondary }]}>
                    Total size of original screenshot photos indexed on this device
                  </Text>
                </View>
                <Text style={[styles.deviceFootprintValue, { color: theme.colors.primary }]}>
                  {storageManagerService.formatBytes(breakdown?.totalDeviceScreenshotBytes || 0)}
                </Text>
              </View>
            </ModernCard>

            {/* 2. Storage Distribution Summary Card */}
            <ModernCard style={styles.card}>
              <View style={styles.totalRow}>
                <View>
                  <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>
                    ContextVault Internal Storage
                  </Text>
                  <Text style={[styles.totalValue, { color: theme.colors.textPrimary }]}>
                    {storageManagerService.formatBytes(breakdown?.totalBytes || 0)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${theme.colors.primary}18` }]}>
                  <Icon name="pie-chart-outline" size={22} color={theme.colors.primary} />
                </View>
              </View>

              {/* Segmented Progress Bar */}
              <View style={styles.barContainer}>
                <View style={[styles.barSegment, { width: `${dbPct}%`, backgroundColor: '#3B82F6' }]} />
                <View style={[styles.barSegment, { width: `${ocrPct}%`, backgroundColor: '#06B6D4' }]} />
                <View style={[styles.barSegment, { width: `${searchPct}%`, backgroundColor: '#10B981' }]} />
                <View style={[styles.barSegment, { width: `${chatPct}%`, backgroundColor: '#8B5CF6' }]} />
              </View>

              {/* Legend */}
              <View style={styles.legendGrid}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                    Database ({storageManagerService.formatBytes(breakdown?.databaseSizeBytes || 0)})
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: '#06B6D4' }]} />
                  <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                    OCR Cache ({storageManagerService.formatBytes(breakdown?.ocrCacheBytes || 0)})
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                    Search ({storageManagerService.formatBytes(breakdown?.searchCacheBytes || 0)})
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                    Chat ({storageManagerService.formatBytes(breakdown?.chatHistoryBytes || 0)})
                  </Text>
                </View>
              </View>
            </ModernCard>

            {/* 3. Cleanup Recommendations Card */}
            <ModernCard style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.itemTitleRow}>
                  <Icon name="sparkles-outline" size={20} color="#F59E0B" />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Cleanup Recommendations
                  </Text>
                </View>
                {recommendations.length > 0 && (
                  <TouchableOpacity
                    style={[styles.quickCleanTopBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={handleQuickClean}
                    disabled={actionInProgress !== null}
                  >
                    {actionInProgress === 'quick_clean' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="flash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.quickCleanTopBtnText}>Quick Clean</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {recommendations.length === 0 ? (
                <View style={styles.emptyRecommendationsBox}>
                  <Icon name="checkmark-circle-outline" size={32} color="#10B981" />
                  <Text style={[styles.emptyRecommendationsTitle, { color: theme.colors.textPrimary }]}>
                    Storage Fully Optimized
                  </Text>
                  <Text style={[styles.emptyRecommendationsText, { color: theme.colors.textSecondary }]}>
                    No immediate cleanup actions required. Your database and caches are in optimal condition.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 4 }}>
                  {recommendations.map((rec) => {
                    const isBusy = actionInProgress === rec.id;
                    const severityColor =
                      rec.severity === 'high' ? '#EF4444' : rec.severity === 'medium' ? '#F59E0B' : '#3B82F6';
                    return (
                      <View
                        key={rec.id}
                        style={[
                          styles.recItemBox,
                          {
                            backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <View style={styles.recHeaderRow}>
                          <View style={[styles.severityBadge, { backgroundColor: `${severityColor}20` }]}>
                            <Text style={[styles.severityBadgeText, { color: severityColor }]}>
                              {rec.severity.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.savingsBadge, { color: '#10B981' }]}>
                            {rec.savingsLabel}
                          </Text>
                        </View>
                        <Text style={[styles.recTitle, { color: theme.colors.textPrimary }]}>
                          {rec.title}
                        </Text>
                        <Text style={[styles.recDesc, { color: theme.colors.textSecondary }]}>
                          {rec.description}
                        </Text>
                        <TouchableOpacity
                          style={[styles.recActionBtn, { borderColor: theme.colors.primary }]}
                          onPress={() => handleExecuteRecommendation(rec)}
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.recActionBtnText, { color: theme.colors.primary }]}>
                              {rec.actionLabel}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ModernCard>

            {/* 4. Duplicate Detection Card */}
            <ModernCard style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.itemTitleRow}>
                  <Icon name="copy-outline" size={20} color="#8B5CF6" />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Duplicate Detection
                  </Text>
                </View>
                <View
                  style={[
                    styles.badgePill,
                    {
                      backgroundColor:
                        (duplicateResult?.totalDuplicates || 0) > 0 ? '#EF444420' : '#10B98120',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgePillText,
                      {
                        color: (duplicateResult?.totalDuplicates || 0) > 0 ? '#EF4444' : '#10B981',
                      },
                    ]}
                  >
                    {duplicateResult?.totalDuplicates || 0} Duplicates
                  </Text>
                </View>
              </View>

              {(!duplicateResult || duplicateResult.totalDuplicates === 0) ? (
                <View style={styles.emptyDuplicatesBox}>
                  <Icon name="shield-checkmark-outline" size={32} color="#10B981" />
                  <Text style={[styles.emptyRecommendationsTitle, { color: theme.colors.textPrimary }]}>
                    No Duplicate Screenshots Detected
                  </Text>
                  <Text style={[styles.emptyRecommendationsText, { color: theme.colors.textSecondary }]}>
                    Every screenshot in your vault has unique dimensions, file contents, and OCR fingerprints.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.duplicateSummaryRow}>
                    <Text style={[styles.duplicateSummaryText, { color: theme.colors.textSecondary }]}>
                      Found {duplicateResult.totalDuplicates} duplicate records across {duplicateResult.groups.length} groups consuming ~{storageManagerService.formatBytes(duplicateResult.reclaimableBytes)}.
                    </Text>
                    <TouchableOpacity
                      style={[styles.cleanAllDupsBtn, { backgroundColor: '#EF4444' }]}
                      onPress={handleCleanAllDuplicates}
                      disabled={actionInProgress !== null}
                    >
                      {actionInProgress === 'clean_all_duplicates' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Icon name="trash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.cleanAllDupsBtnText}>Clean All</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Duplicate Groups List */}
                  <View style={{ gap: 12, marginTop: 8 }}>
                    {duplicateResult.groups.map((group) => {
                      const isExpanded = expandedDuplicateGroupId === group.id;
                      return (
                        <View
                          key={group.id}
                          style={[
                            styles.dupGroupBox,
                            {
                              backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.dupGroupHeader}
                            onPress={() =>
                              setExpandedDuplicateGroupId(isExpanded ? null : group.id)
                            }
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.dupReasonRow}>
                                <View style={[styles.reasonBadge, { backgroundColor: '#8B5CF620' }]}>
                                  <Text style={styles.reasonBadgeText}>{group.matchReason}</Text>
                                </View>
                                <Text style={[styles.dupGroupCountText, { color: theme.colors.textSecondary }]}>
                                  1 original + {group.duplicates.length} duplicate{group.duplicates.length > 1 ? 's' : ''}
                                </Text>
                              </View>
                              <Text style={[styles.dupOriginalName, { color: theme.colors.textPrimary }]}>
                                {group.original.fileName}
                              </Text>
                            </View>
                            <Icon
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color={theme.colors.textSecondary}
                            />
                          </TouchableOpacity>

                          {/* Preview Thumbnails Strip */}
                          <View style={styles.dupPreviewStrip}>
                            <View style={styles.dupThumbnailWrapper}>
                              <ScreenshotImageThumbnail
                                filePath={group.original.filePath}
                                style={styles.dupThumb}
                                borderRadius={8}
                              />
                              <View style={styles.originalTag}>
                                <Text style={styles.originalTagText}>Original</Text>
                              </View>
                            </View>
                            {group.duplicates.map((dup) => (
                              <View key={dup.id} style={styles.dupThumbnailWrapper}>
                                <ScreenshotImageThumbnail
                                  filePath={dup.filePath}
                                  style={styles.dupThumb}
                                  borderRadius={8}
                                />
                                <View style={styles.duplicateTag}>
                                  <Text style={styles.duplicateTagText}>Duplicate</Text>
                                </View>
                              </View>
                            ))}
                          </View>

                          {/* Expanded Detail View */}
                          {isExpanded && (
                            <View style={styles.expandedDetailBox}>
                              <Text style={[styles.expandedDetailTitle, { color: theme.colors.textSecondary }]}>
                                Duplicate Items to Remove:
                              </Text>
                              {group.duplicates.map((dup) => (
                                <View
                                  key={dup.id}
                                  style={[
                                    styles.dupDetailRow,
                                    { borderTopColor: theme.colors.border },
                                  ]}
                                >
                                  <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text
                                      style={[styles.dupDetailName, { color: theme.colors.textPrimary }]}
                                      numberOfLines={1}
                                    >
                                      {dup.fileName}
                                    </Text>
                                    <Text style={[styles.dupDetailMeta, { color: theme.colors.textMuted }]}>
                                      {storageManagerService.formatBytes(dup.fileSize || 0)} • {dup.categoryName || 'Unsorted'}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={[styles.singleDupRemoveBtn, { borderColor: '#EF4444' }]}
                                    onPress={() => handleCleanSingleDuplicate(dup.id)}
                                    disabled={actionInProgress === `dup_${dup.id}`}
                                  >
                                    {actionInProgress === `dup_${dup.id}` ? (
                                      <ActivityIndicator size="small" color="#EF4444" />
                                    ) : (
                                      <Text style={styles.singleDupRemoveBtnText}>Remove</Text>
                                    )}
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </ModernCard>

            {/* 5. Itemized Cache & Storage Components */}
            <ModernCard style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.itemTitleRow}>
                  <Icon name="layers-outline" size={20} color={theme.colors.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Component Storage Footprint
                  </Text>
                </View>
              </View>

              {/* 5.1 SQLite Database */}
              <View style={styles.componentItem}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Icon name="server-outline" size={18} color="#3B82F6" />
                    <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>
                      SQLite Database
                    </Text>
                  </View>
                  <Text style={[styles.itemSize, { color: theme.colors.textPrimary }]}>
                    {storageManagerService.formatBytes(breakdown?.databaseSizeBytes || 0)}
                  </Text>
                </View>
                <Text style={[styles.itemDesc, { color: theme.colors.textSecondary }]}>
                  Stores metadata for {breakdown?.screenshotRecordCount || 0} indexed screenshots, folder hierarchies, and entity graphs.
                </Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#3B82F6' }]}
                  onPress={handleVacuum}
                  disabled={actionInProgress === 'vacuum'}
                >
                  {actionInProgress === 'vacuum' ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <>
                      <Icon name="hardware-chip-outline" size={16} color="#3B82F6" style={{ marginRight: 6 }} />
                      <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Defragment Database (VACUUM)</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              {/* 5.2 OCR Text Cache */}
              <View style={styles.componentItem}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Icon name="document-text-outline" size={18} color="#06B6D4" />
                    <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>
                      OCR Text Cache
                    </Text>
                  </View>
                  <Text style={[styles.itemSize, { color: theme.colors.textPrimary }]}>
                    {storageManagerService.formatBytes(breakdown?.ocrCacheBytes || 0)}
                  </Text>
                </View>
                <Text style={[styles.itemDesc, { color: theme.colors.textSecondary }]}>
                  {breakdown?.ocrCacheCount || 0} cached OCR text recognition results and layout bounding blocks.
                </Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#06B6D4' }]}
                  onPress={handleClearOCR}
                  disabled={actionInProgress === 'ocr'}
                >
                  {actionInProgress === 'ocr' ? (
                    <ActivityIndicator size="small" color="#06B6D4" />
                  ) : (
                    <>
                      <Icon name="trash-outline" size={16} color="#06B6D4" style={{ marginRight: 6 }} />
                      <Text style={[styles.actionBtnText, { color: '#06B6D4' }]}>Clear OCR Cache</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              {/* 5.3 Search Cache */}
              <View style={styles.componentItem}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Icon name="search-outline" size={18} color="#10B981" />
                    <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>
                      Search History & Cache
                    </Text>
                  </View>
                  <Text style={[styles.itemSize, { color: theme.colors.textPrimary }]}>
                    {storageManagerService.formatBytes(breakdown?.searchCacheBytes || 0)}
                  </Text>
                </View>
                <Text style={[styles.itemDesc, { color: theme.colors.textSecondary }]}>
                  {breakdown?.searchCacheCount || 0} recent and saved search queries.
                </Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#10B981' }]}
                  onPress={handleClearSearch}
                  disabled={actionInProgress === 'search'}
                >
                  {actionInProgress === 'search' ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <>
                      <Icon name="backspace-outline" size={16} color="#10B981" style={{ marginRight: 6 }} />
                      <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Clear Search History</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              {/* 5.4 Chat History */}
              <View style={styles.componentItem}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Icon name="chatbubbles-outline" size={18} color="#8B5CF6" />
                    <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>
                      Context AI Chat Messages
                    </Text>
                  </View>
                  <Text style={[styles.itemSize, { color: theme.colors.textPrimary }]}>
                    {storageManagerService.formatBytes(breakdown?.chatHistoryBytes || 0)}
                  </Text>
                </View>
                <Text style={[styles.itemDesc, { color: theme.colors.textSecondary }]}>
                  {breakdown?.chatHistoryCount || 0} conversation messages and AI reasoning history.
                </Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#8B5CF6' }]}
                  onPress={handleClearChat}
                  disabled={actionInProgress === 'chat'}
                >
                  {actionInProgress === 'chat' ? (
                    <ActivityIndicator size="small" color="#8B5CF6" />
                  ) : (
                    <>
                      <Icon name="chatbubble-ellipses-outline" size={16} color="#8B5CF6" style={{ marginRight: 6 }} />
                      <Text style={[styles.actionBtnText, { color: '#8B5CF6' }]}>Clear Chat History</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              {/* 5.5 In-Memory Thumbnail Cache */}
              <View style={styles.componentItem}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Icon name="image-outline" size={18} color="#F59E0B" />
                    <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>
                      Thumbnail Memory Cache
                    </Text>
                  </View>
                  <Text style={[styles.itemSize, { color: theme.colors.textPrimary }]}>
                    {storageManagerService.formatBytes(breakdown?.memoryThumbnailBytes || 0)}
                  </Text>
                </View>
                <Text style={[styles.itemDesc, { color: theme.colors.textSecondary }]}>
                  Active in-memory bitmap cache for smooth screenshot gallery scrolling.
                </Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#F59E0B' }]}
                  onPress={handleClearMemory}
                >
                  <Icon name="sparkles-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={[styles.actionBtnText, { color: '#F59E0B' }]}>Flush Memory Cache</Text>
                </TouchableOpacity>
              </View>
            </ModernCard>

            {/* 6. Recycle Bin Card */}
            <ModernCard style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.itemTitleRow}>
                  <Icon name="trash-bin-outline" size={20} color={theme.colors.error} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Recycle Bin
                  </Text>
                </View>
              </View>
              <Text style={[styles.itemDesc, { color: theme.colors.textSecondary }]}>
                Soft-deleted screenshots are safely preserved in the Recycle Bin before permanent deletion.
              </Text>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: theme.colors.error }]}
                onPress={() => navigation.navigate('RecycleBin')}
              >
                <Icon name="trash-bin-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>
                  Open Recycle Bin
                </Text>
              </TouchableOpacity>
            </ModernCard>

            {/* Master Purge Button */}
            <TouchableOpacity
              style={[styles.purgeBtn, { borderColor: theme.colors.error }]}
              onPress={handleClearAll}
              disabled={actionInProgress === 'all'}
            >
              {actionInProgress === 'all' ? (
                <ActivityIndicator size="small" color={theme.colors.error} />
              ) : (
                <>
                  <Icon name="flame-outline" size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
                  <Text style={[styles.purgeBtnText, { color: theme.colors.error }]}>
                    Clear All Caches & Defragment Database
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Privacy & Non-Destructive Guarantee */}
            <View
              style={[
                styles.guaranteeBox,
                { backgroundColor: `${theme.colors.success}12`, borderColor: `${theme.colors.success}30` },
              ]}
            >
              <Icon name="shield-checkmark" size={24} color={theme.colors.success} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.guaranteeTitle, { color: theme.colors.success }]}>
                  Non-Destructive Intelligence Guarantee
                </Text>
                <Text style={[styles.guaranteeText, { color: theme.colors.textSecondary }]}>
                  ContextVault never moves, edits, or deletes original screenshot photos in your device's media gallery. All clearing and duplicate management actions only affect internal metadata indexes and temporary caches.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  refreshBtn: {
    padding: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  card: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    minWidth: '46%',
    padding: 12,
    borderRadius: 10,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  deviceFootprintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deviceFootprintTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  deviceFootprintSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  deviceFootprintValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barContainer: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#E2E8F030',
    marginBottom: 14,
  },
  barSegment: {
    height: '100%',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
  quickCleanTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickCleanTopBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyRecommendationsBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecommendationsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyRecommendationsText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  recItemBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  recHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  savingsBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  recTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  recDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  recActionBtn: {
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyDuplicatesBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  duplicateSummaryText: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
    lineHeight: 16,
  },
  cleanAllDupsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cleanAllDupsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dupGroupBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  dupGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dupReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reasonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  reasonBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  dupGroupCountText: {
    fontSize: 11,
  },
  dupOriginalName: {
    fontSize: 13,
    fontWeight: '700',
  },
  dupPreviewStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  dupThumbnailWrapper: {
    position: 'relative',
    width: 60,
    height: 80,
  },
  dupThumb: {
    width: 60,
    height: 80,
    borderRadius: 8,
  },
  originalTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#10B981DD',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  originalTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  duplicateTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#EF4444DD',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  duplicateTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  expandedDetailBox: {
    marginTop: 12,
    paddingTop: 8,
  },
  expandedDetailTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  dupDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  dupDetailName: {
    fontSize: 12,
    fontWeight: '600',
  },
  dupDetailMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  singleDupRemoveBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  singleDupRemoveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  componentItem: {
    paddingVertical: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  itemSize: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  actionBtn: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  purgeBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: '#EF444410',
  },
  purgeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  guaranteeBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  guaranteeText: {
    fontSize: 12,
    lineHeight: 16,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import { mediaStoreService, ScanResult } from '../services/mediaStoreService';
import { thumbnailService, ThumbnailCacheStats } from '../services/ThumbnailService';
import { screenshotRepository } from '../database/repositories';
import { visionRepository } from '../database/repositories/VisionRepository';
import { visionAIService, PingResult as VisionPingResult } from '../services/visionAIService';
import { visionInferenceQueue } from '../vision/VisionInferenceQueue';
import { useVisionStore } from '../store/vision.store';
import { useScreenshotStore } from '../store/screenshot.store';
import { FileUtils } from '../utils/fileUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'ScreenshotDiagnostics'>;

export const ScreenshotDiagnosticsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const [sqliteCount, setSqliteCount] = useState<number>(0);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [cacheStats, setCacheStats] = useState<ThumbnailCacheStats>({
    inMemoryCount: 0,
    dbCount: 0,
    totalSizeBytes: 0,
  });

  const [missingContentUriCount, setMissingContentUriCount] = useState<number>(0);
  const [folderCounts, setFolderCounts] = useState<{ [folder: string]: number }>({});
  const [visionStats, setVisionStats] = useState<{ totalCount: number; todayCount: number }>({
    totalCount: 0,
    todayCount: 0,
  });
  const [visionHealth, setVisionHealth] = useState<VisionPingResult | null>(null);
  const [pingingVision, setPingingVision] = useState(false);

  const queueLength = useVisionStore((s) => s.queueLength);
  const failedToday = useVisionStore((s) => s.failedToday);
  const allScreenshots = useScreenshotStore((s) => s.screenshots);

  const loadDiagnostics = useCallback(async () => {
    try {
      const [count, stats, vStats] = await Promise.all([
        screenshotRepository.countScreenshots(),
        thumbnailService.getCacheStats(),
        visionRepository.getStats().catch(() => ({ totalCount: 0, todayCount: 0 })),
      ]);

      setSqliteCount(count);
      setCacheStats(stats);
      setVisionStats(vStats);

      // Analyze in-memory store screenshots
      let missingUri = 0;
      const folders: { [key: string]: number } = {};

      allScreenshots.forEach((s) => {
        if (!s.contentUri && !s.deviceAssetId) {
          missingUri++;
        }
        const fName = s.categoryName || 'Unsorted';
        folders[fName] = (folders[fName] || 0) + 1;
      });

      setMissingContentUriCount(missingUri);
      setFolderCounts(folders);
    } catch (err) {
      console.warn('[ScreenshotDiagnostics] Error loading stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allScreenshots]);

  const handlePingVisionServer = async () => {
    setPingingVision(true);
    try {
      const res = await visionAIService.pingVisionServer();
      setVisionHealth(res);
      Alert.alert(
        res.online ? 'Vision Server Online' : 'Vision Server Offline',
        res.online
          ? `Connected to Vision Server!\nModel: ${res.model || 'Qwen2.5-VL-3B-Instruct'}\nGPU: ${res.gpu || 'RTX 4050'}\nLatency: ${res.latencyMs} ms`
          : `Failed to reach Vision Server:\n${res.error || 'Server unreachable'}`
      );
    } catch (e: any) {
      Alert.alert('Vision Server Offline', e?.message || 'Check network connection.');
    } finally {
      setPingingVision(false);
    }
  };

  const handleRetryFailedQueue = async () => {
    try {
      const count = await visionInferenceQueue.enqueuePending();
      Alert.alert('Queue Enqueued', `Added ${count} un-analyzed screenshot(s) to processing queue.`);
      await loadDiagnostics();
    } catch (e: any) {
      Alert.alert('Queue Error', e?.message || 'Could not queue screenshots.');
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleScanMediaStore = async () => {
    setActionInProgress('scan');
    try {
      const result = await mediaStoreService.scanAndSyncScreenshots();
      setLastScanResult(result);
      await useScreenshotStore.getState().loadScreenshots();
      await loadDiagnostics();
      Alert.alert(
        'MediaStore Scan Complete',
        `Scanned: ${result.totalScanned}\nAdded: ${result.added}\nSkipped: ${result.skipped}\nErrors: ${result.errors}`
      );
    } catch (err: any) {
      Alert.alert('Scan Failed', err?.message || 'Failed to scan MediaStore.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRebuildThumbnailCache = async () => {
    setActionInProgress('rebuild');
    try {
      await thumbnailService.clearCache();
      let generated = 0;

      for (const s of allScreenshots.slice(0, 50)) {
        const uri = s.contentUri || s.filePath || s.localPath;
        if (uri) {
          await thumbnailService.getOrCreateThumbnail(uri, 300, s.id, (s as any).fileHash);
          generated++;
        }
      }

      await loadDiagnostics();
      Alert.alert('Cache Rebuilt', `Pre-generated thumbnails for ${generated} screenshots.`);
    } catch (err: any) {
      Alert.alert('Rebuild Failed', err?.message || 'Failed to rebuild cache.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePurgeCache = async () => {
    Alert.alert(
      'Clear Thumbnail Cache',
      'This will delete all cached thumbnails from disk and memory. Thumbnails will re-generate on demand.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress('purge');
            try {
              await thumbnailService.clearCache();
              await loadDiagnostics();
              Alert.alert('Cache Cleared', 'Thumbnail cache is now empty.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear cache.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.colors.card }]}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Screenshot Diagnostics
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Rendering engine, MediaStore & cache health
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Analyzing storage and rendering pipeline...
            </Text>
          </View>
        ) : (
          <>
            {/* Overview Stats */}
            <View style={styles.statsGrid}>
              <ModernCard style={styles.statCard}>
                <Icon name="images" size={24} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                  {sqliteCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  SQLite Screenshots
                </Text>
              </ModernCard>

              <ModernCard style={styles.statCard}>
                <Icon name="albums" size={24} color="#10B981" />
                <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                  {allScreenshots.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Loaded in Memory
                </Text>
              </ModernCard>

              <ModernCard style={styles.statCard}>
                <Icon name="cube" size={24} color="#8B5CF6" />
                <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                  {cacheStats.dbCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Cached Thumbnails
                </Text>
              </ModernCard>

              <ModernCard style={styles.statCard}>
                <Icon
                  name={missingContentUriCount === 0 ? 'checkmark-circle' : 'warning'}
                  size={24}
                  color={missingContentUriCount === 0 ? '#10B981' : '#F59E0B'}
                />
                <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                  {missingContentUriCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Legacy File Paths
                </Text>
              </ModernCard>
            </View>

            {/* Thumbnail Cache Card */}
            <ModernCard style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="file-tray-stacked" size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Thumbnail Cache
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  In-Memory Cache
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {cacheStats.inMemoryCount} items
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  SQLite Thumbnails
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {cacheStats.dbCount} items
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  Estimated Storage
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {FileUtils.formatBytes(cacheStats.totalSizeBytes)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  Native Hardware Decoder
                </Text>
                <Text style={[styles.infoValue, { color: '#10B981' }]}>
                  Active (RGB_565)
                </Text>
              </View>
            </ModernCard>

            {/* Local Vision AI Server Diagnostics (Sprint P1-B) */}
            <ModernCard style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="sparkles" size={20} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Local Vision AI Server (RTX 4050)
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  Gateway Connection
                </Text>
                <Text style={[styles.infoValue, { color: visionHealth?.online ? '#10B981' : theme.colors.textMuted }]}>
                  {visionHealth ? (visionHealth.online ? 'Online (Healthy)' : visionHealth.error || 'Offline') : 'Ready to Ping'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  Active Model
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {visionHealth?.model || 'Qwen2.5-VL-3B-Instruct'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  GPU Hardware
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {visionHealth?.gpu || 'NVIDIA GeForce RTX 4050 (6 GB)'}
                </Text>
              </View>

              {visionHealth?.latencyMs !== undefined && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                    Gateway Ping Latency
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                    {visionHealth.latencyMs} ms
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  SQLite Cached Analyses
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {visionStats.totalCount} ({visionStats.todayCount} today)
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  Inference Queue (Concurrency=1)
                </Text>
                <Text style={[styles.infoValue, { color: queueLength > 0 ? '#F59E0B' : theme.colors.textPrimary }]}>
                  {queueLength} pending
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  Failed Today
                </Text>
                <Text style={[styles.infoValue, { color: failedToday > 0 ? '#EF4444' : theme.colors.textSecondary }]}>
                  {failedToday}
                </Text>
              </View>

              {/* Vision Action Buttons */}
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                <TouchableOpacity
                  onPress={handlePingVisionServer}
                  disabled={pingingVision}
                  style={[styles.actionBtn, { backgroundColor: '#8B5CF6', flex: 1 }]}
                >
                  <Icon name="pulse-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionBtnText}>
                    {pingingVision ? 'Pinging...' : 'Ping Server'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleRetryFailedQueue}
                  style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: '#8B5CF6', flex: 1 }]}
                >
                  <Icon name="refresh-outline" size={16} color="#8B5CF6" style={{ marginRight: 6 }} />
                  <Text style={[styles.actionBtnText, { color: '#8B5CF6' }]}>Queue Un-analyzed</Text>
                </TouchableOpacity>
              </View>
            </ModernCard>

            {/* Last MediaStore Scan Card */}
            {lastScanResult && (
              <ModernCard style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="pulse" size={20} color="#10B981" />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Last MediaStore Scan
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                    Total Media Scanned
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                    {lastScanResult.totalScanned}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                    New Added
                  </Text>
                  <Text style={[styles.infoValue, { color: '#10B981' }]}>
                    +{lastScanResult.added}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                    Already Synced
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                    {lastScanResult.skipped}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                    Errors Encountered
                  </Text>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: lastScanResult.errors > 0 ? '#EF4444' : '#10B981' },
                    ]}
                  >
                    {lastScanResult.errors}
                  </Text>
                </View>
              </ModernCard>
            )}

            {/* Folder Mappings Card */}
            <ModernCard style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="folder-open" size={20} color="#F59E0B" />
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Folder Mappings
                </Text>
              </View>

              {Object.keys(folderCounts).length === 0 ? (
                <Text style={[styles.emptyFolderText, { color: theme.colors.textSecondary }]}>
                  No categorized screenshots yet.
                </Text>
              ) : (
                Object.entries(folderCounts).map(([folder, cnt]) => (
                  <View key={folder} style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textPrimary }]}>
                      {folder}
                    </Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textSecondary }]}>
                      {cnt} screenshots
                    </Text>
                  </View>
                ))
              )}
            </ModernCard>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                onPress={handleScanMediaStore}
                disabled={actionInProgress !== null}
                style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
              >
                {actionInProgress === 'scan' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="scan-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryActionBtnText}>Scan MediaStore</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRebuildThumbnailCache}
                disabled={actionInProgress !== null}
                style={[
                  styles.secondaryActionBtn,
                  { backgroundColor: `${theme.colors.primary}18`, borderColor: `${theme.colors.primary}40` },
                ]}
              >
                {actionInProgress === 'rebuild' ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Icon name="refresh" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.secondaryActionBtnText, { color: theme.colors.primary }]}>
                      Rebuild Thumbnail Cache
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePurgeCache}
                disabled={actionInProgress !== null}
                style={[styles.dangerActionBtn, { borderColor: '#EF444440' }]}
              >
                {actionInProgress === 'purge' ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Icon name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                    <Text style={styles.dangerActionBtnText}>Purge Thumbnail Cache</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyFolderText: {
    fontSize: 12,
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  actionButtonsContainer: {
    marginTop: 8,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  secondaryActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  dangerActionBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

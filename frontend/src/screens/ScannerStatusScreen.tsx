import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScannerStore } from '../store/scanner.store';
import { ModernCard } from '../components/ModernCard';
import { PendingScreenshot } from '../models';
import { pendingScreenshotRepository } from '../database/repositories/pendingScreenshotRepository';
import { permissionService } from '../services/permissionService';
import { FileUtils } from '../utils/fileUtils';
import { databaseService } from '../database';

export const ScannerStatusScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Sprint RN-03 / RN-04 Store Selectors
  const isListening = useScannerStore((s) => s.isListening);
  const scannedToday = useScannerStore((s) => s.scannedToday);
  const pendingProcessing = useScannerStore((s) => s.pendingProcessing);
  const lastScreenshot = useScannerStore((s) => s.lastScreenshot);
  const permissionStatus = useScannerStore((s) => s.permissionStatus);
  const currentProcessingItem = useScannerStore((s) => s.currentProcessingItem);
  const lastOCRResult = useScannerStore((s) => s.lastOCRResult);
  const ocrCompletedToday = useScannerStore((s) => s.ocrCompletedToday);
  const ocrPending = useScannerStore((s) => s.ocrPending);
  const ocrFailed = useScannerStore((s) => s.ocrFailed);
  const avgProcessingTimeMs = useScannerStore((s) => s.avgProcessingTimeMs);

  const startScanner = useScannerStore((s) => s.startScanner);
  const stopScanner = useScannerStore((s) => s.stopScanner);
  const requestPermissions = useScannerStore((s) => s.requestPermissions);
  const checkPermissions = useScannerStore((s) => s.checkPermissions);
  const retryFailedOCR = useScannerStore((s) => s.retryFailedOCR);
  const retrySingleOCR = useScannerStore((s) => s.retrySingleOCR);
  const simulateScreenshot = useScannerStore((s) => s.simulateScreenshot);

  const [recentScreenshots, setRecentScreenshots] = useState<PendingScreenshot[]>([]);
  const [failedList, setFailedList] = useState<PendingScreenshot[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const [items, failedItems] = await Promise.all([
        pendingScreenshotRepository.getRecent(20),
        pendingScreenshotRepository.getFailedScreenshots(),
      ]);
      setRecentScreenshots(items);
      setFailedList(failedItems);

      // If store doesn't have last Vision result yet, try reading from DB
      if (!lastOCRResult) {
        try {
          const recentCache = await databaseService.executeQuery(
            'SELECT * FROM vision_cache ORDER BY processed_at DESC LIMIT 1;'
          );
          if (recentCache.length > 0) {
            const rec = recentCache[0];
            useScannerStore.getState().setLastOCRResult({
              screenshotId: rec.screenshot_id,
              fileName: rec.application_name || 'Cached Screenshot',
              rawText: rec.summary || '',
              confidence: rec.confidence || 0.95,
              processingTimeMs: 850,
              language: 'en',
              blocksCount: 1,
              processedAt: rec.processed_at,
            });
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[ScannerStatusScreen] Error loading feed:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [lastOCRResult]);

  useEffect(() => {
    checkPermissions();
    loadFeed();
  }, [checkPermissions, loadFeed]);

  // Refresh feed whenever a new screenshot or OCR completes
  useEffect(() => {
    if (lastScreenshot || lastOCRResult) {
      loadFeed();
    }
  }, [lastScreenshot, lastOCRResult, loadFeed]);

  const handleToggleScanner = async () => {
    if (isListening) {
      await stopScanner();
    } else {
      const started = await startScanner();
      if (!started && permissionStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Media permission is required to detect screenshots automatically.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Grant Permission', onPress: () => requestPermissions() },
          ]
        );
      }
    }
  };

  const handleRetryAllFailed = async () => {
    if (failedList.length === 0) {
      Alert.alert('No Failed Items', 'There are no failed OCR operations.');
      return;
    }
    setIsRetrying(true);
    try {
      await retryFailedOCR();
      await loadFeed();
      Alert.alert('Retrying', `Re-queued ${failedList.length} failed screenshots for OCR.`);
    } catch (err: any) {
      Alert.alert('Retry Error', err?.message || 'Failed to retry items.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetrySingle = async (id: string) => {
    try {
      await retrySingleOCR(id);
      await loadFeed();
    } catch (err: any) {
      Alert.alert('Retry Error', err?.message || 'Failed to retry item.');
    }
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      await simulateScreenshot();
      await loadFeed();
    } finally {
      setIsSimulating(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    let bg = '#64748B20';
    let textColor = '#64748B';
    let icon = 'time-outline';

    switch (status) {
      case 'Pending':
        bg = '#F59E0B20';
        textColor = '#F59E0B';
        icon = 'hourglass-outline';
        break;
      case 'Processing':
        bg = '#3B82F620';
        textColor = '#3B82F6';
        icon = 'sync-outline';
        break;
      case 'Completed':
        bg = '#10B98120';
        textColor = '#10B981';
        icon = 'checkmark-circle-outline';
        break;
      case 'Failed':
        bg = '#EF444420';
        textColor = '#EF4444';
        icon = 'alert-circle-outline';
        break;
    }

    return (
      <View style={[styles.statusChip, { backgroundColor: bg }]}>
        <Icon name={icon} size={12} color={textColor} style={{ marginRight: 4 }} />
        <Text style={[styles.statusChipText, { color: textColor }]}>{status}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* 1. Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            OCR & Detection Engine
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Google ML Kit Pipeline Diagnostics
          </Text>
        </View>
        <TouchableOpacity
          onPress={loadFeed}
          style={[styles.iconButton, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          {isLoadingFeed ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Icon name="refresh" size={20} color={theme.colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 2. Listener State Card */}
        <ModernCard style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.stateIndicatorBox}>
              <View
                style={[
                  styles.pulseDot,
                  { backgroundColor: isListening ? theme.colors.success : theme.colors.warning },
                ]}
              />
              <Text style={[styles.stateTitle, { color: theme.colors.textPrimary }]}>
                {isListening ? 'MediaStore Observer Active' : 'Observer Paused'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleToggleScanner}
              style={[
                styles.toggleButton,
                {
                  backgroundColor: isListening
                    ? theme.colors.warning + '20'
                    : theme.colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  { color: isListening ? theme.colors.warning : '#FFFFFF' },
                ]}
              >
                {isListening ? 'Stop' : 'Start'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
            ContentObserver watches OEM screenshot directories (Samsung, Xiaomi, OnePlus, Oppo, Vivo, Realme).
          </Text>
        </ModernCard>

        {/* 3. OCR Queue & Current Processing Status Card (Sprint RN-04) */}
        <ModernCard style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.queueTitleBox}>
              <View style={[styles.ocrQueueIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
                <Icon name="layers-outline" size={18} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={[styles.cardSubheading, { color: theme.colors.textPrimary }]}>
                  Vision AI Processing Queue
                </Text>
                <Text style={[styles.permissionLabel, { color: theme.colors.textSecondary }]}>
                  Sequential processing (Local Vision AI Server)
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.queueStatusBadge,
                {
                  backgroundColor: currentProcessingItem
                    ? `${theme.colors.accent}20`
                    : '#10B98120',
                },
              ]}
            >
              <Text
                style={[
                  styles.queueStatusBadgeText,
                  {
                    color: currentProcessingItem
                      ? theme.colors.accent
                      : theme.colors.success,
                  },
                ]}
              >
                {currentProcessingItem ? 'Processing' : 'Idle'}
              </Text>
            </View>
          </View>

          {currentProcessingItem ? (
            <View style={[styles.currentProcessingBox, { backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC' }]}>
              <View style={styles.processingRow}>
                <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.currentFileName, { color: theme.colors.textPrimary }]}>
                    {currentProcessingItem.fileName}
                  </Text>
                  <Text style={[styles.currentMeta, { color: theme.colors.textSecondary }]}>
                    {currentProcessingItem.width || 1080}×{currentProcessingItem.height || 2400} • Analyzing with Vision AI (Qwen2.5-VL)...
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.currentProcessingBox, { backgroundColor: theme.isDark ? '#1E293B30' : '#F8FAFC' }]}>
              <Text style={[styles.queueIdleText, { color: theme.colors.textSecondary }]}>
                Queue is clear. New screenshots will be processed automatically on detection.
              </Text>
            </View>
          )}
        </ModernCard>

        {/* 4. Last Vision AI Result Card */}
        {lastOCRResult && (
          <ModernCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.rowCenter}>
                <Icon name="document-text-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                  Last Vision AI Result
                </Text>
              </View>
              <View style={[styles.durationPill, { backgroundColor: `${theme.colors.accent}15` }]}>
                <Icon name="flash" size={11} color={theme.colors.accent} style={{ marginRight: 3 }} />
                <Text style={[styles.durationText, { color: theme.colors.accent }]}>
                  {lastOCRResult.processingTimeMs}ms
                </Text>
              </View>
            </View>

            <View style={[styles.lastOCRContent, { backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC' }]}>
              <Text numberOfLines={3} style={[styles.lastOCRText, { color: theme.colors.textPrimary }]}>
                "{lastOCRResult.rawText}"
              </Text>
            </View>

            <View style={styles.lastOCRMetaRow}>
              <Text style={[styles.lastOCRMetaText, { color: theme.colors.textSecondary }]}>
                Confidence: {Math.round(lastOCRResult.confidence * 100)}%
              </Text>
              <Text style={[styles.lastOCRMetaText, { color: theme.colors.textSecondary }]}>
                Blocks: {lastOCRResult.blocksCount}
              </Text>
              <Text style={[styles.lastOCRMetaText, { color: theme.colors.textSecondary }]}>
                Lang: {lastOCRResult.language}
              </Text>
            </View>
          </ModernCard>
        )}

        {/* 5. Metrics Grid */}
        <View style={styles.metricsGrid}>
          <ModernCard style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: theme.colors.primary }]}>
              {scannedToday}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Detected Today
            </Text>
          </ModernCard>

          <ModernCard style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: theme.colors.success }]}>
              {ocrCompletedToday}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              AI Analyzed
            </Text>
          </ModernCard>

          <ModernCard style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: theme.colors.accent }]}>
              {ocrPending}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              AI Pending
            </Text>
          </ModernCard>

          <ModernCard style={styles.metricCard}>
            <Text
              style={[
                styles.metricNumber,
                { color: failedList.length > 0 ? theme.colors.error : theme.colors.textSecondary },
              ]}
            >
              {failedList.length}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Failed
            </Text>
          </ModernCard>
        </View>

        {/* 6. Testing & Action Bar */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={handleSimulate}
            disabled={isSimulating}
            style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
          >
            {isSimulating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="flash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Simulate Screenshot</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRetryAllFailed}
            disabled={isRetrying || failedList.length === 0}
            style={[
              styles.actionBtn,
              {
                backgroundColor:
                  failedList.length > 0 ? theme.colors.warning : theme.colors.border,
              },
            ]}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="reload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Retry All Failed ({failedList.length})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 7. Failed AI Items Section */}
        {failedList.length > 0 && (
          <View style={styles.failedSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.rowCenter}>
                <Icon name="alert-circle" size={18} color={theme.colors.error} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: theme.colors.error }]}>
                  Failed AI Items ({failedList.length})
                </Text>
              </View>
            </View>

            {failedList.map((failedItem) => (
              <ModernCard key={failedItem.id} style={styles.failedItemCard}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.itemFileName, { color: theme.colors.textPrimary }]}>
                      {failedItem.fileName}
                    </Text>
                    <Text style={[styles.errorDetailText, { color: theme.colors.error }]}>
                      {failedItem.errorMessage || 'Unknown error'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRetrySingle(failedItem.id)}
                    style={[styles.singleRetryBtn, { borderColor: theme.colors.error }]}
                  >
                    <Icon name="refresh" size={14} color={theme.colors.error} />
                    <Text style={[styles.singleRetryBtnText, { color: theme.colors.error }]}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </ModernCard>
            ))}
          </View>
        )}

        {/* 8. Recent Detected Feed */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Last 20 Detected Screenshots
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            Stored in SQLite PendingScreenshots & OCRCache
          </Text>
        </View>

        {recentScreenshots.length === 0 ? (
          <ModernCard style={styles.emptyCard}>
            <Icon name="image-outline" size={40} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No screenshots detected yet.
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
              Capture a screenshot on your device or tap 'Simulate Screenshot' above.
            </Text>
          </ModernCard>
        ) : (
          recentScreenshots.map((item) => (
            <ModernCard key={item.id} style={styles.screenshotItemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <Icon
                    name="phone-portrait-outline"
                    size={18}
                    color={theme.colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.itemFileName, { color: theme.colors.textPrimary }]}
                  >
                    {item.fileName}
                  </Text>
                </View>
                {renderStatusBadge(item.ocrStatus || item.status)}
              </View>

              <Text
                numberOfLines={1}
                style={[styles.itemFilePath, { color: theme.colors.textSecondary }]}
              >
                {item.filePath}
              </Text>

              {item.extractedText ? (
                <View style={[styles.extractedPreviewBox, { backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC' }]}>
                  <Text numberOfLines={2} style={[styles.extractedPreviewText, { color: theme.colors.textPrimary }]}>
                    "{item.extractedText}"
                  </Text>
                </View>
              ) : null}

              <View style={styles.itemMetaRow}>
                <View style={styles.metaCol}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                    Size:
                  </Text>
                  <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
                    {FileUtils.formatBytes(item.fileSize)}
                  </Text>
                </View>

                <View style={styles.metaCol}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                    Folder:
                  </Text>
                  <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
                    {item.deviceFolder || 'Screenshots'}
                  </Text>
                </View>

                {item.ocrProcessingTime && item.ocrProcessingTime > 0 ? (
                  <View style={styles.metaCol}>
                    <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                      AI:
                    </Text>
                    <Text style={[styles.metaVal, { color: theme.colors.accent }]}>
                      {item.ocrProcessingTime}ms
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.errorMessage && (
                <View style={[styles.errorBox, { backgroundColor: '#EF444415' }]}>
                  <Icon name="alert-circle" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText} numberOfLines={2}>
                    {item.errorMessage}
                  </Text>
                </View>
              )}
            </ModernCard>
          ))
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
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    padding: 16,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stateIndicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  queueTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ocrQueueIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardSubheading: {
    fontSize: 14,
    fontWeight: '700',
  },
  permissionLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  queueStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  queueStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  currentProcessingBox: {
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentFileName: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  queueIdleText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  lastOCRContent: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  lastOCRText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 17,
  },
  lastOCRMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lastOCRMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    marginTop: 3,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    marginHorizontal: 3,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  failedSection: {
    marginBottom: 16,
  },
  failedItemCard: {
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorDetailText: {
    fontSize: 11,
    marginTop: 2,
  },
  singleRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  singleRetryBtnText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  screenshotItemCard: {
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  itemFileName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemFilePath: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  extractedPreviewBox: {
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  extractedPreviewText: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F030',
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    marginRight: 4,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    flex: 1,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

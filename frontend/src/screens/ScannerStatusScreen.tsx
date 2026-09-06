import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
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

export const ScannerStatusScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isListening = useScannerStore((s) => s.isListening);
  const scannedToday = useScannerStore((s) => s.scannedToday);
  const pendingProcessing = useScannerStore((s) => s.pendingProcessing);
  const lastScreenshot = useScannerStore((s) => s.lastScreenshot);
  const permissionStatus = useScannerStore((s) => s.permissionStatus);

  const startScanner = useScannerStore((s) => s.startScanner);
  const stopScanner = useScannerStore((s) => s.stopScanner);
  const requestPermissions = useScannerStore((s) => s.requestPermissions);
  const checkPermissions = useScannerStore((s) => s.checkPermissions);
  const retryFailed = useScannerStore((s) => s.retryFailed);
  const simulateScreenshot = useScannerStore((s) => s.simulateScreenshot);

  const [recentScreenshots, setRecentScreenshots] = useState<PendingScreenshot[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const [items, counts] = await Promise.all([
        pendingScreenshotRepository.getRecent(20),
        pendingScreenshotRepository.getCounts(),
      ]);
      setRecentScreenshots(items);
      setFailedCount(counts.failed);
    } catch (err) {
      console.warn('[ScannerStatusScreen] Error loading feed:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
    loadFeed();
  }, [checkPermissions, loadFeed]);

  // Refresh feed whenever a new screenshot is detected in store
  useEffect(() => {
    if (lastScreenshot) {
      loadFeed();
    }
  }, [lastScreenshot, loadFeed]);

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

  const handleRetryFailed = async () => {
    if (failedCount === 0) {
      Alert.alert('No Failed Items', 'There are no failed screenshots in the queue.');
      return;
    }
    setIsRetrying(true);
    try {
      await retryFailed();
      await loadFeed();
      Alert.alert('Retry Finished', 'Failed screenshots have been re-queued for processing.');
    } catch (err: any) {
      Alert.alert('Retry Error', err?.message || 'Failed to retry items.');
    } finally {
      setIsRetrying(false);
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
        <Icon name={icon} size={13} color={textColor} style={{ marginRight: 4 }} />
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
            Screenshot Engine
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Background Observer & Pipeline Status
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
        {/* 2. Listener State Hero Card */}
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
                {isListening ? 'Observer Active' : 'Observer Paused'}
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
                {isListening ? 'Stop Observer' : 'Start Observer'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
            {isListening
              ? 'Watching Android MediaStore ContentObserver for Samsung, Xiaomi, OnePlus, Oppo, Vivo, Realme, and Pixel screenshot directories.'
              : 'Detection paused. App will not automatically import new screenshots until resumed.'}
          </Text>
        </ModernCard>

        {/* 3. Permissions Card */}
        <ModernCard style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.permissionInfoBox}>
              <Icon
                name={permissionStatus === 'granted' ? 'shield-checkmark' : 'shield-outline'}
                size={22}
                color={
                  permissionStatus === 'granted'
                    ? theme.colors.success
                    : theme.colors.warning
                }
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.cardSubheading, { color: theme.colors.textPrimary }]}>
                  Media Permissions
                </Text>
                <Text style={[styles.permissionLabel, { color: theme.colors.textSecondary }]}>
                  {permissionService.getPermissionDescription()}
                </Text>
              </View>
            </View>

            {permissionStatus !== 'granted' && (
              <TouchableOpacity
                onPress={() => requestPermissions()}
                style={[styles.smallActionBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.smallActionBtnText}>Grant</Text>
              </TouchableOpacity>
            )}
          </View>
        </ModernCard>

        {/* 4. Queue Metrics Grid */}
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
            <Text style={[styles.metricNumber, { color: theme.colors.accent }]}>
              {pendingProcessing}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              In Queue
            </Text>
          </ModernCard>

          <ModernCard style={styles.metricCard}>
            <Text
              style={[
                styles.metricNumber,
                { color: failedCount > 0 ? theme.colors.error : theme.colors.textSecondary },
              ]}
            >
              {failedCount}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Failed
            </Text>
          </ModernCard>
        </View>

        {/* 5. Testing & Debug Actions */}
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
            onPress={handleRetryFailed}
            disabled={isRetrying || failedCount === 0}
            style={[
              styles.actionBtn,
              {
                backgroundColor:
                  failedCount > 0 ? theme.colors.warning : theme.colors.border,
              },
            ]}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="reload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Retry Failed ({failedCount})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 6. Feed Title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Last 20 Detected Screenshots
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            Stored in SQLite PendingScreenshots
          </Text>
        </View>

        {/* 7. Detected Screenshots List */}
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
                {renderStatusBadge(item.status)}
              </View>

              <Text
                numberOfLines={1}
                style={[styles.itemFilePath, { color: theme.colors.textSecondary }]}
              >
                {item.filePath}
              </Text>

              <View style={styles.itemMetaRow}>
                <View style={styles.metaCol}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                    Asset ID:
                  </Text>
                  <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
                    {item.deviceAssetId}
                  </Text>
                </View>

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
                    Hash:
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.metaVal, { color: theme.colors.textPrimary, maxWidth: 90 }]}
                  >
                    {item.fileHash ? item.fileHash.substring(0, 10) + '...' : 'N/A'}
                  </Text>
                </View>
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
    fontSize: 16,
    fontWeight: '700',
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  permissionInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardSubheading: {
    fontSize: 14,
    fontWeight: '600',
  },
  permissionLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  smallActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
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
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemFilePath: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 6,
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
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
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});

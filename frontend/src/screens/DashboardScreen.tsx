import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { useScannerStore } from '../store/scanner.store';
import { ModernCard } from '../components/ModernCard';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { FileUtils } from '../utils/fileUtils';

export const DashboardScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const screenshots = useScreenshotStore((s) => s.screenshots);
  const needsReviewList = useScreenshotStore((s) => s.needsReviewList);
  const categories = useCategoryStore((s) => s.categories);

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

  const totalCount = screenshots.length;
  const organizedCount = screenshots.filter((s) => s.categoryId !== 'unsorted').length;
  const matchRate = totalCount > 0 ? Math.round((organizedCount / totalCount) * 100) : 0;

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
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs', { screen: 'Settings' })}
          style={[styles.iconButton, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          <Icon name="cog-outline" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 2. Stats Header Card */}
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
            { backgroundColor: theme.isDark ? '#1E293B60' : '#F8FAFC' },
          ]}
        >
          <View style={styles.lastDetectedHeader}>
            <Text style={[styles.lastDetectedTitle, { color: theme.colors.textSecondary }]}>
              LAST DETECTED SCREENSHOT
            </Text>
            {renderLastScreenshotStatus(lastScreenshot?.status)}
          </View>

          {lastScreenshot ? (
            <View style={styles.lastItemRow}>
              <View style={[styles.fileIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                <Icon name="image-outline" size={20} color={theme.colors.primary} />
              </View>
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
            </View>
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
          <View style={[styles.ocrMetricBox, { backgroundColor: theme.isDark ? '#1E293B50' : '#F1F5F9' }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.success }]}>
              <AnimatedCounter value={ocrCompletedToday} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              OCR Completed
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.isDark ? '#1E293B50' : '#F1F5F9' }]}>
            <Text style={[styles.ocrMetricValue, { color: theme.colors.accent }]}>
              <AnimatedCounter value={ocrPending} />
            </Text>
            <Text style={[styles.ocrMetricTitle, { color: theme.colors.textSecondary }]}>
              OCR Pending
            </Text>
          </View>

          <View style={[styles.ocrMetricBox, { backgroundColor: theme.isDark ? '#1E293B50' : '#F1F5F9' }]}>
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

      {/* 5. Recent Screenshots Carousel */}
      {screenshots.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Recent Screenshots
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Folders' })}>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={screenshots.slice(0, 10)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
                style={styles.recentItem}
              >
                <ScreenshotImageThumbnail
                  filePath={item.filePath}
                  style={styles.recentThumb}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.recentCategory, { color: theme.colors.textPrimary }]}
                >
                  {item.categoryName}
                </Text>
                <ConfidenceBadge confidence={item.confidence} showPercent={false} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* 6. Needs Review Strip */}
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
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
                style={styles.reviewItem}
              >
                <ScreenshotImageThumbnail
                  filePath={item.filePath}
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

      {/* 7. Smart Folders Grid */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Smart Folders
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Folders' })}>
            <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>All Folders</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.foldersGrid}>
          {categories.slice(0, 4).map((cat) => (
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
              <View
                style={[
                  styles.folderIconBox,
                  { backgroundColor: `${cat.colorHex || theme.colors.primary}15` },
                ]}
              >
                <Icon
                  name={cat.iconName || 'folder-outline'}
                  size={22}
                  color={cat.colorHex || theme.colors.primary}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.folderName, { color: theme.colors.textPrimary }]}
              >
                {cat.name}
              </Text>
              <Text style={[styles.folderCount, { color: theme.colors.textSecondary }]}>
                {cat.screenshotCount || 0} items
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 20,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
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
    borderRadius: 12,
    marginBottom: 6,
  },
  recentCategory: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
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
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  folderIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 11,
    fontWeight: '500',
  },
});

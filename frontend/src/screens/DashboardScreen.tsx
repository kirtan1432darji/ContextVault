import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
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
import { screenshotScannerService } from '../services/screenshotScannerService';

export const DashboardScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const screenshots = useScreenshotStore((s) => s.screenshots);
  const needsReviewList = useScreenshotStore((s) => s.needsReviewList);
  const categories = useCategoryStore((s) => s.categories);
  const isScanning = useScannerStore((s) => s.isScanning);
  const progress = useScannerStore((s) => s.progress);

  const totalCount = screenshots.length;
  const organizedCount = screenshots.filter((s) => s.categoryId !== 'unsorted').length;
  const matchRate = totalCount > 0 ? Math.round((organizedCount / totalCount) * 100) : 0;

  const handleSimulateScan = async () => {
    useScannerStore.getState().startScan(5);
    // Simulate finding a media screenshot
    setTimeout(async () => {
      await screenshotScannerService.processScreenshotAsset({
        id: `asset_${Date.now()}`,
        filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_Invoice_Sample.png',
        fileName: 'Screenshot_Invoice_Sample.png',
        fileSize: 245000,
        width: 1080,
        height: 2400,
        createdAt: new Date().toISOString(),
      });
      useScannerStore.getState().finishScan(1);
    }, 1200);
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
            Intelligent Screenshot Intelligence
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

      {/* 3. Hero Scan Trigger Card */}
      <ModernCard style={styles.heroScanCard}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIconBox, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Icon
              name={isScanning ? 'sync-outline' : 'sparkles-outline'}
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { color: theme.colors.textPrimary }]}>
              {isScanning ? 'Scanning Screenshots...' : 'Auto-Organize Gallery'}
            </Text>
            <Text style={[styles.heroDesc, { color: theme.colors.textSecondary }]}>
              {isScanning
                ? `Analyzing OCR text (${Math.round(progress * 100)}%)`
                : 'Extract OCR & categorize screenshots with AI'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleSimulateScan}
          disabled={isScanning}
          style={[
            styles.heroButton,
            { backgroundColor: isScanning ? theme.colors.border : theme.colors.primary },
          ]}
        >
          <Text style={styles.heroButtonText}>
            {isScanning ? 'Scanning...' : 'Scan Gallery Now'}
          </Text>
        </TouchableOpacity>
      </ModernCard>

      {/* 4. Recent Screenshots Carousel */}
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

      {/* 5. Needs Review Strip */}
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
                <Text numberOfLines={1} style={[styles.reviewText, { color: theme.colors.textPrimary }]}>
                  {item.fileName}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* 6. Smart Folders Grid */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Smart Folders
          </Text>
        </View>
        <View style={styles.foldersGrid}>
          {categories.slice(0, 6).map((cat) => {
            const hex = cat.colorHex.startsWith('#') ? cat.colorHex : `#${cat.colorHex}`;
            return (
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
                <View style={[styles.folderIconBox, { backgroundColor: `${hex}20` }]}>
                  <Icon name={cat.iconName || 'folder-outline'} size={24} color={hex} />
                </View>
                <Text numberOfLines={1} style={[styles.folderName, { color: theme.colors.textPrimary }]}>
                  {cat.name}
                </Text>
                <Text style={[styles.folderCount, { color: theme.colors.textSecondary }]}>
                  {cat.screenshotCount || 0} items
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
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
    fontWeight: '500',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 16,
  },
  statCol: {
    alignItems: 'center',
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
  heroScanCard: {
    marginBottom: 24,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  heroDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  heroButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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

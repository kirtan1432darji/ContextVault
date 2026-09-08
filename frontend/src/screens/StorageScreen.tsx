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
import {
  storageManagerService,
  StorageBreakdown,
} from '../services/storageManagerService';

export const StorageScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);

  const loadStorage = useCallback(async () => {
    try {
      const data = await storageManagerService.getStorageBreakdown();
      setBreakdown(data);
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
      'This will remove cached extracted text records. Original screenshots in your gallery will NOT be affected. Ready to proceed?',
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

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Caches & Defragment',
      'This will purge all temporary OCR caches, search history, and defragment the SQLite database. Screenshots and folders will remain intact.',
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
            Storage & Data
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Local storage footprint & cache optimization
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
              Calculating storage usage...
            </Text>
          </View>
        ) : (
          <>
            {/* Storage Usage Summary Card */}
            <ModernCard style={styles.card}>
              <View style={styles.totalRow}>
                <View>
                  <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>
                    Total ContextVault Storage
                  </Text>
                  <Text style={[styles.totalValue, { color: theme.colors.textPrimary }]}>
                    {storageManagerService.formatBytes(breakdown?.totalBytes || 0)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${theme.colors.primary}18` }]}>
                  <Icon name="pie-chart-outline" size={20} color={theme.colors.primary} />
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

            {/* Itemized Cards */}

            {/* 1. SQLite Database */}
            <ModernCard style={styles.card}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <Icon name="server-outline" size={20} color="#3B82F6" />
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
            </ModernCard>

            {/* 2. OCR Text Cache */}
            <ModernCard style={styles.card}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <Icon name="document-text-outline" size={20} color="#06B6D4" />
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
            </ModernCard>

            {/* 3. Search Cache */}
            <ModernCard style={styles.card}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <Icon name="search-outline" size={20} color="#10B981" />
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
            </ModernCard>

            {/* 4. Chat History */}
            <ModernCard style={styles.card}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <Icon name="chatbubbles-outline" size={20} color="#8B5CF6" />
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
            <View style={[styles.guaranteeBox, { backgroundColor: `${theme.colors.success}12`, borderColor: `${theme.colors.success}30` }]}>
              <Icon name="shield-checkmark" size={24} color={theme.colors.success} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.guaranteeTitle, { color: theme.colors.success }]}>
                  Non-Destructive Intelligence
                </Text>
                <Text style={[styles.guaranteeText, { color: theme.colors.textSecondary }]}>
                  ContextVault never edits, moves, or deletes original screenshot photos in your device's media gallery. All clearing actions only affect internal caches.
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
    marginBottom: 12,
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
    marginTop: 8,
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

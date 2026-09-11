import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { useScreenshotStore } from '../store/screenshot.store';
import { recycleBinService } from '../services/recycleBinService';
import { ScreenshotModel } from '../models';

export const RecycleBinScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const deletedItems = useScreenshotStore((s) => s.recycleBinScreenshots);
  const loadRecycleBin = useScreenshotStore((s) => s.loadRecycleBin);
  const restoreScreenshot = useScreenshotStore((s) => s.restoreScreenshot);
  const restoreAllScreenshots = useScreenshotStore((s) => s.restoreAllScreenshots);
  const permanentDeleteScreenshot = useScreenshotStore((s) => s.permanentDeleteScreenshot);
  const emptyRecycleBin = useScreenshotStore((s) => s.emptyRecycleBin);

  const fetchData = useCallback(async () => {
    try {
      await loadRecycleBin();
    } catch (err) {
      console.warn('[RecycleBinScreen] Error loading items:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadRecycleBin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleRestore = async (item: ScreenshotModel) => {
    setActionInProgress(`restore_${item.id}`);
    try {
      await restoreScreenshot(item.id);
      Alert.alert('Screenshot Restored', `Restored "${item.fileName}" to folder "${item.categoryName || 'Unsorted'}".`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to restore screenshot.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePermanentDelete = (item: ScreenshotModel) => {
    Alert.alert(
      'Permanent Deletion',
      `Permanently remove "${item.fileName}" from ContextVault?\n\nThis removes the index and OCR cache forever. Original photos on your device will NOT be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(`delete_${item.id}`);
            try {
              await permanentDeleteScreenshot(item.id);
              Alert.alert('Deleted', 'Screenshot metadata permanently removed.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete screenshot.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleRestoreAll = () => {
    if (deletedItems.length === 0) return;
    Alert.alert(
      'Restore All Screenshots',
      `Restore all ${deletedItems.length} screenshots back to their respective smart folders?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore All',
          onPress: async () => {
            setActionInProgress('restore_all');
            try {
              const count = await restoreAllScreenshots();
              Alert.alert('Restored', `Restored ${count} screenshots successfully.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to restore screenshots.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleEmptyBin = () => {
    if (deletedItems.length === 0) return;
    Alert.alert(
      'Empty Recycle Bin',
      `Permanently purge all ${deletedItems.length} screenshots from ContextVault?\n\nThis action cannot be undone. Original photos in your device gallery will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty Recycle Bin',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress('empty_bin');
            try {
              const count = await emptyRecycleBin();
              Alert.alert('Recycle Bin Emptied', `Permanently purged ${count} screenshot records.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to empty recycle bin.');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ScreenshotModel }) => {
    const isRestoring = actionInProgress === `restore_${item.id}`;
    const isDeleting = actionInProgress === `delete_${item.id}`;

    return (
      <ModernCard style={styles.card}>
        <View style={styles.cardRow}>
          <ScreenshotImageThumbnail
            filePath={item.filePath}
            style={styles.thumbnail}
            borderRadius={10}
          />
          <View style={styles.itemInfo}>
            <Text
              style={[styles.itemFileName, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.fileName}
            </Text>

            <View style={styles.metaRow}>
              <View style={[styles.categoryBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Icon name="folder-outline" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.categoryText, { color: theme.colors.primary }]}>
                  {item.categoryName || 'Unsorted'}
                </Text>
              </View>

              <Text style={[styles.deletedTimeText, { color: theme.colors.textMuted }]}>
                {recycleBinService.formatDeletedAge(item.deletedAt)}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.restoreBtn, { borderColor: theme.colors.primary }]}
                onPress={() => handleRestore(item)}
                disabled={isRestoring || isDeleting}
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Icon name="arrow-undo-outline" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.restoreBtnText, { color: theme.colors.primary }]}>
                      Restore
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: theme.colors.error }]}
                onPress={() => handlePermanentDelete(item)}
                disabled={isRestoring || isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={theme.colors.error} />
                ) : (
                  <>
                    <Icon name="trash-outline" size={14} color={theme.colors.error} style={{ marginRight: 4 }} />
                    <Text style={[styles.deleteBtnText, { color: theme.colors.error }]}>
                      Delete
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ModernCard>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              Recycle Bin
            </Text>
            {deletedItems.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: `${theme.colors.error}20` }]}>
                <Text style={[styles.countBadgeText, { color: theme.colors.error }]}>
                  {deletedItems.length}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Soft-deleted screenshots awaiting permanent deletion
          </Text>
        </View>

        {deletedItems.length > 0 && (
          <View style={styles.topActionsGroup}>
            <TouchableOpacity
              onPress={handleRestoreAll}
              style={[styles.topActionBtn, { borderColor: theme.colors.primary }]}
              disabled={actionInProgress !== null}
              accessibilityRole="button"
              accessibilityLabel="Restore All"
            >
              <Icon name="reload-outline" size={18} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEmptyBin}
              style={[styles.topActionBtn, { borderColor: theme.colors.error, marginLeft: 8 }]}
              disabled={actionInProgress !== null}
              accessibilityRole="button"
              accessibilityLabel="Empty Recycle Bin"
            >
              <Icon name="trash-bin-outline" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Retention Policy Banner */}
      <View
        style={[
          styles.policyBanner,
          {
            backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Icon name="shield-checkmark-outline" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.policyText, { color: theme.colors.textSecondary }]}>
          Items in the Recycle Bin are hidden from smart folders and search. Original photos on your device are never altered or deleted.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading Recycle Bin...
          </Text>
        </View>
      ) : (
        <FlatList
          data={deletedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${theme.colors.primary}12` }]}>
                <Icon name="trash-outline" size={44} color={theme.colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                Recycle Bin is Empty
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                Screenshots moved to the Recycle Bin will appear here before permanent deletion.
              </Text>
              <TouchableOpacity
                style={[styles.backHomeBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backHomeBtnText}>Back to Settings</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
    marginTop: 2,
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  topActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topActionBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  policyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  policyText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  card: {
    marginBottom: 12,
    padding: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 72,
    height: 96,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
  },
  itemFileName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deletedTimeText: {
    fontSize: 11,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  restoreBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  backHomeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

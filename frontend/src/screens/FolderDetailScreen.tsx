import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Share,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { smartFolderService } from '../services/SmartFolderService';
import { screenshotRepository, categoryRepository } from '../database/repositories';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { EmptyStateView } from '../components/EmptyStateView';
import { ModernCard } from '../components/ModernCard';
import { ScreenshotModel, FolderStatistics } from '../models';
import { FileUtils } from '../utils/fileUtils';
import { useAuthStore } from '../store/auth.store';
import { GuestUpgradeBottomSheet } from '../components/GuestUpgradeBottomSheet';
import { BulkActionBar } from '../components/BulkActionBar';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderDetail'>;

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 44) / 2;

export const FolderDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName } = route.params;
  const theme = useAppTheme();

  const allScreenshots = useScreenshotStore((s) => s.screenshots);
  const categories = useCategoryStore((s) => s.categories);

  const subcategoriesFromStore = useCategoryStore((s) =>
    s.getSubcategories(categoryId)
  );

  const [selectedSubcat, setSelectedSubcat] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'confidence' | 'merchant' | 'amount'>('newest');
  const [quickFilter, setQuickFilter] = useState<'all' | 'favorites' | 'ocr' | 'vision'>('all');
  const [searchInFolder, setSearchInFolder] = useState('');

  // Guest Mode State
  const isGuest = useAuthStore((s) => s.isGuest);
  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('AI Features');

  const handleRestrictedAction = (feature: string) => {
    setLockedFeatureName(feature);
    setGuestModalVisible(true);
  };

  // Move Modal State
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [targetScreenshot, setTargetScreenshot] = useState<ScreenshotModel | null>(null);
  const [isBulkMove, setIsBulkMove] = useState(false);

  // Multi-Select State (Sprint P2-3)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dbScreenshots, setDbScreenshots] = useState<ScreenshotModel[]>([]);
  const [folderStats, setFolderStats] = useState<FolderStatistics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const loadFolderStats = React.useCallback(async () => {
    try {
      const stats = await categoryRepository.getFolderStatistics(categoryId);
      setFolderStats(stats);
    } catch (err) {
      console.warn('[FolderDetail] Failed to load folder statistics:', err);
    }
  }, [categoryId]);

  const loadFolderScreenshots = React.useCallback(async () => {
    try {
      const descendantIds = useCategoryStore.getState().getDescendantCategoryIds(categoryId);
      const items = await screenshotRepository.getScreenshotsForCategory(
        categoryId,
        categoryName,
        descendantIds
      );
      setDbScreenshots(items);
      // Ensure folder count is kept in sync
      await categoryRepository.updateScreenshotCount(categoryId);
      await loadFolderStats();
    } catch (err) {
      console.warn('[FolderDetail] Failed to query SQLite category screenshots:', err);
    }
  }, [categoryId, categoryName, loadFolderStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        useCategoryStore.getState().loadCategories(),
        useScreenshotStore.getState().loadScreenshots(),
        loadFolderScreenshots(),
        loadFolderStats(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Real-time synchronization when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      useCategoryStore.getState().loadCategories();
      useScreenshotStore.getState().loadScreenshots();
      loadFolderScreenshots();
      loadFolderStats();
    }, [loadFolderScreenshots, loadFolderStats])
  );

  // All screenshots that belong to this folder or any nested subcategories
  const folderCategoryIds = useMemo(() => {
    const descendantIds = useCategoryStore.getState().getDescendantCategoryIds(categoryId);
    return new Set(descendantIds);
  }, [categoryId, categories]);

  const folderScreenshots = useMemo(() => {
    const map = new Map<string, ScreenshotModel>();

    // 1. Primary from SQLite
    dbScreenshots.forEach((s) => map.set(s.id, s));

    // 2. Supplement from in-memory store
    const cleanCatName = categoryName.toLowerCase();
    allScreenshots.forEach((s) => {
      const isDescendant = folderCategoryIds.has(s.categoryId);
      const nameMatches = s.categoryName.toLowerCase() === cleanCatName;
      const pathMatches = s.folderPath && s.folderPath.some((p) => p.toLowerCase() === cleanCatName);
      if (isDescendant || nameMatches || pathMatches) {
        if (!map.has(s.id)) {
          map.set(s.id, s);
        }
      }
    });

    return Array.from(map.values()).filter((s) => !s.isDeleted);
  }, [dbScreenshots, allScreenshots, folderCategoryIds, categoryName]);

  // Distinct subcategory tags and child folders from screenshots
  const distinctSubcategories = useMemo(() => {
    const subcats = new Set<string>();
    folderScreenshots.forEach((s) => {
      if (s.subcategory && s.subcategory.trim().length > 0) {
        subcats.add(s.subcategory.trim());
      }
      if (s.folderPath && Array.isArray(s.folderPath)) {
        s.folderPath.forEach((p) => {
          if (p.toLowerCase() !== categoryName.toLowerCase()) {
            subcats.add(p);
          }
        });
      }
    });
    categories
      .filter((c) => c.parentId === categoryId || c.parentCategoryId === categoryId)
      .forEach((c) => subcats.add(c.name));

    return Array.from(subcats);
  }, [folderScreenshots, categories, categoryId, categoryName]);

  const extractAmountNumber = (s: ScreenshotModel): number => {
    if (s.entities?.amount) {
      const num = parseFloat(String(s.entities.amount).replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) return num;
    }
    const amtTag = s.tags?.find((t) => t.name.startsWith('₹') || t.name.startsWith('amt_'));
    if (amtTag) {
      const num = parseFloat(amtTag.name.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) return num;
    }
    if (s.ocrText) {
      const m = s.ocrText.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (m) {
        const num = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(num)) return num;
      }
    }
    return 0;
  };

  const getMerchant = (item: ScreenshotModel): string | null => {
    if (item.entities?.merchant) return String(item.entities.merchant);
    const mTag = item.tags?.find((t) => t.name.startsWith('merchant_'));
    if (mTag) return mTag.name.replace('merchant_', '');
    return null;
  };

  const getAmount = (item: ScreenshotModel): string | null => {
    if (item.entities?.amount) return `₹${item.entities.amount}`;
    const amtTag = item.tags?.find((t) => t.name.startsWith('₹') || t.name.startsWith('amt_'));
    if (amtTag) return amtTag.name.replace('amt_', '₹');
    if (item.ocrText) {
      const m = item.ocrText.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (m) return `₹${m[1]}`;
    }
    return null;
  };

  const cycleSort = () => {
    const options: ('newest' | 'oldest' | 'confidence' | 'merchant' | 'amount')[] = [
      'newest',
      'oldest',
      'confidence',
      'merchant',
      'amount',
    ];
    const nextIdx = (options.indexOf(sortOrder) + 1) % options.length;
    setSortOrder(options[nextIdx]);
  };

  const getSortLabel = (s: typeof sortOrder): string => {
    switch (s) {
      case 'newest':
        return 'Newest';
      case 'oldest':
        return 'Oldest';
      case 'confidence':
        return 'AI Conf';
      case 'merchant':
        return 'Merchant';
      case 'amount':
        return 'Amount';
    }
  };

  // Filtered and sorted screenshots
  const displayedScreenshots = useMemo(() => {
    let result = folderScreenshots;

    // Quick filter: All, Favorites, OCR, Vision
    if (quickFilter === 'favorites') {
      result = result.filter((s) => s.isFavorite);
    } else if (quickFilter === 'ocr') {
      result = result.filter((s) => s.ocrStatus === 'completed' || Boolean(s.ocrText));
    } else if (quickFilter === 'vision') {
      result = result.filter(
        (s) =>
          Boolean(s.entities || (s.tags && s.tags.length > 0) || s.classificationSource === 'vision_ai')
      );
    }

    // Filter by subfolder
    if (selectedSubcat !== 'all') {
      const targetCat = categories.find(
        (c) =>
          c.name.toLowerCase() === selectedSubcat.toLowerCase() &&
          (c.parentId === categoryId || c.parentCategoryId === categoryId)
      );
      const targetDescendants = targetCat
        ? new Set(useCategoryStore.getState().getDescendantCategoryIds(targetCat.id))
        : null;

      result = result.filter(
        (s) =>
          (targetDescendants && targetDescendants.has(s.categoryId)) ||
          (s.subcategory && s.subcategory.toLowerCase() === selectedSubcat.toLowerCase()) ||
          s.categoryName.toLowerCase() === selectedSubcat.toLowerCase() ||
          (s.folderPath && s.folderPath.some((p) => p.toLowerCase() === selectedSubcat.toLowerCase()))
      );
    }

    // Search inside folder
    if (searchInFolder.trim().length > 0) {
      const q = searchInFolder.toLowerCase();
      result = result.filter(
        (s) =>
          s.fileName.toLowerCase().includes(q) ||
          (s.ocrText && s.ocrText.toLowerCase().includes(q)) ||
          (s.keywords && s.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    }

    // Sort options: newest | oldest | confidence | merchant | amount
    return [...result].sort((a, b) => {
      if (sortOrder === 'confidence') {
        return (b.confidence || 0) - (a.confidence || 0);
      }
      if (sortOrder === 'merchant') {
        const mA = (a.entities?.merchant || a.subcategory || a.fileName || '').toLowerCase();
        const mB = (b.entities?.merchant || b.subcategory || b.fileName || '').toLowerCase();
        return mA.localeCompare(mB);
      }
      if (sortOrder === 'amount') {
        return extractAmountNumber(b) - extractAmountNumber(a);
      }
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [folderScreenshots, selectedSubcat, searchInFolder, sortOrder, quickFilter, categories, categoryId]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsSelectMode(false);
      }
      return next;
    });
  };

  const handleStartSelect = (initialId?: string) => {
    setIsSelectMode(true);
    if (initialId) {
      setSelectedIds(new Set([initialId]));
    } else if (displayedScreenshots.length > 0) {
      setSelectedIds(new Set([displayedScreenshots[0].id]));
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === displayedScreenshots.length) {
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } else {
      setSelectedIds(new Set(displayedScreenshots.map((s) => s.id)));
    }
  };

  const handleCancelSelect = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const isAllSelectedFavorite = useMemo(() => {
    if (selectedIds.size === 0) return false;
    const selected = displayedScreenshots.filter((s) => selectedIds.has(s.id));
    return selected.length > 0 && selected.every((s) => s.isFavorite);
  }, [selectedIds, displayedScreenshots]);

  const handleBulkFavorite = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const newStatus = !isAllSelectedFavorite;
    await useScreenshotStore.getState().bulkSetFavorite(ids, newStatus);
    Alert.alert(
      'Favorites Updated',
      `${newStatus ? 'Starred' : 'Unstarred'} ${ids.length} screenshot${ids.length !== 1 ? 's' : ''}.`
    );
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      'Move to Recycle Bin',
      `Move ${ids.length} screenshot${ids.length !== 1 ? 's' : ''} to the Recycle Bin? You can restore them anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Bin',
          style: 'destructive',
          onPress: async () => {
            await useScreenshotStore.getState().bulkSoftDelete(ids);
            await loadFolderScreenshots();
            handleCancelSelect();
            Alert.alert(
              'Recycle Bin',
              `Moved ${ids.length} screenshot${ids.length !== 1 ? 's' : ''} to Recycle Bin.`
            );
          },
        },
      ]
    );
  };

  const handleOpenBulkMove = () => {
    setIsBulkMove(true);
    setTargetScreenshot(null);
    setMoveModalVisible(true);
  };

  const handleBulkShare = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const selected = displayedScreenshots.filter((s) => selectedIds.has(s.id));
    const summary = selected
      .map((s, idx) => `${idx + 1}. ${s.fileName} (${s.categoryName})`)
      .join('\n');
    try {
      await Share.share({
        title: `ContextVault Screenshots (${ids.length})`,
        message: `ContextVault Shared Screenshots:\n${summary}`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleOpenMove = (item: ScreenshotModel) => {
    setIsBulkMove(false);
    setTargetScreenshot(item);
    setMoveModalVisible(true);
  };

  const handleExecuteMove = async (targetCategoryId: string) => {
    try {
      if (isBulkMove) {
        const ids = Array.from(selectedIds);
        const count = await smartFolderService.bulkMoveScreenshots(ids, targetCategoryId);
        setMoveModalVisible(false);
        setIsBulkMove(false);
        handleCancelSelect();
        await loadFolderScreenshots();
        await loadFolderStats();
        Alert.alert('Moved', `Successfully moved ${count} screenshots.`);
      } else if (targetScreenshot) {
        await smartFolderService.moveScreenshot(targetScreenshot.id, targetCategoryId);
        setMoveModalVisible(false);
        await loadFolderScreenshots();
        await loadFolderStats();
        Alert.alert('Moved', 'Screenshot moved to destination folder.');
      }
    } catch (err: any) {
      Alert.alert('Move Error', err?.message || 'Failed to move screenshot.');
    }
  };

  const handleBulkRemoveFromFolder = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      'Remove from Folder',
      `Remove ${ids.length} screenshot${ids.length !== 1 ? 's' : ''} from this folder? They will be moved to Unsorted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await smartFolderService.bulkMoveScreenshots(ids, 'unsorted');
              await loadFolderScreenshots();
              await loadFolderStats();
              handleCancelSelect();
              Alert.alert('Removed', `Moved ${ids.length} screenshots to Unsorted.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove screenshots.');
            }
          },
        },
      ]
    );
  };

  const handleReanalyzeFolder = async () => {
    if (displayedScreenshots.length === 0) {
      Alert.alert('Folder Empty', 'No screenshots to re-analyze in this folder.');
      return;
    }
    Alert.alert(
      'Re-analyze Folder',
      `Re-run AI Smart Folder classification for all ${displayedScreenshots.length} screenshots in this folder?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-analyze',
          onPress: async () => {
            setIsReanalyzing(true);
            try {
              const ids = displayedScreenshots.map((s) => s.id);
              const count = await useScreenshotStore.getState().bulkReanalyzeScreenshots(ids);
              await Promise.all([
                useCategoryStore.getState().loadCategories(),
                loadFolderScreenshots(),
                loadFolderStats(),
              ]);
              Alert.alert('Re-analysis Complete', `Successfully re-analyzed and filed ${count} screenshots.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to re-analyze folder.');
            } finally {
              setIsReanalyzing(false);
            }
          },
        },
      ]
    );
  };

  const renderScreenshotGridItem = ({ item, index }: { item: ScreenshotModel; index: number }) => {
    let itemHeight = 160;
    if (item.width && item.height && item.width > 0) {
      const ratio = item.height / item.width;
      itemHeight = Math.round(Math.max(130, Math.min(220, (COLUMN_WIDTH - 16) * ratio)));
    } else {
      itemHeight = index % 3 === 0 ? 190 : index % 2 === 0 ? 150 : 170;
    }

    const isSelected = selectedIds.has(item.id);

    return (
      <ModernCard
        style={[
          styles.gridCard,
          isSelectMode && isSelected && {
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (isSelectMode) {
              handleToggleSelect(item.id);
            } else {
              navigation.navigate('ScreenshotDetail', { id: item.id });
            }
          }}
          onLongPress={() => {
            if (!isSelectMode) {
              handleStartSelect(item.id);
            } else {
              handleToggleSelect(item.id);
            }
          }}
          style={styles.cardTouch}
          activeOpacity={0.8}
        >
          <View style={styles.thumbWrapper}>
            <ScreenshotImageThumbnail
              screenshot={item}
              filePath={item.filePath}
              localPath={item.localPath}
              contentUri={item.contentUri}
              thumbnailUri={item.thumbnailUri}
              deviceAssetId={item.deviceAssetId}
              style={[styles.thumbnail, { height: itemHeight }]}
              borderRadius={8}
              showLoadingIndicator
            />
            {item.isFavorite && (
              <View style={styles.favBadgeOverlay}>
                <Icon name="heart" size={12} color="#EF4444" />
              </View>
            )}

            {/* Multi-select indicator badge */}
            {isSelectMode && (
              <View style={[styles.selectCheckboxOverlay, isSelected && { backgroundColor: `${theme.colors.primary}30` }]}>
                <Icon
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isSelected ? theme.colors.primary : '#FFFFFF'}
                />
              </View>
            )}
          </View>

          {/* Visual Indicators */}
          <View style={styles.cardBadgesRow}>
            {item.isAutoCategorized ? (
              <View style={[styles.aiBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Icon name="sparkles" size={10} color={theme.colors.primary} style={{ marginRight: 2 }} />
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            ) : (
              <View style={[styles.aiBadge, { backgroundColor: '#64748B20' }]}>
                <Text style={[styles.aiBadgeText, { color: '#64748B' }]}>Manual</Text>
              </View>
            )}

            {item.ocrStatus === 'completed' && (
              <View style={[styles.microBadge, { backgroundColor: '#10B98118' }]}>
                <Icon name="document-text" size={9} color="#10B981" style={{ marginRight: 2 }} />
                <Text style={[styles.microBadgeText, { color: '#10B981' }]}>OCR</Text>
              </View>
            )}

            {Boolean(item.entities || (item.tags && item.tags.length > 0)) && (
              <View style={[styles.microBadge, { backgroundColor: '#8B5CF618' }]}>
                <Icon name="eye" size={9} color="#8B5CF6" style={{ marginRight: 2 }} />
                <Text style={[styles.microBadgeText, { color: '#8B5CF6' }]}>Vision</Text>
              </View>
            )}

            <ConfidenceBadge confidence={item.confidence} showPercent={false} />
          </View>

          <Text numberOfLines={1} style={[styles.itemFileName, { color: theme.colors.textPrimary }]}>
            {item.fileName}
          </Text>

          {item.subcategory ? (
            <View style={styles.subfolderBadge}>
              <Icon name="folder-open-outline" size={11} color={theme.colors.primary} style={{ marginRight: 3 }} />
              <Text numberOfLines={1} style={[styles.subfolderText, { color: theme.colors.primary }]}>
                {item.subcategory}
              </Text>
            </View>
          ) : null}

          {/* Merchant & Amount Chips (Sprint P2-A) */}
          {(getMerchant(item) || getAmount(item)) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {getMerchant(item) ? (
                <View style={[styles.entityMiniChip, { backgroundColor: `${theme.colors.primary}18` }]}>
                  <Icon name="business-outline" size={9} color={theme.colors.primary} style={{ marginRight: 2 }} />
                  <Text numberOfLines={1} style={[styles.entityMiniChipText, { color: theme.colors.primary }]}>
                    {getMerchant(item)}
                  </Text>
                </View>
              ) : null}
              {getAmount(item) ? (
                <View style={[styles.entityMiniChip, { backgroundColor: '#10B98118' }]}>
                  <Text numberOfLines={1} style={[styles.entityMiniChipText, { color: '#10B981' }]}>
                    {getAmount(item)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Tags Chips */}
          {item.tags && item.tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
              {item.tags.slice(0, 2).map((t, idx) => (
                <View key={`${t.id || t.name}_${idx}`} style={[styles.tagMiniChip, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text numberOfLines={1} style={[styles.tagMiniChipText, { color: theme.colors.textSecondary }]}>
                    #{t.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Move button (shown when not in select mode) */}
          {!isSelectMode && (
            <TouchableOpacity
              onPress={() => handleOpenMove(item)}
              style={[styles.moveIconBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              accessibilityLabel="Move to another folder"
            >
              <Icon name="swap-horizontal" size={13} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </ModernCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Top Bar / Selection Bar */}
      {isSelectMode ? (
        <View style={[styles.selectionBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <View style={styles.selectionBarLeft}>
            <TouchableOpacity
              onPress={handleCancelSelect}
              style={[styles.closeSelectBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Exit select mode"
            >
              <Icon name="close" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.selectionCountTitle, { color: theme.colors.textPrimary }]}>
              {selectedIds.size} Selected
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSelectAll}
            style={[styles.selectAllBtn, { backgroundColor: `${theme.colors.primary}18` }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Select or deselect all screenshots"
          >
            <Text style={[styles.selectAllBtnText, { color: theme.colors.primary }]}>
              {selectedIds.size === displayedScreenshots.length && displayedScreenshots.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.titleBox}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
              {categoryName}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {folderScreenshots.length} screenshots
            </Text>
          </View>

          <View style={styles.topActionsRow}>
            {displayedScreenshots.length > 0 && (
              <TouchableOpacity
                onPress={() => handleStartSelect()}
                style={[
                  styles.selectModeBtn,
                  {
                    backgroundColor: `${theme.colors.primary}15`,
                    borderColor: `${theme.colors.primary}30`,
                  },
                ]}
                accessibilityLabel="Enter selection mode"
              >
                <Icon name="checkmark-done" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.selectModeBtnText, { color: theme.colors.primary }]}>Select</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                if (isGuest) {
                  handleRestrictedAction('Context AI Chat');
                  return;
                }
                navigation.navigate('ContextAIChat', { categoryId, categoryName });
              }}
              style={[styles.askAiBtn, { backgroundColor: theme.colors.primary }]}
              accessibilityLabel="Ask Context AI about this folder"
            >
              <Icon name="chatbubbles" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.askAiBtnText}>Ask AI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (isGuest) {
                  handleRestrictedAction('Folder Context');
                  return;
                }
                navigation.navigate('FolderContext', { categoryId, categoryName });
              }}
              style={[styles.aiContextBtn, { backgroundColor: `${theme.colors.primary}20` }]}
              accessibilityLabel="View Living AI Context"
            >
              <Icon name="sparkles" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.aiBtnText, { color: theme.colors.primary }]}>AI Context</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('FolderAnalytics', { categoryId, categoryName })}
              style={[
                styles.analyticsHeaderBtn,
                { backgroundColor: `${theme.colors.accent}18`, borderColor: `${theme.colors.accent}40` },
              ]}
              accessibilityLabel="View Folder Analytics"
            >
              <Icon name="stats-chart-outline" size={15} color={theme.colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReanalyzeFolder}
              disabled={isReanalyzing}
              style={[
                styles.reanalyzeHeaderBtn,
                { backgroundColor: `${theme.colors.primary}18`, borderColor: `${theme.colors.primary}40` },
              ]}
              accessibilityLabel="Re-analyze Folder with Vision AI"
            >
              {isReanalyzing ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Icon name="sparkles" size={15} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Folder Analytics Summary Bar */}
      {folderStats && folderStats.screenshotCount > 0 && (
        <View style={styles.statsSummaryBarContainer}>
          <ModernCard style={styles.statsSummaryCard}>
            <View style={styles.statsSummaryRow}>
              <View style={styles.statSummaryCol}>
                <Text style={[styles.statSummaryValue, { color: theme.colors.textPrimary }]}>
                  {folderStats.screenshotCount}
                </Text>
                <Text style={[styles.statSummaryLabel, { color: theme.colors.textSecondary }]}>
                  Total
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.statSummaryCol}>
                <Text style={[styles.statSummaryValue, { color: '#EF4444' }]}>
                  ★ {folderStats.favoriteCount}
                </Text>
                <Text style={[styles.statSummaryLabel, { color: theme.colors.textSecondary }]}>
                  Starred
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.statSummaryCol}>
                <Text style={[styles.statSummaryValue, { color: '#10B981' }]}>
                  {folderStats.ocrCount}
                </Text>
                <Text style={[styles.statSummaryLabel, { color: theme.colors.textSecondary }]}>
                  OCR
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.statSummaryCol}>
                <Text style={[styles.statSummaryValue, { color: '#8B5CF6' }]}>
                  {folderStats.visionCount}
                </Text>
                <Text style={[styles.statSummaryLabel, { color: theme.colors.textSecondary }]}>
                  Vision
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.statSummaryCol}>
                <Text style={[styles.statSummaryValue, { color: theme.colors.primary }]}>
                  {Math.round(folderStats.averageConfidence * 100)}%
                </Text>
                <Text style={[styles.statSummaryLabel, { color: theme.colors.textSecondary }]}>
                  Conf
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.statSummaryCol}>
                <Text style={[styles.statSummaryValue, { color: theme.colors.textPrimary }]}>
                  {FileUtils.formatBytes(folderStats.storageSizeBytes)}
                </Text>
                <Text style={[styles.statSummaryLabel, { color: theme.colors.textSecondary }]}>
                  Size
                </Text>
              </View>
            </View>
          </ModernCard>
        </View>
      )}

      {/* 2. Search & Sort Bar */}
      <View style={styles.searchAndSortRow}>
        <View
          style={[
            styles.inFolderSearchBar,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon name="search-outline" size={16} color={theme.colors.textSecondary} />
          <TextInput
            placeholder={`Search in ${categoryName}...`}
            placeholderTextColor={theme.colors.textSecondary}
            value={searchInFolder}
            onChangeText={setSearchInFolder}
            style={[styles.inFolderSearchInput, { color: theme.colors.textPrimary }]}
          />
        </View>

        <TouchableOpacity
          onPress={cycleSort}
          style={[
            styles.sortBtn,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
          accessibilityLabel={`Sort by ${getSortLabel(sortOrder)}`}
        >
          <Icon
            name="swap-vertical"
            size={14}
            color={theme.colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.sortBtnText, { color: theme.colors.textPrimary }]}>
            {getSortLabel(sortOrder)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2.5 Quick Filter Chips (All, Favorites, OCR, Vision) */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 6 }}>
        {(
          [
            { id: 'all', label: 'All', icon: 'apps-outline' },
            { id: 'favorites', label: 'Starred', icon: 'star' },
            { id: 'ocr', label: 'OCR', icon: 'document-text-outline' },
            { id: 'vision', label: 'Vision AI', icon: 'sparkles' },
          ] as const
        ).map((qf) => {
          const isSelected = quickFilter === qf.id;
          return (
            <TouchableOpacity
              key={qf.id}
              onPress={() => setQuickFilter(qf.id)}
              style={[
                styles.quickFilterChip,
                {
                  backgroundColor: isSelected ? `${theme.colors.primary}20` : theme.colors.surfaceVariant,
                  borderColor: isSelected ? theme.colors.primary : 'transparent',
                },
              ]}
            >
              <Icon
                name={qf.icon}
                size={12}
                color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.quickFilterChipText,
                  { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                ]}
              >
                {qf.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Subfolder Filter Chips */}
      {distinctSubcategories.length > 0 && (
        <View style={styles.chipsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['all', ...distinctSubcategories]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = selectedSubcat === item;
              const count =
                item === 'all'
                  ? folderScreenshots.length
                  : folderScreenshots.filter(
                      (s) =>
                        s.subcategory.toLowerCase() === item.toLowerCase() ||
                        s.categoryName.toLowerCase() === item.toLowerCase()
                    ).length;

              return (
                <TouchableOpacity
                  onPress={() => setSelectedSubcat(item)}
                  style={[
                    styles.chip,
                    isSelected
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.textSecondary },
                    ]}
                  >
                    {item === 'all' ? 'All' : item} ({count})
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* 4. Screenshots Grid */}
      {displayedScreenshots.length === 0 ? (
        <EmptyStateView
          iconName="folder-open-outline"
          title="No Screenshots in Folder"
          description={
            searchInFolder
              ? 'No screenshots match your search query.'
              : 'New detected screenshots will be filed here automatically by the Smart Folder Engine.'
          }
        />
      ) : (
        <FlatList
          data={displayedScreenshots}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          renderItem={renderScreenshotGridItem}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* 5. Move Screenshot Modal */}
      <Modal
        visible={moveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              {isBulkMove ? `Move ${selectedIds.size} Screenshots` : 'Move Screenshot'}
            </Text>
            <Text numberOfLines={1} style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              {isBulkMove ? 'Select destination smart folder for all selected items' : targetScreenshot?.fileName}
            </Text>

            <Text style={[styles.modalSectionLabel, { color: theme.colors.textSecondary }]}>
              Select Destination Smart Folder:
            </Text>

            <ScrollView style={{ maxHeight: 260 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleExecuteMove(cat.id)}
                  style={[
                    styles.folderSelectRow,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor:
                        cat.id === categoryId
                          ? `${theme.colors.primary}15`
                          : 'transparent',
                    },
                  ]}
                >
                  <Icon
                    name={cat.iconName || 'folder'}
                    size={20}
                    color={cat.colorHex.startsWith('#') ? cat.colorHex : `#${cat.colorHex}`}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectCatName, { color: theme.colors.textPrimary }]}>
                      {cat.name}
                    </Text>
                    <Text style={[styles.selectCatPath, { color: theme.colors.textSecondary }]}>
                      {cat.path || `/${cat.name}`}
                    </Text>
                  </View>
                  {cat.id === categoryId && (
                    <Text style={[styles.currentFolderText, { color: theme.colors.primary }]}>
                      Current
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setMoveModalVisible(false)}
              style={[styles.closeModalBtn, { backgroundColor: theme.isDark ? '#334155' : '#E2E8F0' }]}
            >
              <Text style={[styles.closeModalBtnText, { color: theme.colors.textPrimary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 6. Floating Bulk Action Bar */}
      {isSelectMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onMove={handleOpenBulkMove}
          onFavorite={handleBulkFavorite}
          onDelete={handleBulkDelete}
          onShare={handleBulkShare}
          onCancel={handleCancelSelect}
          isAllFavorite={isAllSelectedFavorite}
        />
      )}

      <GuestUpgradeBottomSheet
        visible={guestModalVisible}
        onDismiss={() => setGuestModalVisible(false)}
        featureName={lockedFeatureName}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  askAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  askAiBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  aiContextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  analyticsHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  searchAndSortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  inFolderSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  inFolderSearchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 13,
    padding: 0,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gridContent: {
    padding: 12,
    paddingBottom: 40,
  },
  gridCard: {
    width: COLUMN_WIDTH,
    margin: 5,
    padding: 8,
    borderRadius: 12,
  },
  cardTouch: {
    position: 'relative',
  },
  thumbWrapper: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    borderRadius: 8,
  },
  favBadgeOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 4,
    borderRadius: 6,
  },
  cardBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1A73E8',
  },
  itemFileName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  subfolderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  subfolderText: {
    fontSize: 10,
    fontWeight: '600',
  },
  moveIconBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  folderSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectCatName: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectCatPath: {
    fontSize: 11,
    marginTop: 1,
  },
  currentFolderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeModalBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeSelectBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectionCountTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  selectModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectCheckboxOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 12,
    padding: 1,
  },
  reanalyzeHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  statsSummaryBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsSummaryCard: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statSummaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  statSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  statSummaryLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 20,
  },
  microBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  microBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  entityMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '48%',
  },
  entityMiniChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tagMiniChip: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    maxWidth: '48%',
  },
  tagMiniChipText: {
    fontSize: 9,
    fontWeight: '500',
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

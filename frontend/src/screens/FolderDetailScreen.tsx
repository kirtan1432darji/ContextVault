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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { smartFolderService } from '../services/SmartFolderService';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { EmptyStateView } from '../components/EmptyStateView';
import { ModernCard } from '../components/ModernCard';
import { ScreenshotModel } from '../models';
import { useAuthStore } from '../store/auth.store';
import { GuestUpgradeBottomSheet } from '../components/GuestUpgradeBottomSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderDetail'>;

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 44) / 2;

export const FolderDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName } = route.params;
  const theme = useAppTheme();

  const allScreenshots = useScreenshotStore((s) => s.screenshots);
  const categories = useCategoryStore((s) => s.categories);

  // Subfolders under this category
  const subcategoriesFromStore = useCategoryStore((s) =>
    s.getSubcategories(categoryId)
  );

  const [selectedSubcat, setSelectedSubcat] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
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

  // All screenshots that belong to this folder or its subcategories
  const folderCategoryIds = useMemo(() => {
    const childIds = categories
      .filter((c) => c.parentId === categoryId || c.parentCategoryId === categoryId)
      .map((c) => c.id);
    return new Set([categoryId, ...childIds]);
  }, [categoryId, categories]);

  const folderScreenshots = useMemo(() => {
    return allScreenshots.filter(
      (s) =>
        folderCategoryIds.has(s.categoryId) ||
        s.categoryName.toLowerCase() === categoryName.toLowerCase()
    );
  }, [allScreenshots, folderCategoryIds, categoryName]);

  // Distinct subcategory tags from screenshots
  const distinctSubcategories = useMemo(() => {
    const fromScreenshots = folderScreenshots
      .map((s) => s.subcategory)
      .filter((sub) => sub && sub.trim().length > 0);
    const fromStore = subcategoriesFromStore.map((c) => c.name);
    return Array.from(new Set([...fromScreenshots, ...fromStore]));
  }, [folderScreenshots, subcategoriesFromStore]);

  // Filtered and sorted screenshots
  const displayedScreenshots = useMemo(() => {
    let result = folderScreenshots;

    // Filter by subfolder
    if (selectedSubcat !== 'all') {
      result = result.filter(
        (s) =>
          s.subcategory.toLowerCase() === selectedSubcat.toLowerCase() ||
          s.categoryName.toLowerCase() === selectedSubcat.toLowerCase()
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

    // Sort by date
    return [...result].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [folderScreenshots, selectedSubcat, searchInFolder, sortOrder]);

  const handleOpenMove = (item: ScreenshotModel) => {
    setTargetScreenshot(item);
    setMoveModalVisible(true);
  };

  const handleExecuteMove = async (targetCategoryId: string) => {
    if (!targetScreenshot) return;
    try {
      await smartFolderService.moveScreenshot(targetScreenshot.id, targetCategoryId);
      setMoveModalVisible(false);
      Alert.alert('Moved', 'Screenshot moved to destination folder.');
    } catch (err: any) {
      Alert.alert('Move Error', err?.message || 'Failed to move screenshot.');
    }
  };

  const renderScreenshotGridItem = ({ item, index }: { item: ScreenshotModel; index: number }) => {
    let itemHeight = 160;
    if (item.width && item.height && item.width > 0) {
      const ratio = item.height / item.width;
      itemHeight = Math.round(Math.max(130, Math.min(220, (COLUMN_WIDTH - 16) * ratio)));
    } else {
      itemHeight = index % 3 === 0 ? 190 : index % 2 === 0 ? 150 : 170;
    }

    return (
      <ModernCard style={styles.gridCard}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
          style={styles.cardTouch}
        >
          <View style={styles.thumbWrapper}>
            <ScreenshotImageThumbnail
              filePath={item.filePath}
              style={[styles.thumbnail, { height: itemHeight }]}
              borderRadius={8}
              showLoadingIndicator
            />
            {item.isFavorite && (
              <View style={styles.favBadgeOverlay}>
                <Icon name="heart" size={12} color="#EF4444" />
              </View>
            )}
          </View>

          {/* Visual Indicators (Feature 12) */}
          <View style={styles.cardBadgesRow}>
            {item.isAutoCategorized ? (
              <View style={[styles.aiBadge, { backgroundColor: '#6366F120' }]}>
                <Icon name="sparkles" size={10} color="#6366F1" style={{ marginRight: 2 }} />
                <Text style={styles.aiBadgeText}>AI Filed</Text>
              </View>
            ) : (
              <View style={[styles.aiBadge, { backgroundColor: '#64748B20' }]}>
                <Text style={[styles.aiBadgeText, { color: '#64748B' }]}>Manual</Text>
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

          {/* Move button */}
          <TouchableOpacity
            onPress={() => handleOpenMove(item)}
            style={[styles.moveIconBtn, { backgroundColor: theme.isDark ? '#334155' : '#F1F5F9' }]}
            accessibilityLabel="Move to another folder"
          >
            <Icon name="swap-horizontal" size={13} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </ModernCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
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
        </View>
      </View>

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
          onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          style={[
            styles.sortBtn,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon
            name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'}
            size={14}
            color={theme.colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.sortBtnText, { color: theme.colors.textPrimary }]}>
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </Text>
        </TouchableOpacity>
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
                      : { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' },
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
              Move Screenshot
            </Text>
            <Text numberOfLines={1} style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              {targetScreenshot?.fileName}
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
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
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
    paddingVertical: 7,
    borderRadius: 10,
  },
  askAiBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  aiContextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    fontWeight: '700',
    color: '#6366F1',
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
});

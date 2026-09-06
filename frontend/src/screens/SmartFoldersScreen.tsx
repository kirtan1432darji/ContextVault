import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useCategoryStore, CategoryTreeNode } from '../store/category.store';
import { smartFolderService } from '../services/SmartFolderService';
import { CategoryModel } from '../models';
import { ModernCard } from '../components/ModernCard';

export const SmartFoldersScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const categories = useCategoryStore((s) => s.categories);
  const expandedFolderIds = useCategoryStore((s) => s.expandedFolderIds);
  const toggleExpandFolder = useCategoryStore((s) => s.toggleExpandFolder);
  const loadCategories = useCategoryStore((s) => s.loadCategories);
  const createFolder = useCategoryStore((s) => s.createFolder);
  const renameFolder = useCategoryStore((s) => s.renameFolder);
  const toggleFavorite = useCategoryStore((s) => s.toggleFavorite);
  const deleteFolder = useCategoryStore((s) => s.deleteFolder);

  const [searchQuery, setSearchQuery] = useState('');
  const [isOrganizing, setIsOrganizing] = useState(false);

  // Folder Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'rename'>('create');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryModel | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleOrganizeUnsorted = async () => {
    setIsOrganizing(true);
    try {
      const count = await smartFolderService.organizeAllUnsorted();
      await loadCategories();
      Alert.alert('Smart Folders Updated', `Organized ${count} screenshots into smart folders.`);
    } catch (err: any) {
      Alert.alert('Organization Error', err?.message || 'Failed to organize screenshots.');
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleOpenCreateModal = (parentId: string | null = null) => {
    setModalMode('create');
    setSelectedParentId(parentId);
    setFolderNameInput('');
    setModalVisible(true);
  };

  const handleOpenRenameModal = (cat: CategoryModel) => {
    setModalMode('rename');
    setSelectedCategory(cat);
    setFolderNameInput(cat.name);
    setModalVisible(true);
  };

  const handleSaveModal = async () => {
    const trimmed = folderNameInput.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a folder name.');
      return;
    }

    try {
      if (modalMode === 'create') {
        await createFolder(trimmed, selectedParentId);
        Alert.alert('Folder Created', `Created folder '${trimmed}'.`);
      } else if (modalMode === 'rename' && selectedCategory) {
        await renameFolder(selectedCategory.id, trimmed);
        Alert.alert('Folder Renamed', `Renamed to '${trimmed}'.`);
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Operation failed.');
    }
  };

  const handleDeleteFolder = (cat: CategoryModel) => {
    if (cat.isSystem) {
      Alert.alert('System Folder', 'System default folders cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete '${cat.name}'? Any screenshots inside will be moved to Unsorted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteFolder(cat.id);
          },
        },
      ]
    );
  };

  // Build tree from store
  const treeNodes = useCategoryStore.getState().getCategoryTree();

  // Recursive tree node renderer
  const renderTreeNode = (node: CategoryTreeNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedFolderIds.includes(node.id) || searchQuery.trim().length > 0;
    const hex = node.colorHex.startsWith('#') ? node.colorHex : `#${node.colorHex}`;
    const matchesSearch =
      searchQuery.trim().length === 0 ||
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.path && node.path.toLowerCase().includes(searchQuery.toLowerCase()));

    const indentPadding = node.level * 20;

    return (
      <View key={node.id} style={styles.nodeWrapper}>
        {matchesSearch && (
          <ModernCard
            style={[
              styles.folderCard,
              {
                marginLeft: indentPadding,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.cardMainRow}>
              {/* Expand/Collapse Chevron */}
              {hasChildren ? (
                <TouchableOpacity
                  onPress={() => toggleExpandFolder(node.id)}
                  style={styles.chevronBtn}
                >
                  <Icon
                    name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.chevronPlaceholder} />
              )}

              {/* Folder Icon */}
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('FolderDetail', {
                    categoryId: node.id,
                    categoryName: node.name,
                  })
                }
                style={[styles.iconBox, { backgroundColor: `${hex}18` }]}
              >
                <Icon name={node.iconName || 'folder'} size={22} color={hex} />
              </TouchableOpacity>

              {/* Folder Details */}
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('FolderDetail', {
                    categoryId: node.id,
                    categoryName: node.name,
                  })
                }
                style={styles.folderTextContainer}
              >
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={[styles.folderName, { color: theme.colors.textPrimary }]}>
                    {node.name}
                  </Text>
                  {node.isFavorite && (
                    <Icon name="star" size={14} color="#F59E0B" style={{ marginLeft: 6 }} />
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.folderPath, { color: theme.colors.textSecondary }]}>
                  {node.path || `/${node.name}`}
                </Text>
              </TouchableOpacity>

              {/* Count Badge */}
              <View style={[styles.countBadge, { backgroundColor: `${theme.colors.primary}15` }]}>
                <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                  {node.screenshotCount || 0}
                </Text>
              </View>

              {/* Actions Menu */}
              <View style={styles.actionIcons}>
                <TouchableOpacity
                  onPress={() => toggleFavorite(node.id)}
                  style={styles.miniActionBtn}
                >
                  <Icon
                    name={node.isFavorite ? 'star' : 'star-outline'}
                    size={16}
                    color={node.isFavorite ? '#F59E0B' : theme.colors.textSecondary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOpenCreateModal(node.id)}
                  style={styles.miniActionBtn}
                >
                  <Icon name="add-circle-outline" size={16} color={theme.colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOpenRenameModal(node)}
                  style={styles.miniActionBtn}
                >
                  <Icon name="create-outline" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                {!node.isSystem && (
                  <TouchableOpacity
                    onPress={() => handleDeleteFolder(node)}
                    style={styles.miniActionBtn}
                  >
                    <Icon name="trash-outline" size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ModernCard>
        )}

        {/* Recursive render child nodes if expanded */}
        {hasChildren && isExpanded && (
          <View style={styles.childrenContainer}>
            {node.children.map((child) => renderTreeNode(child))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Smart Folders
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Dynamic, multi-tier knowledge collections
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleOpenCreateModal(null)}
            style={[styles.addRootBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Icon name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addRootBtnText}>New Folder</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon name="search-outline" size={18} color={theme.colors.textSecondary} />
          <TextInput
            placeholder="Search folders and subcategories..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Organize Unsorted Quick Bar */}
        <View style={styles.quickBar}>
          <TouchableOpacity
            onPress={handleOrganizeUnsorted}
            disabled={isOrganizing}
            style={[styles.organizeBtn, { backgroundColor: `${theme.colors.primary}15` }]}
          >
            {isOrganizing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Icon name="sparkles" size={15} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.organizeBtnText, { color: theme.colors.primary }]}>
                  Auto-Organize Unsorted Screenshots
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Hierarchical Category Tree */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {treeNodes.length === 0 ? (
          <ModernCard style={styles.emptyCard}>
            <Icon name="folder-open-outline" size={44} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
              No Smart Folders Found
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Tap 'New Folder' to create your first folder or import screenshots.
            </Text>
          </ModernCard>
        ) : (
          treeNodes.map((rootNode) => renderTreeNode(rootNode))
        )}
      </ScrollView>

      {/* 3. Create / Rename Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              {modalMode === 'create' ? 'Create Smart Folder' : 'Rename Folder'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              {selectedParentId
                ? `Under parent: ${categories.find((c) => c.id === selectedParentId)?.name || 'Root'}`
                : 'Root category folder'}
            </Text>

            <TextInput
              value={folderNameInput}
              onChangeText={setFolderNameInput}
              placeholder="Folder Name (e.g. Payroll, Flutter, Shoes)"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
              style={[
                styles.modalInput,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC',
                },
              ]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveModal}
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addRootBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addRootBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    padding: 0,
  },
  quickBar: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  organizeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  organizeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  nodeWrapper: {
    marginBottom: 8,
  },
  folderCard: {
    padding: 12,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  chevronPlaceholder: {
    width: 24,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  folderTextContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderName: {
    fontSize: 14,
    fontWeight: '700',
  },
  folderPath: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniActionBtn: {
    padding: 5,
    marginLeft: 2,
  },
  childrenContainer: {
    marginTop: 6,
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
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
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
  },
  modalSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

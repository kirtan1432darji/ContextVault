import { create } from 'zustand';
import { CategoryModel, FolderStatistics, DEFAULT_CATEGORIES } from '../models';
import { categoryRepository } from '../database/repositories/categoryRepository';

export interface CategoryTreeNode extends CategoryModel {
  children: CategoryTreeNode[];
  level: number;
}

interface CategoryState {
  categories: CategoryModel[];
  selectedCategoryId: string | null;
  expandedFolderIds: string[];
  folderSortBy: 'count' | 'recent';
  isLoading: boolean;
  error: string | null;

  folderStats: Record<string, FolderStatistics>;

  // Actions
  setCategories: (categories: CategoryModel[]) => void;
  setFolderSortBy: (sort: 'count' | 'recent') => void;
  loadCategories: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  selectCategory: (categoryId: string | null) => void;
  setCategoryCount: (categoryId: string, count: number) => void;
  toggleExpandFolder: (id: string) => void;
  updateFolderCover: (folderId: string, coverUri: string) => Promise<void>;
  updateFolderCounts: (folderId: string) => Promise<void>;
  rebuildSmartFolders: () => Promise<void>;
  getFolderStats: (folderId: string) => Promise<FolderStatistics>;
  loadFolderStats: (folderId: string) => Promise<FolderStatistics>;

  // Manual folder management
  createFolder: (
    name: string,
    parentId?: string | null,
    iconName?: string,
    colorHex?: string
  ) => Promise<CategoryModel>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  moveFolder: (id: string, newParentId: string | null) => Promise<void>;
  mergeFolders: (sourceId: string, targetId: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<void>;

  // Getters
  getCategoryById: (id: string) => CategoryModel | undefined;
  getRootCategories: () => CategoryModel[];
  getSubcategories: (parentId: string) => CategoryModel[];
  getDescendantCategoryIds: (categoryId: string) => string[];
  getCategoryTree: () => CategoryTreeNode[];
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: DEFAULT_CATEGORIES,
  selectedCategoryId: null,
  expandedFolderIds: [],
  folderSortBy: 'count',
  isLoading: false,
  error: null,
  folderStats: {},

  setCategories: (categories: CategoryModel[]) => set({ categories }),

  setFolderSortBy: (sort: 'count' | 'recent') => set({ folderSortBy: sort }),

  loadCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const cats = await categoryRepository.getAllCategories();
      set({ categories: cats, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load categories', isLoading: false });
    }
  },

  refreshCategories: async () => {
    return get().loadCategories();
  },

  selectCategory: (categoryId: string | null) => set({ selectedCategoryId: categoryId }),

  setCategoryCount: (categoryId: string, count: number) => {
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === categoryId ? { ...c, screenshotCount: count } : c
      ),
    }));
  },

  toggleExpandFolder: (id: string) => {
    const current = get().expandedFolderIds;
    if (current.includes(id)) {
      set({ expandedFolderIds: current.filter((item) => item !== id) });
    } else {
      set({ expandedFolderIds: [...current, id] });
    }
  },

  updateFolderCover: async (folderId: string, coverUri: string) => {
    await categoryRepository.updateFolderCover(folderId, coverUri, true);
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === folderId ? { ...c, coverUri, manualCoverUri: coverUri } : c
      ),
    }));
  },

  updateFolderCounts: async (folderId: string) => {
    await categoryRepository.updateFolderCounts(folderId);
    const all = await categoryRepository.getAllCategories();
    set({ categories: all });
  },

  rebuildSmartFolders: async () => {
    set({ isLoading: true });
    try {
      await categoryRepository.rebuildSmartFolders();
      const all = await categoryRepository.getAllCategories();
      set({ categories: all, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to rebuild folders', isLoading: false });
    }
  },

  getFolderStats: async (folderId: string) => {
    return categoryRepository.getFolderStatistics(folderId);
  },

  loadFolderStats: async (folderId: string) => {
    const stats = await categoryRepository.getFolderStatistics(folderId);
    set((state) => ({
      folderStats: {
        ...state.folderStats,
        [folderId]: stats,
      },
    }));
    return stats;
  },

  createFolder: async (name, parentId = null, iconName = 'folder-outline', colorHex = '6366F1') => {
    const newCat = await categoryRepository.getOrCreateCategory({
      name,
      parentId,
      iconName,
      colorHex,
      isSystem: false,
    });
    const all = await categoryRepository.getAllCategories();
    set({ categories: all });
    return newCat;
  },

  renameFolder: async (id: string, newName: string) => {
    await categoryRepository.renameCategory(id, newName);
    const all = await categoryRepository.getAllCategories();
    set({ categories: all });
  },

  moveFolder: async (id: string, newParentId: string | null) => {
    await categoryRepository.moveCategory(id, newParentId);
    const all = await categoryRepository.getAllCategories();
    set({ categories: all });
  },

  mergeFolders: async (sourceId: string, targetId: string) => {
    await categoryRepository.mergeCategories(sourceId, targetId);
    const all = await categoryRepository.getAllCategories();
    set({ categories: all });
  },

  toggleFavorite: async (id: string) => {
    const isFav = await categoryRepository.toggleFavorite(id);
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, isFavorite: isFav } : c
      ),
    }));
    return isFav;
  },

  deleteFolder: async (id: string) => {
    await categoryRepository.deleteCategory(id);
    const all = await categoryRepository.getAllCategories();
    set({ categories: all });
  },

  getCategoryById: (id: string) => {
    return get().categories.find((c) => c.id === id);
  },

  getRootCategories: () => {
    return get().categories.filter((c) => !c.parentId || c.parentId.trim() === '');
  },

  getSubcategories: (parentId: string) => {
    return get().categories.filter(
      (c) => c.parentId === parentId || c.parentCategoryId === parentId
    );
  },

  getDescendantCategoryIds: (categoryId: string) => {
    const all = get().categories;
    const result: string[] = [categoryId];
    const queue: string[] = [categoryId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = all.filter(
        (c) =>
          (c.parentId === current || c.parentCategoryId === current) &&
          !result.includes(c.id)
      );
      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }
    return result;
  },

  getCategoryTree: () => {
    const all = get().categories;

    const buildNodes = (parentId: string | null = null, level = 0): CategoryTreeNode[] => {
      const children = all.filter((c) =>
        parentId === null
          ? !c.parentId || c.parentId.trim() === ''
          : c.parentId === parentId || c.parentCategoryId === parentId
      );

      return children.map((c) => ({
        ...c,
        level,
        children: buildNodes(c.id, level + 1),
      }));
    };

    return buildNodes(null, 0);
  },
}));

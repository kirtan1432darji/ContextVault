import { create } from 'zustand';
import { ScreenshotModel, ScreenshotFilter } from '../models';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { recycleBinService } from '../services/recycleBinService';

interface ScreenshotState {
  screenshots: ScreenshotModel[];
  favorites: ScreenshotModel[];
  needsReviewList: ScreenshotModel[];
  selectedScreenshot: ScreenshotModel | null;
  isLoading: boolean;
  isRefreshing: boolean;
  filter: ScreenshotFilter;
  hasMore: boolean;
  error: string | null;

  // Actions
  setScreenshots: (items: ScreenshotModel[]) => void;
  appendScreenshots: (items: ScreenshotModel[]) => void;
  setSelectedScreenshot: (screenshot: ScreenshotModel | null) => void;
  setFilter: (filter: Partial<ScreenshotFilter>) => void;
  setLoading: (isLoading: boolean) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setError: (error: string | null) => void;
  addOrUpdateScreenshot: (screenshot: ScreenshotModel) => void;
  toggleFavoriteLocal: (id: string) => void;
  markReviewedLocal: (id: string) => void;
  updateCategoryLocal: (id: string, categoryId: string, categoryName: string, subcategory?: string) => void;
  deleteScreenshotLocal: (id: string) => void;
  loadScreenshots: () => Promise<void>;

  // Recycle Bin Actions
  recycleBinScreenshots: ScreenshotModel[];
  loadRecycleBin: () => Promise<void>;
  softDeleteScreenshot: (id: string) => Promise<void>;
  restoreScreenshot: (id: string) => Promise<void>;
  restoreAllScreenshots: () => Promise<number>;
  permanentDeleteScreenshot: (id: string) => Promise<void>;
  emptyRecycleBin: () => Promise<number>;

  // Bulk Actions
  bulkSetFavorite: (ids: string[], isFavorite: boolean) => Promise<number>;
  bulkSoftDelete: (ids: string[]) => Promise<number>;
  bulkMoveScreenshots: (ids: string[], targetFolderId: string) => Promise<number>;
  bulkReanalyzeScreenshots: (ids: string[]) => Promise<number>;
  restoreAIClassification: (id: string) => Promise<void>;

  // Smart Folder Classification Actions
  updateClassification: (screenshotId: string, updates: Partial<ScreenshotModel>) => void;
  refreshScreenshot: (id: string) => Promise<ScreenshotModel | null>;
  batchUpdateCategories: (ids: string[], categoryId: string, categoryName: string, subcategory?: string) => Promise<number>;
}

export const useScreenshotStore = create<ScreenshotState>((set, get) => ({
  screenshots: [],
  recycleBinScreenshots: [],
  favorites: [],
  needsReviewList: [],
  selectedScreenshot: null,
  isLoading: false,
  isRefreshing: false,
  filter: { limit: 30, offset: 0 },
  hasMore: true,
  error: null,

  setScreenshots: (items: ScreenshotModel[]) => {
    const favorites = items.filter((s) => s.isFavorite);
    const needsReviewList = items.filter(
      (s) => !s.isReviewed && (s.confidence < 0.7 || s.categoryId === 'unsorted')
    );
    set({ screenshots: items, favorites, needsReviewList });
  },

  appendScreenshots: (items: ScreenshotModel[]) => {
    const existing = get().screenshots;
    const existingIds = new Set(existing.map((s) => s.id));
    const fresh = items.filter((s) => !existingIds.has(s.id));
    const combined = [...existing, ...fresh];

    const favorites = combined.filter((s) => s.isFavorite);
    const needsReviewList = combined.filter(
      (s) => !s.isReviewed && (s.confidence < 0.7 || s.categoryId === 'unsorted')
    );
    set({
      screenshots: combined,
      favorites,
      needsReviewList,
      hasMore: items.length >= (get().filter.limit || 30),
    });
  },

  setSelectedScreenshot: (screenshot: ScreenshotModel | null) => {
    set({ selectedScreenshot: screenshot });
  },

  setFilter: (newFilter: Partial<ScreenshotFilter>) => {
    set((state) => ({ filter: { ...state.filter, ...newFilter } }));
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setRefreshing: (isRefreshing: boolean) => set({ isRefreshing }),
  setError: (error: string | null) => set({ error }),

  addOrUpdateScreenshot: (screenshot: ScreenshotModel) => {
    const list = [...get().screenshots];
    const index = list.findIndex((s) => s.id === screenshot.id);
    if (index >= 0) {
      list[index] = screenshot;
    } else {
      list.unshift(screenshot);
    }

    const favorites = list.filter((s) => s.isFavorite);
    const needsReviewList = list.filter(
      (s) => !s.isReviewed && (s.confidence < 0.7 || s.categoryId === 'unsorted')
    );

    set({
      screenshots: list,
      favorites,
      needsReviewList,
      selectedScreenshot:
        get().selectedScreenshot?.id === screenshot.id
          ? screenshot
          : get().selectedScreenshot,
    });
  },

  toggleFavoriteLocal: (id: string) => {
    const list = get().screenshots.map((s) =>
      s.id === id ? { ...s, isFavorite: !s.isFavorite } : s
    );
    const favorites = list.filter((s) => s.isFavorite);
    set({
      screenshots: list,
      favorites,
      selectedScreenshot:
        get().selectedScreenshot?.id === id
          ? { ...get().selectedScreenshot!, isFavorite: !get().selectedScreenshot!.isFavorite }
          : get().selectedScreenshot,
    });
  },

  markReviewedLocal: (id: string) => {
    const list = get().screenshots.map((s) =>
      s.id === id ? { ...s, isReviewed: true } : s
    );
    const needsReviewList = list.filter(
      (s) => !s.isReviewed && (s.confidence < 0.7 || s.categoryId === 'unsorted')
    );
    set({
      screenshots: list,
      needsReviewList,
      selectedScreenshot:
        get().selectedScreenshot?.id === id
          ? { ...get().selectedScreenshot!, isReviewed: true }
          : get().selectedScreenshot,
    });
  },

  updateCategoryLocal: (
    id: string,
    categoryId: string,
    categoryName: string,
    subcategory = ''
  ) => {
    const list = get().screenshots.map((s) =>
      s.id === id
        ? {
            ...s,
            categoryId,
            categoryName,
            subcategory,
            isReviewed: true,
          }
        : s
    );
    const needsReviewList = list.filter(
      (s) => !s.isReviewed && (s.confidence < 0.7 || s.categoryId === 'unsorted')
    );
    set({
      screenshots: list,
      needsReviewList,
      selectedScreenshot:
        get().selectedScreenshot?.id === id
          ? {
              ...get().selectedScreenshot!,
              categoryId,
              categoryName,
              subcategory,
              isReviewed: true,
            }
          : get().selectedScreenshot,
    });
  },

  deleteScreenshotLocal: (id: string) => {
    const list = get().screenshots.filter((s) => s.id !== id);
    const favorites = list.filter((s) => s.isFavorite);
    const needsReviewList = list.filter(
      (s) => !s.isReviewed && (s.confidence < 0.7 || s.categoryId === 'unsorted')
    );
    set({
      screenshots: list,
      favorites,
      needsReviewList,
      selectedScreenshot:
        get().selectedScreenshot?.id === id ? null : get().selectedScreenshot,
    });
  },

  loadScreenshots: async () => {
    try {
      const items = await screenshotRepository.getAllScreenshots();
      if (items) {
        get().setScreenshots(items);
      }
    } catch (err: any) {
      console.warn('[ScreenshotStore] Failed to load screenshots from DB:', err?.message);
    }
  },

  loadRecycleBin: async () => {
    try {
      const items = await recycleBinService.getDeletedScreenshots();
      set({ recycleBinScreenshots: items });
    } catch (err: any) {
      console.warn('[ScreenshotStore] Failed to load recycle bin:', err?.message);
    }
  },

  softDeleteScreenshot: async (id: string) => {
    await recycleBinService.softDeleteScreenshot(id);
    get().deleteScreenshotLocal(id);
    await get().loadRecycleBin();
  },

  restoreScreenshot: async (id: string) => {
    await recycleBinService.restoreScreenshot(id);
    await Promise.all([get().loadScreenshots(), get().loadRecycleBin()]);
  },

  restoreAllScreenshots: async () => {
    const count = await recycleBinService.restoreAll();
    await Promise.all([get().loadScreenshots(), get().loadRecycleBin()]);
    return count;
  },

  permanentDeleteScreenshot: async (id: string) => {
    await recycleBinService.permanentDelete(id);
    set((state) => ({
      recycleBinScreenshots: state.recycleBinScreenshots.filter((s) => s.id !== id),
    }));
  },

  emptyRecycleBin: async () => {
    const count = await recycleBinService.emptyRecycleBin();
    set({ recycleBinScreenshots: [] });
    return count;
  },

  bulkSetFavorite: async (ids: string[], isFavorite: boolean) => {
    if (!ids || ids.length === 0) return 0;
    const count = await screenshotRepository.bulkSetFavorite(ids, isFavorite);
    const idSet = new Set(ids);
    const list = get().screenshots.map((s) =>
      idSet.has(s.id) ? { ...s, isFavorite } : s
    );
    get().setScreenshots(list);
    return count;
  },

  bulkSoftDelete: async (ids: string[]) => {
    if (!ids || ids.length === 0) return 0;
    const count = await recycleBinService.bulkSoftDelete(ids);
    const idSet = new Set(ids);
    const list = get().screenshots.filter((s) => !idSet.has(s.id));
    get().setScreenshots(list);
    await get().loadRecycleBin();
    return count;
  },

  bulkMoveScreenshots: async (ids: string[], targetFolderId: string) => {
    if (!ids || ids.length === 0) return 0;
    const { categoryRepository } = await import('../database/repositories/categoryRepository');
    const { useCategoryStore } = await import('./category.store');

    for (const id of ids) {
      await categoryRepository.moveScreenshot(id, targetFolderId);
    }

    await get().loadScreenshots();
    await useCategoryStore.getState().loadCategories();
    return ids.length;
  },

  bulkReanalyzeScreenshots: async (ids: string[]) => {
    if (!ids || ids.length === 0) return 0;
    const { smartFolderClassificationService } = await import('../services/SmartFolderClassificationService');
    const { useCategoryStore } = await import('./category.store');

    const targetScreenshots = get().screenshots.filter((s) => ids.includes(s.id));
    for (const sc of targetScreenshots) {
      await smartFolderClassificationService.assignScreenshotToSmartFolder({
        screenshotId: sc.id,
        fileName: sc.fileName,
        filePath: sc.filePath,
        localPath: sc.localPath,
        contentUri: sc.contentUri,
        thumbnailUri: sc.thumbnailUri,
        ocrText: sc.ocrText,
        fileSize: sc.fileSize,
        forceRefresh: true,
      });
    }

    await get().loadScreenshots();
    await useCategoryStore.getState().loadCategories();
    return ids.length;
  },

  restoreAIClassification: async (id: string) => {
    const { smartFolderClassificationService } = await import('../services/SmartFolderClassificationService');
    const { useCategoryStore } = await import('./category.store');
    await smartFolderClassificationService.restoreAIClassification(id);
    await get().loadScreenshots();
    await useCategoryStore.getState().loadCategories();
  },

  updateClassification: (screenshotId: string, updates: Partial<ScreenshotModel>) => {
    const list = get().screenshots.map((s) => {
      if (s.id === screenshotId) {
        return {
          ...s,
          ...updates,
          categoryId: updates.categoryId || s.categoryId,
          categoryName: updates.categoryName || s.categoryName,
          confidence: updates.confidence !== undefined ? updates.confidence : s.confidence,
        };
      }
      return s;
    });

    const favorites = list.filter((s) => s.isFavorite);
    const needsReviewList = list.filter(
      (s) => !s.isReviewed && (s.confidence < 0.7 || s.categoryId === 'unsorted')
    );

    set({
      screenshots: list,
      favorites,
      needsReviewList,
      selectedScreenshot:
        get().selectedScreenshot?.id === screenshotId
          ? { ...get().selectedScreenshot!, ...updates }
          : get().selectedScreenshot,
    });
  },

  refreshScreenshot: async (id: string) => {
    try {
      const item = await screenshotRepository.getScreenshotById(id);
      if (item) {
        get().addOrUpdateScreenshot(item);
        return item;
      }
    } catch (err: any) {
      console.warn('[ScreenshotStore] Failed to refresh screenshot:', err?.message);
    }
    return null;
  },

  batchUpdateCategories: async (
    ids: string[],
    categoryId: string,
    categoryName: string,
    subcategory = ''
  ) => {
    const count = await screenshotRepository.bulkUpdateCategory(ids, categoryId, categoryName, subcategory);
    const idSet = new Set(ids);
    const list = get().screenshots.map((s) =>
      idSet.has(s.id)
        ? {
            ...s,
            categoryId,
            categoryName,
            subcategory,
            isAutoCategorized: false,
            classificationSource: 'manual' as const,
            isReviewed: true,
          }
        : s
    );
    get().setScreenshots(list);
    return count;
  },
}));

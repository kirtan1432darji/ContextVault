import { create } from 'zustand';
import { FolderContextModel, createEmptyFolderContext } from '../models';
import {
  folderContextRepository,
  classificationCacheRepository,
} from '../database/repositories';

interface FolderContextState {
  contexts: Record<string, FolderContextModel>;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  contextsGeneratedToday: number;
  aiSyncedToday: number;
  recentlyUpdatedContexts: FolderContextModel[];

  // Actions
  setFolderContext: (categoryId: string, context: FolderContextModel) => void;
  setGenerating: (isGenerating: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  getFolderContext: (categoryId: string, categoryName?: string) => FolderContextModel;
  toggleTaskCompleted: (categoryId: string, taskId: string) => void;
  setContextsGeneratedToday: (count: number) => void;
  setAiSyncedToday: (count: number) => void;
  loadStatsAndRecents: () => Promise<void>;
}

export const useFolderContextStore = create<FolderContextState>((set, get) => ({
  contexts: {},
  isGenerating: false,
  isLoading: false,
  error: null,
  contextsGeneratedToday: 0,
  aiSyncedToday: 0,
  recentlyUpdatedContexts: [],

  setFolderContext: (categoryId: string, context: FolderContextModel) => {
    set((state) => {
      const updated = {
        ...state.contexts,
        [categoryId]: context,
      };
      // Keep recently updated in sync
      const recent = Object.values(updated)
        .filter((c) => c.lastUpdatedAt)
        .sort((a, b) => new Date(b.lastUpdatedAt || 0).getTime() - new Date(a.lastUpdatedAt || 0).getTime())
        .slice(0, 6);

      return {
        contexts: updated,
        recentlyUpdatedContexts: recent,
        contextsGeneratedToday: state.contextsGeneratedToday + 1,
      };
    });
  },

  setGenerating: (isGenerating: boolean) => set({ isGenerating }),
  setLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (error: string | null) => set({ error }),

  getFolderContext: (categoryId: string, categoryName = 'Folder') => {
    return (
      get().contexts[categoryId] ||
      createEmptyFolderContext(categoryId, categoryName)
    );
  },

  toggleTaskCompleted: (categoryId: string, taskId: string) => {
    const existing = get().contexts[categoryId];
    if (!existing) return;

    const updatedTasks = existing.tasks.map((task) =>
      task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
    );

    set((state) => ({
      contexts: {
        ...state.contexts,
        [categoryId]: {
          ...existing,
          tasks: updatedTasks,
        },
      },
    }));
  },

  setContextsGeneratedToday: (count: number) => set({ contextsGeneratedToday: count }),
  setAiSyncedToday: (count: number) => set({ aiSyncedToday: count }),

  loadStatsAndRecents: async () => {
    try {
      const [genCount, syncCount, recents] = await Promise.all([
        folderContextRepository.getContextsGeneratedTodayCount(),
        classificationCacheRepository.getTodaySyncedCount(),
        folderContextRepository.getRecentlyUpdated(6),
      ]);

      const mappedRecents: FolderContextModel[] = recents.map((r) => {
        let tasks = [];
        try {
          if (r.TasksJson) tasks = JSON.parse(r.TasksJson);
        } catch {}
        return {
          categoryId: r.FolderId,
          categoryName: r.FolderId,
          summary: r.Summary,
          keywords: [],
          confidence: 0.95,
          screenshotCount: 0,
          lastUpdatedAt: r.UpdatedOn,
          tasks,
          entities: [],
          people: [],
          links: [],
          dates: [],
          apps: [],
          topics: [],
          timeline: [],
        };
      });

      set({
        contextsGeneratedToday: genCount,
        aiSyncedToday: syncCount,
        recentlyUpdatedContexts: mappedRecents,
      });
    } catch (e) {
      console.warn('[useFolderContextStore] Failed to load stats:', e);
    }
  },
}));

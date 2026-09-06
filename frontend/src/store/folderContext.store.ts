import { create } from 'zustand';
import { FolderContextModel, createEmptyFolderContext } from '../models';

interface FolderContextState {
  contexts: Record<string, FolderContextModel>;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setFolderContext: (categoryId: string, context: FolderContextModel) => void;
  setGenerating: (isGenerating: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  getFolderContext: (categoryId: string, categoryName?: string) => FolderContextModel;
  toggleTaskCompleted: (categoryId: string, taskId: string) => void;
}

export const useFolderContextStore = create<FolderContextState>((set, get) => ({
  contexts: {},
  isGenerating: false,
  isLoading: false,
  error: null,

  setFolderContext: (categoryId: string, context: FolderContextModel) => {
    set((state) => ({
      contexts: {
        ...state.contexts,
        [categoryId]: context,
      },
    }));
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
}));

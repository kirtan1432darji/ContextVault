import { create } from 'zustand';
import { VisionApiKeyEntry, VisionInferenceResult, VisionQueueItem } from '../vision/types';
import { visionModelManager } from '../vision/VisionModelManager';
import { visionRepository } from '../database/repositories/VisionRepository';

interface VisionState {
  isProcessing: boolean;
  queueLength: number;
  currentProcessingItem: VisionQueueItem | null;
  completedToday: number;
  failedToday: number;
  avgProcessingTimeMs: number;
  lastResult: VisionInferenceResult | null;
  apiKeys: VisionApiKeyEntry[];

  // Actions
  setIsProcessing: (isProcessing: boolean) => void;
  setQueueLength: (queueLength: number) => void;
  setCurrentProcessingItem: (item: VisionQueueItem | null) => void;
  setLastResult: (result: VisionInferenceResult | null) => void;
  recordSuccess: (timeMs: number) => void;
  recordFailure: () => void;
  loadInitialStats: () => Promise<void>;
  refreshApiKeys: () => void;
}

export const useVisionStore = create<VisionState>((set, get) => ({
  isProcessing: false,
  queueLength: 0,
  currentProcessingItem: null,
  completedToday: 0,
  failedToday: 0,
  avgProcessingTimeMs: 0,
  lastResult: null,
  apiKeys: visionModelManager.getApiKeys(),

  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setQueueLength: (queueLength) => set({ queueLength }),
  setCurrentProcessingItem: (currentProcessingItem) => set({ currentProcessingItem }),
  setLastResult: (lastResult) => set({ lastResult }),

  recordSuccess: (timeMs: number) => {
    const { completedToday, avgProcessingTimeMs } = get();
    const newCompleted = completedToday + 1;
    const newAvg =
      completedToday === 0
        ? timeMs
        : Math.round((avgProcessingTimeMs * completedToday + timeMs) / newCompleted);

    set({
      completedToday: newCompleted,
      avgProcessingTimeMs: newAvg,
    });
  },

  recordFailure: () => {
    set((state) => ({ failedToday: state.failedToday + 1 }));
  },

  loadInitialStats: async () => {
    try {
      const stats = await visionRepository.getStats();
      set({
        completedToday: stats.todayCount,
        apiKeys: visionModelManager.getApiKeys(),
      });
    } catch {
      // Ignored during startup
    }
  },

  refreshApiKeys: () => {
    set({ apiKeys: visionModelManager.getApiKeys() });
  },
}));

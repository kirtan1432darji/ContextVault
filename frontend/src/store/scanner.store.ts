import { create } from 'zustand';

interface ScannerState {
  isScanning: boolean;
  progress: number; // 0 to 1
  currentItem: string;
  totalCount: number;
  processedCount: number;
  newlyOrganizedCount: number;
  error: string | null;

  // Actions
  startScan: (total?: number) => void;
  updateProgress: (progress: number, currentItem: string, processed: number, total: number) => void;
  finishScan: (newlyOrganized: number) => void;
  cancelScan: () => void;
  setError: (error: string | null) => void;
}

export const useScannerStore = create<ScannerState>((set) => ({
  isScanning: false,
  progress: 0,
  currentItem: '',
  totalCount: 0,
  processedCount: 0,
  newlyOrganizedCount: 0,
  error: null,

  startScan: (total = 0) =>
    set({
      isScanning: true,
      progress: 0,
      currentItem: 'Scanning device media...',
      totalCount: total,
      processedCount: 0,
      newlyOrganizedCount: 0,
      error: null,
    }),

  updateProgress: (progress: number, currentItem: string, processed: number, total: number) =>
    set({
      progress,
      currentItem,
      processedCount: processed,
      totalCount: total,
    }),

  finishScan: (newlyOrganized: number) =>
    set({
      isScanning: false,
      progress: 1,
      currentItem: 'Scan completed',
      newlyOrganizedCount: newlyOrganized,
    }),

  cancelScan: () =>
    set({
      isScanning: false,
      currentItem: 'Scan cancelled',
    }),

  setError: (error: string | null) =>
    set({
      isScanning: false,
      error,
    }),
}));

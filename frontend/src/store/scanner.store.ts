import { create } from 'zustand';
import { StoragePermissionStatus, permissionService } from '../services/permissionService';

export interface DetectedScreenshotMetadata {
  id: string;
  deviceAssetId: string;
  filePath: string;
  localPath?: string;
  contentUri?: string;
  thumbnailUri?: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  capturedAt: string;
  status?: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  width?: number;
  height?: number;
  deviceFolder?: string;
  mimeType?: string;
}

export interface LastOCRResultSummary {
  screenshotId: string;
  fileName: string;
  rawText: string;
  confidence: number;
  processingTimeMs: number;
  language: string;
  blocksCount: number;
  processedAt: string;
}

interface ScannerState {
  // Sprint RN-03 Detection Engine State
  isListening: boolean;
  scannedToday: number;
  pendingProcessing: number;
  lastScreenshot: DetectedScreenshotMetadata | null;
  permissionStatus: StoragePermissionStatus;

  // Sprint P2-C Vision AI State
  analysisCompletedToday: number;
  analysisPending: number;
  analysisFailed: number;
  avgAnalysisTimeMs: number;
  lastAnalysisResult: any | null;

  // Legacy OCR Pipeline State for backward-compatibility
  ocrCompletedToday: number;
  ocrPending: number;
  ocrFailed: number;
  avgProcessingTimeMs: number;
  currentProcessingItem: any | null;
  lastOCRResult: LastOCRResultSummary | null;

  // Legacy & Progress state for backwards compatibility
  isScanning: boolean;
  progress: number;
  currentItem: string;
  totalCount: number;
  processedCount: number;
  newlyOrganizedCount: number;
  error: string | null;

  // Actions
  startScanner: () => Promise<boolean>;
  stopScanner: () => Promise<void>;
  processScreenshot: (event: any) => Promise<void>;
  checkPermissions: () => Promise<StoragePermissionStatus>;
  requestPermissions: () => Promise<boolean>;
  loadCounts: () => Promise<void>;
  retryFailed: () => Promise<void>;
  retryFailedOCR: () => Promise<void>;
  retrySingleOCR: (id: string) => Promise<void>;
  retryFailedAnalysis: () => Promise<void>;
  simulateScreenshot: (name?: string) => Promise<void>;

  // Internal state setters
  setIsListening: (isListening: boolean) => void;
  setCounts: (counts: { scannedToday: number; pendingProcessing: number }) => void;
  setAnalysisMetrics: (metrics: {
    analysisCompletedToday: number;
    analysisPending: number;
    analysisFailed: number;
    avgAnalysisTimeMs: number;
  }) => void;
  setOCRMetrics: (metrics: {
    ocrCompletedToday: number;
    ocrPending: number;
    ocrFailed: number;
    avgProcessingTimeMs: number;
  }) => void;
  setCurrentProcessingItem: (item: any | null) => void;
  setLastAnalysisResult: (result: any | null) => void;
  setLastOCRResult: (result: LastOCRResultSummary | null) => void;
  setLastScreenshot: (screenshot: DetectedScreenshotMetadata | null) => void;
  updateItemStatus: (id: string, status: 'Pending' | 'Processing' | 'Completed' | 'Failed') => void;
  setPermissionStatus: (status: StoragePermissionStatus) => void;
  setError: (error: string | null) => void;

  // Legacy actions
  startScan: (total?: number) => void;
  updateProgress: (progress: number, currentItem: string, processed: number, total: number) => void;
  finishScan: (newlyOrganized: number) => void;
  cancelScan: () => void;
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  isListening: false,
  scannedToday: 0,
  pendingProcessing: 0,
  lastScreenshot: null,
  permissionStatus: 'unavailable',

  // Vision AI & Analysis State
  analysisCompletedToday: 0,
  analysisPending: 0,
  analysisFailed: 0,
  avgAnalysisTimeMs: 0,
  lastAnalysisResult: null,

  // RN-04 Legacy OCR State (aliased to Vision analysis)
  ocrCompletedToday: 0,
  ocrPending: 0,
  ocrFailed: 0,
  avgProcessingTimeMs: 0,
  currentProcessingItem: null,
  lastOCRResult: null,

  isScanning: false,
  progress: 0,
  currentItem: '',
  totalCount: 0,
  processedCount: 0,
  newlyOrganizedCount: 0,
  error: null,

  startScanner: async () => {
    const { screenshotListenerService } = await import('../services/ScreenshotListenerService');
    return await screenshotListenerService.start();
  },

  stopScanner: async () => {
    const { screenshotListenerService } = await import('../services/ScreenshotListenerService');
    await screenshotListenerService.stop();
  },

  processScreenshot: async (event: any) => {
    const { screenshotScannerService } = await import('../services/screenshotScannerService');
    await screenshotScannerService.processScreenshotAsset(event);
  },

  checkPermissions: async () => {
    const { permissionService } = await import('../services/permissionService');
    const status = await permissionService.checkStoragePermission();
    set({ permissionStatus: status });
    return status;
  },

  requestPermissions: async () => {
    const { permissionService } = await import('../services/permissionService');
    const granted = await permissionService.requestStoragePermission();
    const status = await permissionService.checkStoragePermission();
    set({ permissionStatus: status });
    return granted;
  },

  loadCounts: async () => {
    const { screenshotListenerService } = await import('../services/ScreenshotListenerService');
    await screenshotListenerService.refreshStoreCounts();
  },

  retryFailed: async () => {
    const { aiProcessingQueue } = await import('../services/background');
    await aiProcessingQueue.retryFailed();
  },

  retryFailedOCR: async () => {
    const { aiProcessingQueue } = await import('../services/background');
    await aiProcessingQueue.retryFailed();
  },

  retryFailedAnalysis: async () => {
    const { aiProcessingQueue } = await import('../services/background');
    await aiProcessingQueue.retryFailed();
  },

  retrySingleOCR: async (id: string) => {
    const { aiProcessingQueue } = await import('../services/background');
    await aiProcessingQueue.retryItem(id);
  },

  simulateScreenshot: async (name?: string) => {
    const { screenshotListenerService } = await import('../services/ScreenshotListenerService');
    await screenshotListenerService.simulateScreenshot(name);
  },

  setIsListening: (isListening: boolean) => set({ isListening }),

  setCounts: ({ scannedToday, pendingProcessing }) =>
    set({ scannedToday, pendingProcessing, analysisPending: pendingProcessing, ocrPending: pendingProcessing }),

  setAnalysisMetrics: (metrics) =>
    set({
      ...metrics,
      ocrCompletedToday: metrics.analysisCompletedToday,
      ocrPending: metrics.analysisPending,
      ocrFailed: metrics.analysisFailed,
      avgProcessingTimeMs: metrics.avgAnalysisTimeMs,
    }),

  setOCRMetrics: (metrics) =>
    set({
      ...metrics,
      analysisCompletedToday: metrics.ocrCompletedToday,
      analysisPending: metrics.ocrPending,
      analysisFailed: metrics.ocrFailed,
      avgAnalysisTimeMs: metrics.avgProcessingTimeMs,
    }),

  setCurrentProcessingItem: (currentProcessingItem) => set({ currentProcessingItem }),

  setLastAnalysisResult: (lastAnalysisResult) => set({ lastAnalysisResult }),

  setLastOCRResult: (lastOCRResult) => set({ lastOCRResult }),

  setLastScreenshot: (lastScreenshot) => set({ lastScreenshot }),

  updateItemStatus: (id, status) => {
    const current = get().lastScreenshot;
    if (current && current.id === id) {
      set({ lastScreenshot: { ...current, status } });
    }
  },

  setPermissionStatus: (permissionStatus) => set({ permissionStatus }),

  setError: (error: string | null) => set({ error }),

  // Legacy actions
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
}));

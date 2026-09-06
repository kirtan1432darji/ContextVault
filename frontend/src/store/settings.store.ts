import { create } from 'zustand';
import { ApiConstants } from '../api/apiConstants';
import { ThemeMode } from '../theme';

interface SettingsState {
  themeMode: ThemeMode;
  backendUrl: string;
  autoScanOnLaunch: boolean;
  autoDetectScreenshots: boolean;
  screenshotNotifications: boolean;
  scanOnlyScreenshots: boolean;
  useMockAi: boolean;
  lastScanTimestamp: string | null;
  recentSearches: string[];

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setBackendUrl: (url: string) => void;
  setAutoScanOnLaunch: (enabled: boolean) => void;
  setAutoDetectScreenshots: (enabled: boolean) => void;
  setScreenshotNotifications: (enabled: boolean) => void;
  setScanOnlyScreenshots: (enabled: boolean) => void;
  setUseMockAi: (enabled: boolean) => void;
  setLastScanTimestamp: (timestamp: string) => void;
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  backendUrl: ApiConstants.defaultBaseUrl,
  autoScanOnLaunch: true,
  autoDetectScreenshots: true,
  screenshotNotifications: true,
  scanOnlyScreenshots: true,
  useMockAi: false,
  lastScanTimestamp: null,
  recentSearches: [],

  setThemeMode: (mode: ThemeMode) => set({ themeMode: mode }),
  setBackendUrl: (url: string) => set({ backendUrl: url }),
  setAutoScanOnLaunch: (enabled: boolean) => set({ autoScanOnLaunch: enabled }),
  setAutoDetectScreenshots: (enabled: boolean) => set({ autoDetectScreenshots: enabled }),
  setScreenshotNotifications: (enabled: boolean) =>
    set({ screenshotNotifications: enabled }),
  setScanOnlyScreenshots: (enabled: boolean) => set({ scanOnlyScreenshots: enabled }),
  setUseMockAi: (enabled: boolean) => set({ useMockAi: enabled }),
  setLastScanTimestamp: (timestamp: string) => set({ lastScanTimestamp: timestamp }),

  addRecentSearch: (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    set((state) => {
      const filtered = state.recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      return { recentSearches: [trimmed, ...filtered].slice(0, 10) };
    });
  },

  removeRecentSearch: (query: string) => {
    set((state) => ({
      recentSearches: state.recentSearches.filter((s) => s !== query),
    }));
  },

  clearRecentSearches: () => set({ recentSearches: [] }),
}));

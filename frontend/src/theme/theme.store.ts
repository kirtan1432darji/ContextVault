import { create } from 'zustand';
import { StorageService } from '../utils/storage';
import { ThemeMode } from './theme';
import { useSettingsStore } from '../store/settings.store';

export interface ThemeStoreState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  getEffectiveIsDark: (systemIsDark?: boolean) => boolean;
}

const initialThemeMode: ThemeMode = StorageService.getThemeMode();

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  themeMode: initialThemeMode,

  setThemeMode: (mode: ThemeMode) => {
    StorageService.setThemeMode(mode);
    set({ themeMode: mode });
    // Synchronize settings store if different to maintain 100% store cohesion
    if (useSettingsStore.getState().themeMode !== mode) {
      useSettingsStore.setState({ themeMode: mode });
    }
  },

  getEffectiveIsDark: (systemIsDark = false) => {
    const { themeMode } = get();
    if (themeMode === 'system') return systemIsDark;
    return themeMode === 'dark';
  },
}));

jest.mock('react-native-mmkv', () => {
  const map = new Map<string, any>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key: string, val: any) => map.set(key, val)),
      getString: jest.fn((key: string) => map.get(key)),
      getNumber: jest.fn((key: string) => map.get(key)),
      getBoolean: jest.fn((key: string) => map.get(key)),
      delete: jest.fn((key: string) => map.delete(key)),
      clearAll: jest.fn(() => map.clear()),
    })),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(() => 'light'),
    StyleSheet: {
      create: (styles: any) => styles,
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android ?? obj.default,
    },
  };
});

jest.mock('react-native-paper', () => ({
  MD3LightTheme: {
    dark: false,
    colors: {
      primary: '#2563EB',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceVariant: '#F1F5F9',
      outline: '#E2E8F0',
      error: '#EF4444',
    },
  },
  MD3DarkTheme: {
    dark: true,
    colors: {
      primary: '#3B82F6',
      background: '#0B0F19',
      surface: '#111827',
      surfaceVariant: '#1F2937',
      outline: '#374151',
      error: '#EF4444',
    },
  },
  PaperProvider: ({ children }: any) => children,
}));

import React from 'react';
import { useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { StorageService, StorageKeys } from '../utils/storage';
import { useSettingsStore } from '../store/settings.store';
import { getTheme, getNavigationTheme, useAppTheme } from '../theme/theme';
import { ThemeProvider, useThemeContext } from '../theme/ThemeProvider';
import { Colors } from '../theme/colors';

describe('ContextVault Theme System Test Suite', () => {
  beforeEach(() => {
    StorageService.removeItem(StorageKeys.THEME_MODE);
    StorageService.removeItem('cv_app_theme_preference');
    (useColorScheme as jest.Mock).mockReturnValue('light');
  });

  describe('StorageService Theme Persistence', () => {
    it('defaults to system when no theme is persisted', () => {
      expect(StorageService.getThemeMode()).toBe('system');
    });

    it('persists dark mode to storage and retrieves it', () => {
      StorageService.setThemeMode('dark');
      expect(StorageService.getThemeMode()).toBe('dark');
      expect(StorageService.getString(StorageKeys.THEME_MODE)).toBe('dark');
    });

    it('persists light mode to storage and retrieves it', () => {
      StorageService.setThemeMode('light');
      expect(StorageService.getThemeMode()).toBe('light');
      expect(StorageService.getString(StorageKeys.THEME_MODE)).toBe('light');
    });

    it('returns system fallback when stored value is invalid', () => {
      StorageService.setString(StorageKeys.THEME_MODE, 'invalid_mode' as any);
      expect(StorageService.getThemeMode()).toBe('system');
    });
  });

  describe('Settings Store Theme Actions', () => {
    it('updates themeMode in store and synchronizes with StorageService', () => {
      act(() => {
        useSettingsStore.getState().setThemeMode('dark');
      });
      expect(useSettingsStore.getState().themeMode).toBe('dark');
      expect(StorageService.getThemeMode()).toBe('dark');

      act(() => {
        useSettingsStore.getState().setThemeMode('light');
      });
      expect(useSettingsStore.getState().themeMode).toBe('light');
      expect(StorageService.getThemeMode()).toBe('light');

      act(() => {
        useSettingsStore.getState().setThemeMode('system');
      });
      expect(useSettingsStore.getState().themeMode).toBe('system');
      expect(StorageService.getThemeMode()).toBe('system');
    });
  });

  describe('Theme Definitions and getTheme', () => {
    it('generates consistent light theme structure and colors', () => {
      const lightTheme = getTheme(false);
      expect(lightTheme.isDark).toBe(false);
      expect(lightTheme.colors.background).toBe(Colors.light.background);
      expect(lightTheme.colors.surface).toBe(Colors.light.surface);
      expect(lightTheme.colors.surfaceVariant).toBe(Colors.light.surfaceVariant);
      expect(lightTheme.colors.cardBorder).toBe(Colors.light.cardBorder);
      expect(lightTheme.colors.primary).toBe(Colors.primary);
      expect(lightTheme.typography).toBeDefined();
      expect(lightTheme.spacing).toBeDefined();
      expect(lightTheme.borderRadius).toBeDefined();
    });

    it('generates consistent dark theme structure and colors', () => {
      const darkTheme = getTheme(true);
      expect(darkTheme.isDark).toBe(true);
      expect(darkTheme.colors.background).toBe(Colors.dark.background);
      expect(darkTheme.colors.surface).toBe(Colors.dark.surface);
      expect(darkTheme.colors.surfaceVariant).toBe(Colors.dark.surfaceVariant);
      expect(darkTheme.colors.cardBorder).toBe(Colors.dark.cardBorder);
      expect(darkTheme.colors.primary).toBe(Colors.primary);
    });

    it('creates navigation theme adapting AppTheme for React Navigation', () => {
      const darkTheme = getTheme(true);
      const navDark = getNavigationTheme(darkTheme);
      expect(navDark.dark).toBe(true);
      expect(navDark.colors.background).toBe(darkTheme.colors.background);
      expect(navDark.colors.card).toBe(darkTheme.colors.surface);

      const lightTheme = getTheme(false);
      const navLight = getNavigationTheme(lightTheme);
      expect(navLight.dark).toBe(false);
      expect(navLight.colors.background).toBe(lightTheme.colors.background);
      expect(navLight.colors.card).toBe(lightTheme.colors.surface);
    });
  });

  describe('ThemeProvider and useThemeContext Hook', () => {
    it('provides active theme and setThemeMode function to consumer tree', () => {
      let contextVal: any;
      const Consumer = () => {
        contextVal = useThemeContext();
        return null;
      };

      act(() => {
        useSettingsStore.getState().setThemeMode('dark');
      });

      act(() => {
        TestRenderer.create(
          <ThemeProvider>
            <Consumer />
          </ThemeProvider>
        );
      });

      expect(contextVal).toBeDefined();
      expect(contextVal.themeMode).toBe('dark');
      expect(contextVal.isDark).toBe(true);
      expect(contextVal.theme.colors.background).toBe(Colors.dark.background);

      act(() => {
        contextVal.setThemeMode('light');
      });

      expect(useSettingsStore.getState().themeMode).toBe('light');
      expect(contextVal.themeMode).toBe('light');
      expect(contextVal.isDark).toBe(false);
      expect(contextVal.theme.colors.background).toBe(Colors.light.background);
    });
  });
});

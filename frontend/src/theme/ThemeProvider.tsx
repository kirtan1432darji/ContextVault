import React, { createContext, useContext, useMemo } from 'react';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { AppTheme, ThemeMode, useAppTheme } from './theme';
import { useSettingsStore } from '../store/settings.store';

export interface ThemeContextType {
  theme: AppTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useAppTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  const paperTheme = useMemo(() => {
    const base = theme.isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      dark: theme.isDark,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        surface: theme.colors.surface,
        surfaceVariant: theme.colors.surfaceVariant,
        outline: theme.colors.border,
        error: theme.colors.error,
      },
    };
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themeMode,
      setThemeMode,
      isDark: theme.isDark,
    }),
    [theme, themeMode, setThemeMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={paperTheme}>
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  const storeThemeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const theme = useAppTheme();

  if (!context) {
    return {
      theme,
      themeMode: storeThemeMode,
      setThemeMode,
      isDark: theme.isDark,
    };
  }

  return context;
};

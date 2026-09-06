import { useColorScheme } from 'react-native';
import { Colors } from './colors';
import { Typography } from './typography';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppTheme {
  isDark: boolean;
  colors: typeof Colors.light & {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    secondaryDark: string;
    secondaryLight: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  typography: typeof Typography;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
}

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const getTheme = (isDark: boolean): AppTheme => {
  const palette = isDark ? Colors.dark : Colors.light;

  return {
    isDark,
    colors: {
      ...palette,
      primary: Colors.primary,
      primaryDark: Colors.primaryDark,
      primaryLight: Colors.primaryLight,
      secondary: Colors.secondary,
      secondaryDark: Colors.secondaryDark,
      secondaryLight: Colors.secondaryLight,
      accent: Colors.accent,
      success: Colors.success,
      warning: Colors.warning,
      error: Colors.error,
      info: Colors.info,
    },
    typography: Typography,
    spacing,
    borderRadius,
  };
};

export const useAppTheme = (manualMode: ThemeMode = 'system'): AppTheme => {
  const systemScheme = useColorScheme();
  const isDark =
    manualMode === 'system' ? systemScheme === 'dark' : manualMode === 'dark';
  return getTheme(isDark);
};

export const Colors = {
  // Brand Palette - Material 3 Blue & Neutral Production Accents
  primary: '#1A73E8',
  primaryDark: '#174EA6',
  primaryLight: '#E8F0FE',

  secondary: '#5F6368',
  secondaryDark: '#3C4043',
  secondaryLight: '#F1F3F4',

  tertiary: '#0284C7',
  accent: '#1A73E8',

  // Light Theme - Flat, Neutral (Google Photos / Notion / Google Drive)
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceVariant: '#F8F9FA',
    card: '#FFFFFF',
    cardBorder: '#E5E7EB',
    textPrimary: '#1F2937',
    textSecondary: '#5F6368',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    divider: '#F1F3F4',
    tabBar: '#FFFFFF',
    inputBackground: '#F8F9FA',
  },

  // Dark Theme - Neutral Deep Charcoal (Material 3 Dark / Linear Dark)
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#252525',
    card: '#1E1E1E',
    cardBorder: '#2E2E2E',
    textPrimary: '#F9FAFB',
    textSecondary: '#9AA0A6',
    textMuted: '#71717A',
    border: '#2E2E2E',
    divider: '#252525',
    tabBar: '#18181B',
    inputBackground: '#202124',
  },

  // Category Accent Colors (Google Workspace / Material 3 Palette)
  categories: {
    finance: '#1E8E3E',
    social: '#1A73E8',
    work: '#0284C7',
    code: '#E37400',
    shopping: '#D93025',
    travel: '#00897B',
    memes: '#F97316',
    unsorted: '#5F6368',
  },

  // Status & Confidence Colors
  success: '#1E8E3E',
  warning: '#E37400',
  error: '#D93025',
  info: '#1A73E8',

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.85) return Colors.success;
    if (confidence >= 0.65) return Colors.warning;
    return Colors.error;
  },
};

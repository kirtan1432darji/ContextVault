export const Colors = {
  // Brand Palette - Premium Deep Indigo, Electric Violet & Neon Teal
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',

  secondary: '#06B6D4',
  secondaryDark: '#0891B2',
  secondaryLight: '#22D3EE',

  tertiary: '#EC4899',
  accent: '#8B5CF6',

  // Light Theme
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    divider: '#F1F5F9',
    tabBar: '#FFFFFF',
  },

  // Dark Theme
  dark: {
    background: '#0B0F19',
    surface: '#131B2E',
    card: '#1E293B',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    divider: '#1E293B',
    tabBar: '#0E1424',
  },

  // Category Accent Colors
  categories: {
    finance: '#10B981',
    social: '#3B82F6',
    work: '#8B5CF6',
    code: '#F59E0B',
    shopping: '#EC4899',
    travel: '#14B8A6',
    memes: '#F97316',
    unsorted: '#64748B',
  },

  // Status & Confidence Colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.85) return Colors.success;
    if (confidence >= 0.65) return Colors.warning;
    return Colors.error;
  },
};

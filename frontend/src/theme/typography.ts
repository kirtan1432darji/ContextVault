import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  displayLarge: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  headlineLarge: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  headlineMedium: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  titleLarge: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  titleMedium: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  labelLarge: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  labelMedium: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
};

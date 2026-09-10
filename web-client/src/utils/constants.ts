/**
 * Storage keys for localStorage.
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'contextvault_access_token',
  REFRESH_TOKEN: 'contextvault_refresh_token',
  USER_DATA: 'contextvault_user_profile',
  REMEMBER_ME: 'contextvault_remember_me',
  THEME_PREFERENCE: 'contextvault_theme',
} as const;

/**
 * Route paths for React Router navigation.
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  SCREENSHOTS: '/screenshots',
  CATEGORIES: '/categories',
  HEALTH: '/health',
  SETTINGS: '/settings',
} as const;

/**
 * API configuration defaults.
 */
export const API_CONFIG = {
  DEFAULT_TIMEOUT_MS: 30000,
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  API_V1_PREFIX: '/api',
} as const;

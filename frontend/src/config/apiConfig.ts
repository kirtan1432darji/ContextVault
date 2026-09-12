import { BackendConnectionManager } from '../services/BackendConnectionManager';

/**
 * ContextVault Central API Configuration
 *
 * Configured with dynamic environment resolution (development vs production).
 * Decoupled from native modules to ensure seamless operation on both physical devices and release APKs.
 */
function resolveBaseUrl(): string {
  // Allow optional global or environment overrides if defined
  const globalEnv = (typeof global !== 'undefined' && (global as any).__CONTEXTVAULT_API_URL__) || null;
  if (globalEnv && typeof globalEnv === 'string' && globalEnv.trim().length > 0) {
    return globalEnv.trim().replace(/\/+$/, '');
  }

  return BackendConnectionManager.getBaseUrl();
}

/**
 * Normalized FastAPI Backend Host URL (e.g. "http://10.122.196.96:8000")
 */
export const API_BASE_URL: string = resolveBaseUrl();

/**
 * Standard API Timeout in milliseconds (30 seconds)
 */
export const REQUEST_TIMEOUT_MS = 30000;

/**
 * API Prefix for v1 routes
 */
export const API_V1_PREFIX = '/api';

/**
 * Helper to generate a fully qualified API endpoint URL dynamically.
 *
 * @example
 * getEndpointUrl('/health') // -> "http://10.122.196.96:8000/api/health"
 * getEndpointUrl('/auth/login') // -> "http://10.122.196.96:8000/api/auth/login"
 */
export function getEndpointUrl(path: string): string {
  const currentBase = resolveBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api/')) {
    return `${currentBase}${cleanPath}`;
  }
  return `${currentBase}${API_V1_PREFIX}${cleanPath}`;
}

/**
 * Central API Endpoints registry matching ContextVault FastAPI backend contracts.
 */
export const API_ENDPOINTS = {
  // Health & System
  HEALTH: '/api/health',
  VERSION: '/api/version',
  ROOT: '/',

  // Auth
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_PROFILE: '/api/auth/profile',
  AUTH_REFRESH: '/api/auth/refresh',
  AUTH_LOGOUT: '/api/auth/logout',

  // Screenshots
  SCREENSHOTS: '/api/screenshots',
  UPLOAD_METADATA: '/api/screenshots/upload-metadata',
  SYNC_SCREENSHOTS: '/api/screenshots/sync',

  // Categories & Context
  CATEGORIES: '/api/categories',
  FOLDER_CONTEXT: (id: string) => `/api/context/${id}`,
  CHAT_MESSAGE: '/api/chat/message',
  SEARCH: '/api/search',
} as const;

export default {
  API_BASE_URL,
  REQUEST_TIMEOUT_MS,
  API_V1_PREFIX,
  getEndpointUrl,
  API_ENDPOINTS,
};

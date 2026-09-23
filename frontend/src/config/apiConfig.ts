import { getApiBaseUrl, getEndpointUrl as getCentralEndpointUrl, setApiBaseUrl } from './api';

/**
 * ContextVault Central API Configuration
 * Delegates directly to src/config/api.ts for dynamic backend discovery.
 */
export function resolveBaseUrl(): string {
  return getApiBaseUrl();
}

/**
 * Normalized FastAPI Backend Host URL
 */
export const API_BASE_URL: string = getApiBaseUrl();

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
 * Delegates to centralized api configuration.
 */
export function getEndpointUrl(path: string): string {
  return getCentralEndpointUrl(path);
}

/**
 * Central API Endpoints registry matching ContextVault FastAPI backend contracts.
 */
export const API_ENDPOINTS = {
  // Health & System
  HEALTH: '/api/health',
  ROOT_HEALTH: '/health',
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

  // Vision Gateway (Local RTX 4050 Server)
  VISION_HEALTH: '/api/vision/health',
  VISION_PING: '/api/vision/ping',
  VISION_MODEL_INFO: '/api/vision/model-info',
  VISION_ANALYZE: '/api/vision/analyze',
  VISION_BATCH: '/api/vision/batch',
} as const;

export { getApiBaseUrl, setApiBaseUrl };

/**
 * Returns the configured OpenAI API Key
 */
export function getOpenAiApiKey(): string {
  return '';
}

export const OPEN_AI_API_KEY = '';

/**
 * Returns the configured Qwen API Key from local environment
 */
export function getQwenApiKey(): string {
  const { EnvironmentManager } = require('./EnvironmentManager');
  return EnvironmentManager.getQwenApiKey();
}

export const QWEN_API_KEY = getQwenApiKey();

export default {
  API_BASE_URL,
  REQUEST_TIMEOUT_MS,
  API_V1_PREFIX,
  getEndpointUrl,
  getApiBaseUrl,
  setApiBaseUrl,
  getOpenAiApiKey,
  OPEN_AI_API_KEY,
  getQwenApiKey,
  QWEN_API_KEY,
  API_ENDPOINTS,
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { StorageService } from '../utils/storage';

/**
 * AsyncStorage Key for Persisted User-Defined Backend URL (Priority 1)
 */
export const STORAGE_KEY_BACKEND_URL = '@contextvault_backend_url';

/**
 * Hardcoded Default Fallback URL (Priority 3)
 */
export const DEFAULT_FALLBACK_URL = 'http://10.33.95.152:8000';

/**
 * Health Check Result Contract
 */
export interface HealthCheckResult {
  isHealthy: boolean;
  status: 'Connected' | 'Connection Failed';
  database?: string;
  version?: string;
  latencyMs: number;
  baseUrl: string;
  errorMessage?: string;
}

/**
 * Helper to normalize backend URL:
 * - Trims whitespace
 * - Removes trailing slashes
 * - Strips trailing '/api'
 *
 * @example
 * normalizeUrl('http://10.33.95.152:8000/api/') // -> 'http://10.33.95.152:8000'
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return DEFAULT_FALLBACK_URL;
  let clean = url.trim().replace(/\/+$/, '');
  while (clean.toLowerCase().endsWith('/api')) {
    clean = clean.slice(0, -4).replace(/\/+$/, '');
  }
  return clean || DEFAULT_FALLBACK_URL;
}

/**
 * Validates if a string is a well-formed HTTP/HTTPS URL with host.
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\/.+/i.test(trimmed)) return false;
  try {
    const withoutProto = trimmed.replace(/^https?:\/\//i, '');
    return withoutProto.length > 0 && !withoutProto.startsWith('/');
  } catch {
    return false;
  }
}

/**
 * Resolves Priority 2 environment variable:
 * Checks Expo public env, React Native env, and generated build env.
 */
function resolveEnvironmentUrl(): string | null {
  // 1. Expo Public API URL
  const expoEnv =
    (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || null;
  if (expoEnv && typeof expoEnv === 'string' && isValidUrl(expoEnv)) {
    return normalizeUrl(expoEnv);
  }

  // 2. React Native / Generic API URL
  const rnEnv =
    (typeof process !== 'undefined' &&
      process.env &&
      (process.env.REACT_NATIVE_API_BASE_URL || process.env.API_BASE_URL)) ||
    null;
  if (rnEnv && typeof rnEnv === 'string' && isValidUrl(rnEnv)) {
    return normalizeUrl(rnEnv);
  }

  // 3. Global override flag if set in window/global
  const globalEnv = (typeof global !== 'undefined' && (global as any).__CONTEXTVAULT_API_URL__) || null;
  if (globalEnv && typeof globalEnv === 'string' && isValidUrl(globalEnv)) {
    return normalizeUrl(globalEnv);
  }

  // 4. Generated env config if bundled
  try {
    const generated = require('./env.generated.json');
    if (generated && generated.apiBaseUrl && isValidUrl(generated.apiBaseUrl)) {
      return normalizeUrl(generated.apiBaseUrl);
    }
  } catch {}

  return null;
}

/**
 * Initial synchronous resolution for immediate exports
 */
function resolveInitialBaseUrl(): string {
  // Check MMKV sync cache first for synchronous startup
  try {
    const saved = StorageService.getBackendUrlOverride();
    if (saved && isValidUrl(saved)) {
      return normalizeUrl(saved);
    }
  } catch {}

  const envUrl = resolveEnvironmentUrl();
  if (envUrl) return envUrl;

  return DEFAULT_FALLBACK_URL;
}

// In-memory active base URL cache
let activeBaseUrl: string = resolveInitialBaseUrl();

/**
 * Asynchronously resolves backend URL according to strict priority:
 * 1. Read backend URL from AsyncStorage (persisted user setting)
 * 2. If not found, read from Expo environment variable `EXPO_PUBLIC_API_URL`
 * 3. If that is not found, use default fallback URL: `http://10.33.95.152:8000`
 */
export async function getApiBaseUrlAsync(): Promise<string> {
  try {
    // Priority 1: AsyncStorage
    const asyncStored = await AsyncStorage.getItem(STORAGE_KEY_BACKEND_URL);
    if (asyncStored && isValidUrl(asyncStored)) {
      activeBaseUrl = normalizeUrl(asyncStored);
      return activeBaseUrl;
    }
  } catch (err) {
    console.warn('[api] Failed reading AsyncStorage backend URL:', err);
  }

  // Check MMKV fallback
  try {
    const mmkvStored = StorageService.getBackendUrlOverride();
    if (mmkvStored && isValidUrl(mmkvStored)) {
      activeBaseUrl = normalizeUrl(mmkvStored);
      return activeBaseUrl;
    }
  } catch {}

  // Priority 2: Expo / Env Variable
  const envUrl = resolveEnvironmentUrl();
  if (envUrl) {
    activeBaseUrl = envUrl;
    return activeBaseUrl;
  }

  // Priority 3: Fallback Default URL
  activeBaseUrl = DEFAULT_FALLBACK_URL;
  return activeBaseUrl;
}

/**
 * Returns the current active base URL synchronously.
 * Note: call `initApiConfiguration()` or `getApiBaseUrlAsync()` at app startup
 * to ensure AsyncStorage values are loaded into memory.
 */
export function getApiBaseUrl(): string {
  return activeBaseUrl;
}

/**
 * Updates the active backend URL and persists it to AsyncStorage (and MMKV).
 * Also updates the active in-memory cache and Axios client defaults.
 */
export async function setApiBaseUrl(url: string): Promise<void> {
  const trimmed = (url || '').trim();
  if (!isValidUrl(trimmed)) {
    throw new Error('Invalid backend URL. Please ensure it starts with http:// or https://');
  }

  const normalized = normalizeUrl(trimmed);
  activeBaseUrl = normalized;

  // Persist to AsyncStorage (Priority 1)
  try {
    await AsyncStorage.setItem(STORAGE_KEY_BACKEND_URL, normalized);
  } catch (err) {
    console.warn('[api] Failed saving to AsyncStorage:', err);
  }

  // Also sync to MMKV
  try {
    StorageService.setBackendUrlOverride(normalized);
  } catch {}

  // Lazily update apiClient if available
  try {
    const { apiClient } = require('../api/apiClient');
    if (apiClient && apiClient.getAxiosInstance) {
      apiClient.getAxiosInstance().defaults.baseURL = `${normalized}/api`;
    }
  } catch {}
}

/**
 * Resets backend URL to build default:
 * Clears AsyncStorage and MMKV overrides and restores Priority 2 or 3 default.
 */
export async function resetApiBaseUrl(): Promise<string> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_BACKEND_URL);
  } catch {}

  try {
    StorageService.clearBackendUrlOverride();
  } catch {}

  const envUrl = resolveEnvironmentUrl();
  activeBaseUrl = envUrl || DEFAULT_FALLBACK_URL;

  try {
    const { apiClient } = require('../api/apiClient');
    if (apiClient && apiClient.getAxiosInstance) {
      apiClient.getAxiosInstance().defaults.baseURL = `${activeBaseUrl}/api`;
    }
  } catch {}

  return activeBaseUrl;
}

/**
 * Returns a fully qualified endpoint URL.
 *
 * @example
 * getEndpointUrl('/health') // -> "http://10.33.95.152:8000/health"
 * getEndpointUrl('/api/auth/login') // -> "http://10.33.95.152:8000/api/auth/login"
 */
export function getEndpointUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Performs a health check against the target backend using GET /health (or GET /api/health).
 * Measures round-trip latency and returns detailed status.
 *
 * Expected Success Response:
 * {
 *   "status": "healthy",
 *   "database": "connected",
 *   "version": "1.0.0"
 * }
 */
export async function testConnection(targetUrl?: string): Promise<HealthCheckResult> {
  const base = normalizeUrl(targetUrl || getApiBaseUrl());
  const startTime = Date.now();

  // Try /health first; if 404, fallback to /api/health (dual compatibility)
  const candidateEndpoints = [`${base}/health`, `${base}/api/health`];

  for (let i = 0; i < candidateEndpoints.length; i++) {
    const endpoint = candidateEndpoints[i];
    try {
      const response = await axios.get(endpoint, {
        timeout: 5000,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      const latencyMs = Math.max(1, Date.now() - startTime);
      const data = response.data?.data || response.data || {};

      const isHealthy =
        response.status === 200 &&
        (data.status === 'healthy' ||
          data.status === 'operational' ||
          data.status === 'ok' ||
          data.database === 'connected');

      return {
        isHealthy: true,
        status: 'Connected',
        latencyMs,
        version: data.version || '1.0.0',
        database: data.database || (isHealthy ? 'connected' : 'disconnected'),
        baseUrl: base,
      };
    } catch (err: any) {
      // If /health was 404, try /api/health before reporting failure
      if (err.response?.status === 404 && i < candidateEndpoints.length - 1) {
        continue;
      }

      const latencyMs = Math.max(1, Date.now() - startTime);
      let errorMessage = `Cannot connect to ContextVault backend at ${base}.`;

      if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
        errorMessage = `Connection to ${base} timed out after 5 seconds.`;
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        errorMessage = `Network Error: Cannot reach ${base}. Please ensure the device is connected to the same Wi-Fi/hotspot network.`;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      return {
        isHealthy: false,
        status: 'Connection Failed',
        latencyMs,
        baseUrl: base,
        errorMessage,
      };
    }
  }

  return {
    isHealthy: false,
    status: 'Connection Failed',
    latencyMs: Math.max(1, Date.now() - startTime),
    baseUrl: base,
    errorMessage: `Unable to reach health check endpoint on ${base}.`,
  };
}

/**
 * Initializes API configuration asynchronously upon application bootstrap.
 */
export async function initApiConfiguration(): Promise<string> {
  const resolved = await getApiBaseUrlAsync();
  console.log(`[api] Backend Base URL initialized: ${resolved}`);
  return resolved;
}

/**
 * Global constant export matching requested requirement
 */
export const API_BASE_URL: string = getApiBaseUrl();

export default {
  STORAGE_KEY_BACKEND_URL,
  DEFAULT_FALLBACK_URL,
  normalizeUrl,
  isValidUrl,
  getApiBaseUrl,
  getApiBaseUrlAsync,
  setApiBaseUrl,
  resetApiBaseUrl,
  getEndpointUrl,
  testConnection,
  initApiConfiguration,
  API_BASE_URL,
};

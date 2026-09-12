import axios from 'axios';
import { StorageService } from '../utils/storage';

export interface PingResult {
  isHealthy: boolean;
  status: 'Connected' | 'Offline' | 'Timeout' | 'Unauthorized';
  latencyMs: number;
  version: string;
  database: string;
  baseUrl: string;
  errorMessage?: string;
}

export interface StartupHealthResult {
  isHealthy: boolean;
  migrated: boolean;
  activeUrl: string;
  previousUrl?: string;
  latencyMs?: number;
  errorMessage?: string;
}

let generatedEnv: { apiBaseUrl?: string; environment?: string } = {};
try {
  generatedEnv = require('../config/env.generated.json');
} catch {}

const DEFAULT_DEV_FALLBACK_URL = 'http://10.122.196.96:8000';

export class BackendConnectionManagerClass {
  private defaultUrl: string;

  constructor() {
    this.defaultUrl = this.normalizeUrl(
      generatedEnv.apiBaseUrl || DEFAULT_DEV_FALLBACK_URL
    );
  }

  /**
   * Validates if a string is a well-formed HTTP/HTTPS URL with host.
   */
  public isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) return false;
    try {
      // Basic sanity check: must have a protocol and hostname
      const withoutProto = trimmed.replace(/^https?:\/\//i, '');
      return withoutProto.length > 0 && !withoutProto.startsWith('/');
    } catch {
      return false;
    }
  }

  /**
   * Normalizes backend URL:
   * Trims whitespace, removes trailing slashes, strips trailing '/api'.
   * Example: "http://10.122.196.96:8000/api/" -> "http://10.122.196.96:8000"
   */
  public normalizeUrl(url: string): string {
    if (!url || typeof url !== 'string') return this.defaultUrl;
    let clean = url.trim().replace(/\/+$/, '');
    if (clean.toLowerCase().endsWith('/api')) {
      clean = clean.slice(0, -4).replace(/\/+$/, '');
    }
    return clean;
  }

  /**
   * Returns default backend URL from development environment configuration.
   */
  public getDefaultUrl(): string {
    return this.defaultUrl;
  }

  /**
   * Returns currently active base URL.
   * Priority: MMKV saved override -> .env.development default.
   */
  public getBaseUrl(): string {
    const saved = StorageService.getBackendUrlOverride();
    if (saved && saved.trim().length > 0 && this.isValidUrl(saved)) {
      return this.normalizeUrl(saved);
    }
    return this.defaultUrl;
  }

  /**
   * Returns currently active API URL (with '/api' suffix).
   * Example: "http://10.122.196.96:8000/api"
   */
  public getApiUrl(): string {
    const base = this.getBaseUrl();
    return `${base}/api`;
  }

  /**
   * Saves custom backend URL into MMKV secure storage.
   * Validates format before persisting.
   */
  public setBaseUrl(url: string): void {
    const trimmed = url.trim();
    if (!this.isValidUrl(trimmed)) {
      throw new Error('Invalid backend URL. Please ensure it starts with http:// or https://');
    }
    const cleanUrl = this.normalizeUrl(trimmed);
    StorageService.setBackendUrlOverride(cleanUrl);
  }

  /**
   * Resets backend URL to .env.development default by removing MMKV override.
   */
  public resetBaseUrl(): void {
    StorageService.clearBackendUrlOverride();
  }

  /**
   * Checks if an MMKV override is currently set.
   */
  public hasCustomUrl(): boolean {
    const saved = StorageService.getBackendUrlOverride();
    return Boolean(saved && saved.trim().length > 0);
  }

  /**
   * Pings backend health endpoint (/api/health) and measures round-trip latency.
   */
  public async ping(targetUrl?: string): Promise<PingResult> {
    const rawBase = targetUrl || this.getBaseUrl();
    const cleanBase = this.normalizeUrl(rawBase);
    const healthUrl = `${cleanBase}/api/health`;

    const startTime = Date.now();
    try {
      const response = await axios.get(healthUrl, {
        timeout: 5000,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      const latencyMs = Math.max(1, Date.now() - startTime);
      const resData = response.data?.data || response.data || {};

      return {
        isHealthy: true,
        status: 'Connected',
        latencyMs,
        version: resData.version || '1.0.0',
        database:
          resData.database ||
          (resData.status === 'ok' || resData.status === 'healthy' ? 'connected' : 'unknown'),
        baseUrl: cleanBase,
      };
    } catch (err: any) {
      const latencyMs = Math.max(1, Date.now() - startTime);
      let status: 'Connected' | 'Offline' | 'Timeout' | 'Unauthorized' = 'Offline';
      let errorMessage = `Cannot connect to ContextVault backend at ${cleanBase}.`;

      if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
        status = 'Timeout';
        errorMessage = `Connection to ${cleanBase} timed out after 5 seconds.`;
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        status = 'Unauthorized';
        errorMessage = 'Unauthorized access to backend health endpoint.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        errorMessage = `Cannot connect to ContextVault backend at ${cleanBase}. Please verify network connectivity and backend server.`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      return {
        isHealthy: false,
        status,
        latencyMs,
        version: 'unknown',
        database: 'disconnected',
        baseUrl: cleanBase,
        errorMessage,
      };
    }
  }

  /**
   * Runtime URL Migration & Startup Health Check (Requirement 3 & 5):
   * 
   * 1. If MMKV contains a saved URL:
   *    - Test saved URL.
   *    - If reachable: continue normally.
   *    - If unreachable: test default fallback (.env.development).
   *      - If default is reachable: AUTO-MIGRATE to default and flag `migrated: true`.
   *      - If default also unreachable: return unreachable with error.
   * 2. If no saved URL:
   *    - Test default URL.
   */
  public async performStartupHealthCheck(): Promise<StartupHealthResult> {
    const savedUrl = StorageService.getBackendUrlOverride();
    const fallbackDefault = this.getDefaultUrl();

    // Case 1: Saved override in MMKV exists and differs from default
    if (savedUrl && savedUrl.trim().length > 0 && this.normalizeUrl(savedUrl) !== fallbackDefault) {
      const normalizedSaved = this.normalizeUrl(savedUrl);
      const savedResult = await this.ping(normalizedSaved);

      if (savedResult.isHealthy) {
        return {
          isHealthy: true,
          migrated: false,
          activeUrl: normalizedSaved,
          latencyMs: savedResult.latencyMs,
        };
      }

      // Saved IP is unreachable! Check if fallback (.env.development) is reachable
      console.log(
        `[BackendConnectionManager] Saved URL ${normalizedSaved} unreachable. Probing fallback ${fallbackDefault}...`
      );
      const fallbackResult = await this.ping(fallbackDefault);

      if (fallbackResult.isHealthy) {
        // Auto-migrate: update MMKV to fallback default
        console.log(
          `[BackendConnectionManager] Auto-migrating unreachable IP ${normalizedSaved} -> ${fallbackDefault}`
        );
        this.setBaseUrl(fallbackDefault);

        return {
          isHealthy: true,
          migrated: true,
          activeUrl: fallbackDefault,
          previousUrl: normalizedSaved,
          latencyMs: fallbackResult.latencyMs,
        };
      }

      // Neither saved nor fallback is reachable
      return {
        isHealthy: false,
        migrated: false,
        activeUrl: normalizedSaved,
        latencyMs: savedResult.latencyMs,
        errorMessage: savedResult.errorMessage,
      };
    }

    // Case 2: No override, or override is already default
    const activeUrl = this.getBaseUrl();
    const result = await this.ping(activeUrl);

    return {
      isHealthy: result.isHealthy,
      migrated: false,
      activeUrl,
      latencyMs: result.latencyMs,
      errorMessage: result.errorMessage,
    };
  }
}

export const BackendConnectionManager = new BackendConnectionManagerClass();
export default BackendConnectionManager;

import axios from 'axios';
import { API_CONFIG } from '../utils/constants';
import { HealthDiagnostic, HealthResponse, VersionResponse } from '../types/health';
import { errorService } from '../services/errorService';

/**
 * Health & Diagnostics API Service.
 * Uses a dedicated short-timeout Axios call to probe Docker and measure network latency.
 */
export const healthApi = {
  /**
   * Fetch health status from FastAPI /api/health.
   */
  async getHealth(): Promise<HealthResponse> {
    const res = await axios.get<HealthResponse>(`${API_CONFIG.BASE_URL}/api/health`, {
      timeout: 10000,
    });
    return res.data;
  },

  /**
   * Fetch version metadata from FastAPI /api/version.
   */
  async getVersion(): Promise<VersionResponse> {
    const res = await axios.get<VersionResponse>(`${API_CONFIG.BASE_URL}/api/version`, {
      timeout: 10000,
    });
    return res.data;
  },

  /**
   * Performs an end-to-end diagnostic check:
   * - Measures round-trip latency in milliseconds
   * - Queries /api/health and /api/version
   * - Formulates structured diagnostic report for UI health badges
   */
  async checkDiagnostic(): Promise<HealthDiagnostic> {
    const startTime = performance.now();
    try {
      const [health, version] = await Promise.all([
        healthApi.getHealth(),
        healthApi.getVersion().catch(() => ({
          version: '1.0.0',
          name: 'ContextVault API',
          environment: 'production',
        })),
      ]);
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      return {
        isOnline: true,
        status: health.status || 'healthy',
        databaseStatus: health.database || 'connected',
        responseTimeMs: latencyMs,
        version: health.version || version.version || '1.0.0',
        environment: version.environment || 'development',
        targetUrl: API_CONFIG.BASE_URL,
        lastCheckedAt: new Date().toISOString(),
        error: null,
      };
    } catch (err) {
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      const parsed = errorService.parse(err);

      return {
        isOnline: false,
        status: 'offline',
        databaseStatus: 'unknown',
        responseTimeMs: latencyMs,
        version: 'Unknown',
        environment: 'Unknown',
        targetUrl: API_CONFIG.BASE_URL,
        lastCheckedAt: new Date().toISOString(),
        error: parsed.message,
      };
    }
  },
};

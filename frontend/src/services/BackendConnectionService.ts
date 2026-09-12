import axios from 'axios';
import { EnvironmentManager } from '../config/EnvironmentManager';
import { BackendConnectionManager } from './BackendConnectionManager';

export type ConnectionStatus = 'Connected' | 'Offline' | 'Timeout' | 'Unauthorized';

export interface ConnectionStatusResult {
  status: ConnectionStatus;
  isHealthy: boolean;
  latencyMs: number;
  version?: string;
  database?: string;
  errorMessage?: string;
  baseUrl: string;
}

class BackendConnectionServiceClass {
  /**
   * Pings the backend health endpoint (e.g. GET /api/health) and measures response time.
   */
  async pingBackend(targetUrl?: string): Promise<ConnectionStatusResult> {
    const rawBaseUrl = targetUrl || BackendConnectionManager.getBaseUrl();
    const cleanBaseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
    const healthUrl = cleanBaseUrl.endsWith('/api')
      ? `${cleanBaseUrl}/health`
      : `${cleanBaseUrl}/api/health`;

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
        status: 'Connected',
        isHealthy: true,
        latencyMs,
        version: resData.version || '1.0.0',
        database:
          resData.database ||
          (resData.status === 'ok' || resData.status === 'healthy' ? 'connected' : 'unknown'),
        baseUrl: cleanBaseUrl,
      };
    } catch (err: any) {
      const latencyMs = Math.max(1, Date.now() - startTime);

      let status: ConnectionStatus = 'Offline';
      let errorMessage = `Cannot connect to ContextVault backend at ${cleanBaseUrl}.`;

      if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
        status = 'Timeout';
        errorMessage = `Connection to ${cleanBaseUrl} timed out after 5 seconds.`;
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        status = 'Unauthorized';
        errorMessage = 'Unauthorized access to backend health endpoint.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        errorMessage = `Cannot connect to ContextVault backend at ${cleanBaseUrl}. Please ensure server is running and accessible.`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      return {
        status,
        isHealthy: false,
        latencyMs,
        errorMessage,
        baseUrl: cleanBaseUrl,
      };
    }
  }

  /**
   * Retrieves backend API version string.
   */
  async getApiVersion(targetUrl?: string): Promise<string> {
    const result = await this.pingBackend(targetUrl);
    return result.version || 'unknown';
  }

  /**
   * Measures round-trip latency in milliseconds.
   */
  async measureLatency(targetUrl?: string): Promise<number> {
    const result = await this.pingBackend(targetUrl);
    return result.latencyMs;
  }
}

export const backendConnectionService = new BackendConnectionServiceClass();

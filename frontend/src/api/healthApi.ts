import axios from 'axios';
import { apiClient } from './apiClient';
import { ApiConstants } from './apiConstants';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/apiConfig';
import { Result } from '../utils/result';

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy' | string;
  database: 'connected' | 'disconnected' | string;
  version: string;
}

export interface VersionResponse {
  version: string;
  name: string;
  environment?: string;
}

export interface PingResult {
  isHealthy: boolean;
  latencyMs: number;
  status: string;
  database: string;
  version: string;
  baseUrl: string;
  errorMessage?: string;
}

export class HealthApi {
  /**
   * Performs system health check against ContextVault FastAPI backend (/api/health).
   */
  async getHealth(): Promise<Result<HealthResponse>> {
    try {
      const response = await apiClient.getAxiosInstance().get<HealthResponse>(ApiConstants.healthCheck, {
        timeout: 10000,
      });

      const data = (response.data as any)?.data || response.data;
      return Result.success<HealthResponse>({
        status: data?.status || 'unknown',
        database: data?.database || 'unknown',
        version: data?.version || 'unknown',
      });
    } catch (err: any) {
      const msg = this.formatErrorMessage(err);
      return Result.failure(msg, err);
    }
  }

  /**
   * Fetches service version and environment metadata (/api/version).
   */
  async getVersion(): Promise<Result<VersionResponse>> {
    try {
      const response = await apiClient.getAxiosInstance().get<VersionResponse>('/version', {
        timeout: 10000,
      });

      const data = (response.data as any)?.data || response.data;
      return Result.success<VersionResponse>({
        version: data?.version || '1.0.0',
        name: data?.name || 'ContextVault API',
        environment: data?.environment,
      });
    } catch (err: any) {
      const msg = this.formatErrorMessage(err);
      return Result.failure(msg, err);
    }
  }

  /**
   * Pings the Docker backend, measuring client-to-server round-trip latency in milliseconds.
   */
  async pingServer(customUrl?: string): Promise<PingResult> {
    const targetBase = customUrl || apiClient.getBaseUrl();
    const healthUrl = targetBase.endsWith('/api')
      ? `${targetBase}/health`
      : `${targetBase}/api/health`;

    const start = Date.now();
    try {
      const response = await axios.get(healthUrl, {
        timeout: 10000,
        headers: {
          'Cache-Control': 'no-cache',
          Accept: 'application/json',
        },
      });
      const latencyMs = Date.now() - start;

      const data = (response.data as any)?.data || response.data;
      const isHealthy = response.status === 200 && data?.status === 'healthy';

      return {
        isHealthy,
        latencyMs,
        status: data?.status || (response.status === 200 ? 'healthy' : 'degraded'),
        database: data?.database || 'unknown',
        version: data?.version || '1.0.0',
        baseUrl: targetBase,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorMessage = this.formatErrorMessage(err);

      return {
        isHealthy: false,
        latencyMs,
        status: 'unreachable',
        database: 'disconnected',
        version: 'unknown',
        baseUrl: targetBase,
        errorMessage,
      };
    }
  }

  private formatErrorMessage(err: any): string {
    if (err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'))) {
      return 'Connection timed out. ContextVault Docker host is taking too long to respond.';
    }
    if (err.message && (err.message.includes('Network Error') || err.code === 'ERR_NETWORK')) {
      return `Cannot connect to ContextVault Docker backend at ${apiClient.getBaseUrl()}. Please ensure container 'contextvault-api' is running on Ubuntu host.`;
    }
    return err.response?.data?.message || err.message || 'Health check failed';
  }
}

export const healthApi = new HealthApi();
export default healthApi;

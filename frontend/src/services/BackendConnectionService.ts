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
   * Delegates directly to BackendConnectionManager as the authoritative single source of truth.
   */
  async pingBackend(targetUrl?: string): Promise<ConnectionStatusResult> {
    return BackendConnectionManager.ping(targetUrl);
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

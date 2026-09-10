/**
 * System health response from /api/health.
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected';
  version: string;
}

/**
 * System version and environment response from /api/version.
 */
export interface VersionResponse {
  version: string;
  name: string;
  environment: string;
}

/**
 * Enhanced diagnostic info gathered by the client.
 */
export interface HealthDiagnostic {
  isOnline: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  databaseStatus: 'connected' | 'disconnected' | 'unknown';
  responseTimeMs: number;
  version: string;
  environment: string;
  targetUrl: string;
  lastCheckedAt: string;
  error?: string | null;
}

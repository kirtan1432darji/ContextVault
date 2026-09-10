import { useState, useEffect, useCallback } from 'react';
import { healthApi } from '../api/healthApi';
import { HealthDiagnostic } from '../types/health';
import { API_CONFIG } from '../utils/constants';

interface UseHealthOptions {
  autoPollIntervalMs?: number; // e.g. 15000 for 15s polling
  enablePolling?: boolean;
}

/**
 * Custom hook to monitor Docker backend health, round-trip latency, and connectivity.
 */
export function useHealth(options: UseHealthOptions = {}) {
  const { autoPollIntervalMs = 20000, enablePolling = false } = options;

  const [diagnostic, setDiagnostic] = useState<HealthDiagnostic>({
    isOnline: false,
    status: 'offline',
    databaseStatus: 'unknown',
    responseTimeMs: 0,
    version: '1.0.0',
    environment: 'development',
    targetUrl: API_CONFIG.BASE_URL,
    lastCheckedAt: new Date().toISOString(),
    error: null,
  });

  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkNow = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await healthApi.checkDiagnostic();
      setDiagnostic(result);
      return result;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkNow();

    if (!enablePolling) return;

    const intervalId = setInterval(() => {
      checkNow();
    }, autoPollIntervalMs);

    return () => clearInterval(intervalId);
  }, [checkNow, enablePolling, autoPollIntervalMs]);

  return {
    diagnostic,
    isChecking,
    checkNow,
    isOnline: diagnostic.isOnline,
    latencyMs: diagnostic.responseTimeMs,
    status: diagnostic.status,
  };
}

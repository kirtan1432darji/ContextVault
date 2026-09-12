jest.mock('react-native-mmkv', () => {
  const map = new Map<string, any>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key: string, val: any) => map.set(key, val)),
      getString: jest.fn((key: string) => map.get(key)),
      getNumber: jest.fn((key: string) => map.get(key)),
      getBoolean: jest.fn((key: string) => map.get(key)),
      delete: jest.fn((key: string) => map.delete(key)),
      clearAll: jest.fn(() => map.clear()),
    })),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

import axios from 'axios';
import { BackendConnectionManager } from '../services/BackendConnectionManager';
import { StorageService } from '../utils/storage';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BackendConnectionManager Suite (BugFix-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BackendConnectionManager.resetBaseUrl();
  });

  describe('1. URL Validation & Normalization', () => {
    it('validates http and https URLs correctly', () => {
      expect(BackendConnectionManager.isValidUrl('http://10.122.196.96:8000')).toBe(true);
      expect(BackendConnectionManager.isValidUrl('https://api.contextvault.app')).toBe(true);
      expect(BackendConnectionManager.isValidUrl('http://192.168.1.100:8000/api')).toBe(true);
      expect(BackendConnectionManager.isValidUrl('http://localhost:8000')).toBe(true);
    });

    it('rejects invalid or missing protocol URLs', () => {
      expect(BackendConnectionManager.isValidUrl('10.122.196.96:8000')).toBe(false);
      expect(BackendConnectionManager.isValidUrl('ftp://server.local')).toBe(false);
      expect(BackendConnectionManager.isValidUrl('')).toBe(false);
      expect(BackendConnectionManager.isValidUrl(null as any)).toBe(false);
      expect(BackendConnectionManager.isValidUrl(undefined as any)).toBe(false);
    });

    it('normalizes trailing slashes and /api prefixes', () => {
      expect(BackendConnectionManager.normalizeUrl('http://10.122.196.96:8000/')).toBe(
        'http://10.122.196.96:8000'
      );
      expect(BackendConnectionManager.normalizeUrl('http://10.122.196.96:8000/api')).toBe(
        'http://10.122.196.96:8000'
      );
      expect(BackendConnectionManager.normalizeUrl('http://10.122.196.96:8000/api/')).toBe(
        'http://10.122.196.96:8000'
      );
    });

    it('returns normalized API URL with /api suffix', () => {
      const apiUrl = BackendConnectionManager.getApiUrl();
      expect(apiUrl.endsWith('/api')).toBe(true);
      expect(apiUrl).not.toContain('//api');
    });
  });

  describe('2. MMKV Storage Persistence & Fallback', () => {
    it('falls back to development default when no MMKV override exists', () => {
      expect(BackendConnectionManager.hasCustomUrl()).toBe(false);
      expect(BackendConnectionManager.getBaseUrl()).toBe(
        BackendConnectionManager.getDefaultUrl()
      );
    });

    it('persists custom URL in MMKV and returns it from getBaseUrl', () => {
      const customUrl = 'http://192.168.1.42:8000';
      BackendConnectionManager.setBaseUrl(customUrl);

      expect(BackendConnectionManager.hasCustomUrl()).toBe(true);
      expect(BackendConnectionManager.getBaseUrl()).toBe(customUrl);
      expect(BackendConnectionManager.getApiUrl()).toBe('http://192.168.1.42:8000/api');
      expect(StorageService.getBackendUrlOverride()).toBe(customUrl);
    });

    it('throws validation error when setting invalid URL', () => {
      expect(() => {
        BackendConnectionManager.setBaseUrl('invalid-address-without-http');
      }).toThrow('Invalid backend URL');
    });

    it('clears MMKV override and resets to default on resetBaseUrl', () => {
      BackendConnectionManager.setBaseUrl('http://192.168.1.99:8000');
      expect(BackendConnectionManager.hasCustomUrl()).toBe(true);

      BackendConnectionManager.resetBaseUrl();
      expect(BackendConnectionManager.hasCustomUrl()).toBe(false);
      expect(BackendConnectionManager.getBaseUrl()).toBe(
        BackendConnectionManager.getDefaultUrl()
      );
    });
  });

  describe('3. Ping & Latency Measurement', () => {
    it('measures latency and returns Connected when backend responds 200 healthy', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          data: {
            status: 'healthy',
            version: '1.2.0',
            database: 'connected',
          },
        },
      });

      const result = await BackendConnectionManager.ping('http://10.122.196.96:8000');

      expect(result.isHealthy).toBe(true);
      expect(result.status).toBe('Connected');
      expect(result.version).toBe('1.2.0');
      expect(result.database).toBe('connected');
      expect(result.latencyMs).toBeGreaterThanOrEqual(1);
    });

    it('reports Offline when network error occurs', async () => {
      const netErr: any = new Error('Network Error');
      netErr.code = 'ERR_NETWORK';
      mockedAxios.get.mockRejectedValueOnce(netErr);

      const result = await BackendConnectionManager.ping('http://10.122.196.96:8000');

      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe('Offline');
      expect(result.errorMessage).toContain('Cannot connect to ContextVault backend');
    });

    it('reports Timeout when request exceeds timeout threshold', async () => {
      const timeoutErr: any = new Error('timeout of 5000ms exceeded');
      timeoutErr.code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValueOnce(timeoutErr);

      const result = await BackendConnectionManager.ping('http://10.122.196.96:8000');

      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe('Timeout');
      expect(result.errorMessage).toContain('timed out');
    });
  });

  describe('4. Runtime URL Migration & Startup Health Check (Requirements 3 & 5)', () => {
    it('returns healthy without migration if saved URL is responsive', async () => {
      BackendConnectionManager.setBaseUrl('http://192.168.1.55:8000');

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'healthy', version: '1.0.0' },
      });

      const startupResult = await BackendConnectionManager.performStartupHealthCheck();

      expect(startupResult.isHealthy).toBe(true);
      expect(startupResult.migrated).toBe(false);
      expect(startupResult.activeUrl).toBe('http://192.168.1.55:8000');
    });

    it('auto-migrates unreachable saved URL to default fallback when fallback is responsive', async () => {
      const staleUrl = 'http://192.168.1.99:8000';
      BackendConnectionManager.setBaseUrl(staleUrl);

      // 1. Saved URL fails with Network Error
      const netErr: any = new Error('Network Error');
      netErr.code = 'ERR_NETWORK';
      mockedAxios.get.mockRejectedValueOnce(netErr);

      // 2. Fallback default succeeds
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'healthy', version: '1.0.0', database: 'connected' },
      });

      const startupResult = await BackendConnectionManager.performStartupHealthCheck();

      // Verified auto-migration occurred
      expect(startupResult.isHealthy).toBe(true);
      expect(startupResult.migrated).toBe(true);
      expect(startupResult.previousUrl).toBe(staleUrl);
      expect(startupResult.activeUrl).toBe(BackendConnectionManager.getDefaultUrl());

      // Subsequent getBaseUrl() returns the migrated default URL
      expect(BackendConnectionManager.getBaseUrl()).toBe(
        BackendConnectionManager.getDefaultUrl()
      );
    });

    it('reports unreachable when both saved URL and fallback are offline', async () => {
      BackendConnectionManager.setBaseUrl('http://192.168.1.99:8000');

      const netErr: any = new Error('Network Error');
      netErr.code = 'ERR_NETWORK';
      mockedAxios.get.mockRejectedValueOnce(netErr); // Saved URL probe fails
      mockedAxios.get.mockRejectedValueOnce(netErr); // Fallback probe fails

      const startupResult = await BackendConnectionManager.performStartupHealthCheck();

      expect(startupResult.isHealthy).toBe(false);
      expect(startupResult.migrated).toBe(false);
      expect(startupResult.errorMessage).toContain('Cannot connect to ContextVault backend');
    });
  });
});

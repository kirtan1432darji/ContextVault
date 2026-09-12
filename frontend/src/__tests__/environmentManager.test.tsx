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
import { EnvironmentManager, DevelopmentEnvironment, LocalReleaseEnvironment, ProductionEnvironment } from '../config/EnvironmentManager';
import { backendConnectionService } from '../services/BackendConnectionService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EnvironmentManager & BackendConnectionService Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EnvironmentManager.resetToDefaultUrl();
  });

  describe('1. EnvironmentManager Environment & URL Resolution', () => {
    it('provides valid default development environment and base URL', () => {
      expect(DevelopmentEnvironment.env).toBe('development');
      expect(DevelopmentEnvironment.apiBaseUrl).toContain('http');
      expect(DevelopmentEnvironment.debugFlags.enableDeveloperMode).toBe(true);
    });

    it('provides valid local release environment and base URL', () => {
      expect(LocalReleaseEnvironment.env).toBe('local_release');
      expect(LocalReleaseEnvironment.apiBaseUrl).toContain('http');
      expect(LocalReleaseEnvironment.debugFlags.enableDeveloperMode).toBe(false);
    });

    it('provides production environment with developer mode disabled', () => {
      expect(ProductionEnvironment.env).toBe('production');
      expect(ProductionEnvironment.apiBaseUrl).toBe('https://api.contextvault.app');
      expect(ProductionEnvironment.debugFlags.enableDeveloperMode).toBe(false);
    });

    it('returns normalized API URL with /api suffix', () => {
      const apiUrl = EnvironmentManager.getApiUrl();
      expect(apiUrl.endsWith('/api')).toBe(true);
      expect(apiUrl).not.toContain('//api');
    });

    it('validates URL formats correctly', () => {
      expect(EnvironmentManager.isValidUrl('http://10.122.196.152:8000')).toBe(true);
      expect(EnvironmentManager.isValidUrl('https://api.contextvault.app')).toBe(true);
      expect(EnvironmentManager.isValidUrl('ftp://invalid.com')).toBe(false);
      expect(EnvironmentManager.isValidUrl('10.122.196.152:8000')).toBe(false);
      expect(EnvironmentManager.isValidUrl('')).toBe(false);
    });
  });

  describe('2. MMKV Runtime Override & Reset', () => {
    it('sets custom backend URL in MMKV and updates getApiBaseUrl', () => {
      const customUrl = 'http://192.168.1.50:8000';
      EnvironmentManager.setCustomBackendUrl(customUrl);

      expect(EnvironmentManager.getApiBaseUrl()).toBe(customUrl);
      expect(EnvironmentManager.getApiUrl()).toBe('http://192.168.1.50:8000/api');
    });

    it('throws error when setting invalid URL', () => {
      expect(() => {
        EnvironmentManager.setCustomBackendUrl('invalid-url-without-protocol');
      }).toThrow('Invalid backend URL');
    });

    it('resets to default URL and removes MMKV override', () => {
      EnvironmentManager.setCustomBackendUrl('http://192.168.1.50:8000');
      expect(EnvironmentManager.getApiBaseUrl()).toBe('http://192.168.1.50:8000');

      EnvironmentManager.resetToDefaultUrl();
      expect(EnvironmentManager.getApiBaseUrl()).toBe(EnvironmentManager.getDefaultUrl());
    });
  });

  describe('3. BackendConnectionService Diagnostics', () => {
    it('reports Connected status with latency and version when health check passes', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          status: 'healthy',
          version: '1.0.0',
          database: 'connected',
        },
      });

      const res = await backendConnectionService.pingBackend('http://10.122.196.152:8000');
      expect(res.status).toBe('Connected');
      expect(res.isHealthy).toBe(true);
      expect(res.latencyMs).toBeGreaterThan(0);
      expect(res.version).toBe('1.0.0');
      expect(res.database).toBe('connected');
    });

    it('reports Timeout status when connection times out', async () => {
      const timeoutErr: any = new Error('timeout of 5000ms exceeded');
      timeoutErr.code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValueOnce(timeoutErr);

      const res = await backendConnectionService.pingBackend('http://10.122.196.152:8000');
      expect(res.status).toBe('Timeout');
      expect(res.isHealthy).toBe(false);
      expect(res.errorMessage).toContain('timed out');
    });

    it('reports Unauthorized status on 401 response', async () => {
      const unauthErr: any = new Error('Request failed with status code 401');
      unauthErr.response = { status: 401 };
      mockedAxios.get.mockRejectedValueOnce(unauthErr);

      const res = await backendConnectionService.pingBackend('http://10.122.196.152:8000');
      expect(res.status).toBe('Unauthorized');
      expect(res.isHealthy).toBe(false);
    });

    it('reports Offline status on general network failure', async () => {
      const networkErr: any = new Error('Network Error');
      networkErr.code = 'ERR_NETWORK';
      mockedAxios.get.mockRejectedValueOnce(networkErr);

      const res = await backendConnectionService.pingBackend('http://10.122.196.152:8000');
      expect(res.status).toBe('Offline');
      expect(res.isHealthy).toBe(false);
      expect(res.errorMessage).toContain('Cannot connect to ContextVault backend');
    });
  });
});

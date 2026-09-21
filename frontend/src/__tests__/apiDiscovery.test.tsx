import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
  getApiBaseUrl,
  getApiBaseUrlAsync,
  setApiBaseUrl,
  resetApiBaseUrl,
  testConnection,
  normalizeUrl,
  isValidUrl,
  DEFAULT_FALLBACK_URL,
  STORAGE_KEY_BACKEND_URL,
} from '../config/api';

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

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    getItem: jest.fn(async (key: string) => store[key] || null),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
    _resetStore: () => {
      store = {};
    },
  };
});

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Discovery & Centralized Configuration Suite', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage as any)._resetStore();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.REACT_NATIVE_API_BASE_URL;
    delete process.env.API_BASE_URL;
    await resetApiBaseUrl();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. URL Validation & Normalization', () => {
    it('validates URLs correctly', () => {
      expect(isValidUrl('http://10.33.95.152:8000')).toBe(true);
      expect(isValidUrl('https://api.contextvault.app')).toBe(true);
      expect(isValidUrl('http://localhost:8000')).toBe(true);
      expect(isValidUrl('10.33.95.152:8000')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null as any)).toBe(false);
    });

    it('normalizes trailing slashes and /api prefixes', () => {
      expect(normalizeUrl('http://10.33.95.152:8000/')).toBe('http://10.33.95.152:8000');
      expect(normalizeUrl('http://10.33.95.152:8000/api')).toBe('http://10.33.95.152:8000');
      expect(normalizeUrl('http://10.33.95.152:8000/api/')).toBe('http://10.33.95.152:8000');
    });
  });

  describe('2. Three-Tier Priority Backend Resolution', () => {
    it('Priority 3: Falls back to DEFAULT_FALLBACK_URL when AsyncStorage and Env are empty', async () => {
      const url = await getApiBaseUrlAsync();
      expect(url).toBe(DEFAULT_FALLBACK_URL);
      expect(url).toBe('http://10.33.95.152:8000');
    });

    it('Priority 2: Resolves from EXPO_PUBLIC_API_URL when AsyncStorage is empty', async () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.50:8000';
      const url = await getApiBaseUrlAsync();
      expect(url).toBe('http://192.168.1.50:8000');
    });

    it('Priority 1: Resolves from AsyncStorage override ahead of env and fallback', async () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.50:8000';
      await AsyncStorage.setItem(STORAGE_KEY_BACKEND_URL, 'http://10.0.0.99:8000');

      const url = await getApiBaseUrlAsync();
      expect(url).toBe('http://10.0.0.99:8000');
    });
  });

  describe('3. Mutating & Resetting Backend URL', () => {
    it('setApiBaseUrl validates, persists to AsyncStorage, and updates in-memory cache', async () => {
      await setApiBaseUrl('http://192.168.2.100:8000/api/');
      expect(getApiBaseUrl()).toBe('http://192.168.2.100:8000');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY_BACKEND_URL,
        'http://192.168.2.100:8000'
      );
    });

    it('setApiBaseUrl throws on invalid URL', async () => {
      await expect(setApiBaseUrl('invalid-url')).rejects.toThrow();
    });

    it('resetApiBaseUrl removes AsyncStorage override and reverts to default', async () => {
      await setApiBaseUrl('http://192.168.2.100:8000');
      expect(getApiBaseUrl()).toBe('http://192.168.2.100:8000');

      const reverted = await resetApiBaseUrl();
      expect(reverted).toBe(DEFAULT_FALLBACK_URL);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY_BACKEND_URL);
      expect(getApiBaseUrl()).toBe(DEFAULT_FALLBACK_URL);
    });
  });

  describe('4. testConnection Health Check', () => {
    it('returns Connected on HTTP 200 /health', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'healthy',
          database: 'connected',
          version: '1.0.0',
        },
      } as any);

      const result = await testConnection('http://10.33.95.152:8000');
      expect(result.isHealthy).toBe(true);
      expect(result.status).toBe('Connected');
      expect(result.database).toBe('connected');
      expect(result.version).toBe('1.0.0');
      expect(result.baseUrl).toBe('http://10.33.95.152:8000');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://10.33.95.152:8000/health',
        expect.any(Object)
      );
    });

    it('falls back to /api/health if /health returns 404', async () => {
      mockedAxios.get
        .mockRejectedValueOnce({
          response: { status: 404, data: { detail: 'Not Found' } },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            status: 'healthy',
            database: 'connected',
            version: '1.0.0',
          },
        } as any);

      const result = await testConnection('http://10.33.95.152:8000');
      expect(result.isHealthy).toBe(true);
      expect(result.status).toBe('Connected');
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        'http://10.33.95.152:8000/health',
        expect.any(Object)
      );
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        'http://10.33.95.152:8000/api/health',
        expect.any(Object)
      );
    });

    it('returns Connection Failed on network timeout', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      });

      const result = await testConnection('http://10.33.95.152:8000');
      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe('Connection Failed');
      expect(result.errorMessage).toContain('timed out');
    });

    it('returns Connection Failed on network error', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ERR_NETWORK',
        message: 'Network Error',
      });

      const result = await testConnection('http://10.33.95.152:8000');
      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe('Connection Failed');
      expect(result.errorMessage).toContain('Network Error');
    });
  });
});

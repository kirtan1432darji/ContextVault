jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(() => 'light'),
    StyleSheet: {
      create: (styles: any) => styles,
      hairlineWidth: 1,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android ?? obj.default,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 400, height: 800 })),
    },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    TextInput: 'TextInput',
    ActivityIndicator: 'ActivityIndicator',
    ScrollView: 'ScrollView',
    Modal: ({ children, visible }: any) => (visible ? children : null),
  };
});

jest.mock('../theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E5E7EB',
      primary: '#1A73E8',
      secondary: '#5F6368',
      accent: '#188038',
      success: '#188038',
      warning: '#F29900',
      error: '#D93025',
      textPrimary: '#202124',
      textSecondary: '#5F6368',
      textMuted: '#80868B',
    },
  }),
}));

// Mock axios for auth network tests
jest.mock('axios', () => {
  const mPost = jest.fn();
  const mGet = jest.fn();
  const mPut = jest.fn();
  const mDelete = jest.fn();
  const mAxiosInstance = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: mGet,
    post: mPost,
    put: mPut,
    delete: mDelete,
  };
  return {
    create: jest.fn(() => mAxiosInstance),
    post: mPost,
    get: mGet,
    put: mPut,
    delete: mDelete,
  };
});
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../config/developerConfig', () => ({
  DEVELOPER_MODE: false,
  MOCK_DEVELOPER_USER: {
    id: 'mock-dev-user-id',
    username: 'DeveloperMode',
    email: 'developer@contextvault.local',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  MOCK_DEV_ACCESS_TOKEN: 'mock-developer-access-token',
  MOCK_DEV_REFRESH_TOKEN: 'mock-developer-refresh-token',
}));

import { authService } from '../services/authService';
import { useAuthStore } from '../store/auth.store';
import { StorageService } from '../utils/storage';

describe('ContextVault Sprint P0-4 — Authentication Completion Suite', () => {
  const mockUser = {
    id: 'user_123',
    username: 'testpilot',
    email: 'pilot@contextvault.dev',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    StorageService.clearAuthSession();
    StorageService.clearGuestSession();
    useAuthStore.getState().clearSession();
  });

  describe('1. Login Flow', () => {
    it('authenticates user successfully with valid credentials and stores JWT in MMKV', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          data: {
            accessToken: 'jwt_access_token_abc',
            refreshToken: 'jwt_refresh_token_xyz',
            tokenType: 'Bearer',
            user: mockUser,
          },
        },
      });

      const result = await authService.login({
        emailOrUsername: 'pilot@contextvault.dev',
        password: 'SecurePassword123!',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.data?.accessToken).toBe('jwt_access_token_abc');
      expect(result.data?.refreshToken).toBe('jwt_refresh_token_xyz');
      expect(result.data?.user?.username).toBe('testpilot');

      // Test store integration
      useAuthStore.getState().setTokens(
        result.data!.accessToken,
        result.data!.refreshToken,
        result.data!.user
      );

      const storeState = useAuthStore.getState();
      expect(storeState.isAuthenticated).toBe(true);
      expect(storeState.accessToken).toBe('jwt_access_token_abc');
      expect(storeState.currentUser?.username).toBe('testpilot');

      // Verify MMKV persistence
      expect(StorageService.getAccessToken()).toBe('jwt_access_token_abc');
      expect(StorageService.getRefreshToken()).toBe('jwt_refresh_token_xyz');
    });

    it('handles invalid credentials and returns formatted error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            success: false,
            message: 'Invalid email or password.',
          },
        },
      });

      const result = await authService.login({
        emailOrUsername: 'wrong@example.com',
        password: 'BadPassword',
      });

      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Invalid email or password.');
    });
  });

  describe('2. Auto Login Flow', () => {
    it('restores authenticated session automatically when valid tokens exist in MMKV', async () => {
      StorageService.setAccessToken('cached_valid_access_token');
      StorageService.setRefreshToken('cached_valid_refresh_token');
      StorageService.setUserProfile(mockUser);

      // Mock profile endpoint response
      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValueOnce({
          data: {
            success: true,
            data: mockUser,
          },
        }),
      };
      jest.spyOn(authService, 'profile').mockResolvedValueOnce({
        isSuccess: true,
        data: mockUser,
      } as any);

      const autoLoginSuccess = await useAuthStore.getState().loadSession();

      expect(autoLoginSuccess).toBe(true);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('cached_valid_access_token');
      expect(state.currentUser?.email).toBe('pilot@contextvault.dev');
    });

    it('clears session when no tokens exist in MMKV', async () => {
      const autoLoginSuccess = await useAuthStore.getState().loadSession();

      expect(autoLoginSuccess).toBe(false);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.currentUser).toBeNull();
    });
  });

  describe('3. Refresh Token Flow', () => {
    it('refreshes expired access token using refresh token', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          data: {
            accessToken: 'new_jwt_access_token_def',
            refreshToken: 'new_jwt_refresh_token_uvw',
            tokenType: 'Bearer',
            user: mockUser,
          },
        },
      });

      const refreshResult = await authService.refreshToken('old_refresh_token_123');

      expect(refreshResult.isSuccess).toBe(true);
      expect(refreshResult.data?.accessToken).toBe('new_jwt_access_token_def');
      expect(refreshResult.data?.refreshToken).toBe('new_jwt_refresh_token_uvw');
    });

    it('handles refresh token rejection and reports session expired', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { message: 'Refresh token expired or revoked.' },
        },
      });

      const refreshResult = await authService.refreshToken('expired_token');

      expect(refreshResult.isSuccess).toBe(false);
      expect(refreshResult.error).toMatch(/expired|revoked/i);
    });
  });

  describe('4. Forgot Password Email Flow', () => {
    it('dispatches password reset request with valid email format', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true, message: 'Password reset link sent.' },
      });

      const resetResult = await authService.requestPasswordReset('pilot@contextvault.dev');

      expect(resetResult.isSuccess).toBe(true);
    });

    it('handles backend 404 with graceful offline fallback', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 404 },
      });

      const resetResult = await authService.requestPasswordReset('fallback@contextvault.dev');

      expect(resetResult.isSuccess).toBe(true);
    });
  });

  describe('5. Logout Flow', () => {
    it('clears all JWT tokens, user state, and MMKV storage on logout', async () => {
      useAuthStore.getState().setTokens('access_123', 'refresh_456', mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(StorageService.getAccessToken()).toBe('access_123');

      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: { success: true } });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.currentUser).toBeNull();

      // MMKV should be cleared
      expect(StorageService.getAccessToken()).toBeNull();
      expect(StorageService.getRefreshToken()).toBeNull();
      expect(StorageService.getUserProfile()).toBeNull();
    });
  });

  describe('6. Error State Management and Screen Isolation', () => {
    it('sets and clears error state via clearError', () => {
      useAuthStore.setState({ error: 'Invalid email/username or password.' });
      expect(useAuthStore.getState().error).toBe('Invalid email/username or password.');

      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('formats network error into user-friendly message', async () => {
      const netErr: any = new Error('Network Error');
      netErr.code = 'ERR_NETWORK';
      mockedAxios.post.mockRejectedValueOnce(netErr);

      const result = await authService.login({
        emailOrUsername: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.isSuccess).toBe(false);
      expect(result.error).toMatch(/unable to connect to contextvault backend/i);
    });

    it('formats timeout error into user-friendly message', async () => {
      const timeoutErr: any = new Error('timeout of 30000ms exceeded');
      timeoutErr.code = 'ECONNABORTED';
      mockedAxios.post.mockRejectedValueOnce(timeoutErr);

      const result = await authService.login({
        emailOrUsername: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.isSuccess).toBe(false);
      expect(result.error).toMatch(/backend timed out/i);
    });

    it('formats 500 internal server error into user-friendly message', async () => {
      const serverErr: any = new Error('Internal Server Error');
      serverErr.response = { status: 500 };
      mockedAxios.post.mockRejectedValueOnce(serverErr);

      const result = await authService.login({
        emailOrUsername: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.isSuccess).toBe(false);
      expect(result.error).toMatch(/backend server error/i);
    });
  });
});

import { create } from 'zustand';
import { UserModel, LoginPayload, RegisterPayload } from '../models/auth.model';
import { authService } from '../services/authService';
import { StorageService } from '../utils/storage';
import {
  DEVELOPER_MODE,
  MOCK_DEVELOPER_USER,
  MOCK_DEV_ACCESS_TOKEN,
  MOCK_DEV_REFRESH_TOKEN,
} from '../config/developerConfig';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: UserModel | null;
  user: UserModel | null; // Alias for backward compatibility
  isAuthenticated: boolean;
  loading: boolean;
  isLoading: boolean; // Compatibility alias
  isInitializing: boolean;
  isDeveloperMode: boolean;
  error: string | null;

  // Actions required by sprint specification
  login: (payload: LoginPayload) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  loadSession: () => Promise<boolean>;
  clearSession: () => void;

  // Compatibility helpers
  setTokens: (accessToken: string, refreshToken: string, user?: UserModel) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: DEVELOPER_MODE ? MOCK_DEV_ACCESS_TOKEN : null,
  refreshToken: DEVELOPER_MODE ? MOCK_DEV_REFRESH_TOKEN : null,
  currentUser: DEVELOPER_MODE ? MOCK_DEVELOPER_USER : null,
  user: DEVELOPER_MODE ? MOCK_DEVELOPER_USER : null,
  isAuthenticated: DEVELOPER_MODE ? true : false,
  loading: false,
  isLoading: false,
  isInitializing: DEVELOPER_MODE ? false : true,
  isDeveloperMode: DEVELOPER_MODE,
  error: null,

  setTokens: (accessToken: string, refreshToken: string, user?: UserModel) => {
    StorageService.setAccessToken(accessToken);
    StorageService.setRefreshToken(refreshToken);
    if (user) {
      StorageService.setUserProfile(user);
    }
    const resolvedUser = user ?? get().currentUser;
    set({
      accessToken,
      refreshToken,
      currentUser: resolvedUser,
      user: resolvedUser,
      isAuthenticated: true,
      loading: false,
      isLoading: false,
      error: null,
    });
  },

  clearSession: () => {
    StorageService.clearAuthSession();
    set({
      accessToken: null,
      refreshToken: null,
      currentUser: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      isLoading: false,
      error: null,
    });
  },

  clearAuth: () => {
    get().clearSession();
  },

  loadSession: async () => {
    if (DEVELOPER_MODE) {
      set({
        accessToken: MOCK_DEV_ACCESS_TOKEN,
        refreshToken: MOCK_DEV_REFRESH_TOKEN,
        currentUser: MOCK_DEVELOPER_USER,
        user: MOCK_DEVELOPER_USER,
        isAuthenticated: true,
        loading: false,
        isLoading: false,
        isInitializing: false,
        isDeveloperMode: true,
        error: null,
      });
      return true;
    }

    set({ isInitializing: true, error: null });
    try {
      const storedAccessToken = StorageService.getAccessToken();
      const storedRefreshToken = StorageService.getRefreshToken();
      const storedUser = StorageService.getUserProfile();

      if (!storedAccessToken || !storedRefreshToken) {
        set({
          accessToken: null,
          refreshToken: null,
          currentUser: null,
          user: null,
          isAuthenticated: false,
          isInitializing: false,
        });
        return false;
      }

      // Populate state with cached credentials so API interceptor can attach token
      set({
        accessToken: storedAccessToken,
        refreshToken: storedRefreshToken,
        currentUser: storedUser,
        user: storedUser,
        isAuthenticated: true,
      });

      // 1. Validate session against backend profile endpoint
      const profileRes = await authService.profile(storedAccessToken);
      if (profileRes.isSuccess && profileRes.data) {
        const liveUser = profileRes.data;
        StorageService.setUserProfile(liveUser);
        set({
          currentUser: liveUser,
          user: liveUser,
          isAuthenticated: true,
          isInitializing: false,
          error: null,
        });
        return true;
      }

      // 2. If profile validation failed, attempt to refresh token
      const refreshRes = await authService.refreshToken(storedRefreshToken);
      if (refreshRes.isSuccess && refreshRes.data) {
        const { accessToken, refreshToken, user } = refreshRes.data;
        const newRefresh = refreshToken || storedRefreshToken;
        const finalUser = user || storedUser;

        StorageService.setAccessToken(accessToken);
        StorageService.setRefreshToken(newRefresh);
        if (finalUser) {
          StorageService.setUserProfile(finalUser);
        }

        set({
          accessToken,
          refreshToken: newRefresh,
          currentUser: finalUser,
          user: finalUser,
          isAuthenticated: true,
          isInitializing: false,
          error: null,
        });
        return true;
      }

      // 3. Both profile check and refresh failed -> expired session
      StorageService.clearAuthSession();
      set({
        accessToken: null,
        refreshToken: null,
        currentUser: null,
        user: null,
        isAuthenticated: false,
        isInitializing: false,
        error: 'Session expired. Please sign in again.',
      });
      return false;
    } catch (err: any) {
      StorageService.clearAuthSession();
      set({
        accessToken: null,
        refreshToken: null,
        currentUser: null,
        user: null,
        isAuthenticated: false,
        isInitializing: false,
      });
      return false;
    }
  },

  login: async (payload: LoginPayload) => {
    if (DEVELOPER_MODE) {
      set({
        accessToken: MOCK_DEV_ACCESS_TOKEN,
        refreshToken: MOCK_DEV_REFRESH_TOKEN,
        currentUser: MOCK_DEVELOPER_USER,
        user: MOCK_DEVELOPER_USER,
        isAuthenticated: true,
        loading: false,
        isLoading: false,
        isDeveloperMode: true,
        error: null,
      });
      return true;
    }

    set({ loading: true, isLoading: true, error: null });
    const result = await authService.login(payload);

    if (result.isSuccess && result.data) {
      const { accessToken, refreshToken, user } = result.data;
      StorageService.setAccessToken(accessToken);
      StorageService.setRefreshToken(refreshToken);
      if (user) {
        StorageService.setUserProfile(user);
      }

      set({
        accessToken,
        refreshToken,
        currentUser: user ?? null,
        user: user ?? null,
        isAuthenticated: true,
        loading: false,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({
      loading: false,
      isLoading: false,
      error: result.error || 'Authentication failed. Please check your credentials.',
    });
    return false;
  },

  register: async (payload: RegisterPayload) => {
    if (DEVELOPER_MODE) {
      set({
        accessToken: MOCK_DEV_ACCESS_TOKEN,
        refreshToken: MOCK_DEV_REFRESH_TOKEN,
        currentUser: MOCK_DEVELOPER_USER,
        user: MOCK_DEVELOPER_USER,
        isAuthenticated: true,
        loading: false,
        isLoading: false,
        isDeveloperMode: true,
        error: null,
      });
      return true;
    }

    set({ loading: true, isLoading: true, error: null });
    const result = await authService.register(payload);

    if (result.isSuccess && result.data) {
      const { accessToken, refreshToken, user } = result.data;
      StorageService.setAccessToken(accessToken);
      StorageService.setRefreshToken(refreshToken);
      if (user) {
        StorageService.setUserProfile(user);
      }

      set({
        accessToken,
        refreshToken,
        currentUser: user ?? null,
        user: user ?? null,
        isAuthenticated: true,
        loading: false,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({
      loading: false,
      isLoading: false,
      error: result.error || 'Registration failed. Please try again.',
    });
    return false;
  },

  refreshSession: async () => {
    if (DEVELOPER_MODE) {
      return true;
    }

    const currentRefreshToken = get().refreshToken || StorageService.getRefreshToken();
    if (!currentRefreshToken) {
      get().clearSession();
      return false;
    }

    const result = await authService.refreshToken(currentRefreshToken);
    if (result.isSuccess && result.data) {
      const { accessToken, refreshToken, user } = result.data;
      const finalRefresh = refreshToken || currentRefreshToken;

      StorageService.setAccessToken(accessToken);
      StorageService.setRefreshToken(finalRefresh);
      if (user) {
        StorageService.setUserProfile(user);
      }

      set({
        accessToken,
        refreshToken: finalRefresh,
        currentUser: user ?? get().currentUser,
        user: user ?? get().user,
        isAuthenticated: true,
        error: null,
      });
      return true;
    }

    get().clearSession();
    return false;
  },

  logout: async () => {
    if (DEVELOPER_MODE) {
      get().clearSession();
      return;
    }

    set({ loading: true, isLoading: true });
    const rToken = get().refreshToken || StorageService.getRefreshToken();
    if (rToken) {
      await authService.logout(rToken);
    }
    get().clearSession();
  },
}));

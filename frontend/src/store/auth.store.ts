import { create } from 'zustand';
import { UserModel, AuthResponseModel, LoginPayload, RegisterPayload } from '../models';
import { ApiConstants } from '../api/apiConstants';
import axios from 'axios';

interface AuthState {
  user: UserModel | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (payload: LoginPayload, baseUrl?: string) => Promise<boolean>;
  register: (payload: RegisterPayload, baseUrl?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, user?: UserModel) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setTokens: (accessToken: string, refreshToken: string, user?: UserModel) => {
    set({
      accessToken,
      refreshToken,
      user: user ?? get().user,
      isAuthenticated: true,
      error: null,
    });
  },

  clearAuth: () => {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  login: async (payload: LoginPayload, baseUrl = ApiConstants.defaultBaseUrl) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${baseUrl}${ApiConstants.authLogin}`, payload, {
        timeout: ApiConstants.connectTimeout,
      });

      const resData = response.data?.data || response.data;
      if (resData && (resData.accessToken || resData.token)) {
        const token = resData.accessToken || resData.token;
        const rToken = resData.refreshToken || '';
        const user = resData.user || {
          id: resData.userId || 'user_default',
          username: resData.username || payload.emailOrUsername,
          email: resData.email || payload.emailOrUsername,
          createdAt: new Date().toISOString(),
        };

        set({
          accessToken: token,
          refreshToken: rToken,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      }
      set({ isLoading: false, error: 'Invalid server response' });
      return false;
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || 'Login failed. Check credentials.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  register: async (payload: RegisterPayload, baseUrl = ApiConstants.defaultBaseUrl) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${baseUrl}${ApiConstants.authRegister}`, payload, {
        timeout: ApiConstants.connectTimeout,
      });

      const resData = response.data?.data || response.data;
      if (resData && (resData.accessToken || resData.token)) {
        const token = resData.accessToken || resData.token;
        const rToken = resData.refreshToken || '';
        const user = resData.user || {
          id: resData.userId || 'user_default',
          username: payload.username,
          email: payload.email,
          createdAt: new Date().toISOString(),
        };

        set({
          accessToken: token,
          refreshToken: rToken,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      }
      set({ isLoading: false, error: 'Registration succeeded without token' });
      return false;
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || 'Registration failed.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  logout: async () => {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));

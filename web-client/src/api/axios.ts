import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG, ROUTES } from '../utils/constants';
import { tokenService } from '../services/tokenService';
import { ApiResponse } from '../types/api';
import { TokenResponse } from '../types/auth';

/**
 * Mutex and queue state to prevent concurrent refresh requests (refresh stampedes).
 */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Primary Axios instance configured with environment-based Base URL and 30s timeout.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * 1. Request Interceptor: Automatically attach Bearer token
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenService.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 2. Response Interceptor: Handles 401 token refresh queue and error normalization
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is not 401 or request was already retried or it's an auth endpoint itself
    if (
      !error.response ||
      error.response.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/api/auth/login') ||
      originalRequest.url?.includes('/api/auth/register') ||
      originalRequest.url?.includes('/api/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    const refreshToken = tokenService.getRefreshToken();
    if (!refreshToken) {
      tokenService.clearTokens();
      if (window.location.pathname !== ROUTES.LOGIN) {
        window.location.href = ROUTES.LOGIN;
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue subsequent 401 requests while a refresh is in flight
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newAccessToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Direct axios call without interceptor to refresh endpoint
      const refreshResponse = await axios.post<ApiResponse<TokenResponse>>(
        `${API_CONFIG.BASE_URL}/api/auth/refresh`,
        { refreshToken },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const tokenData = refreshResponse.data.data;
      if (!tokenData || !tokenData.accessToken) {
        throw new Error('Refresh token response contained no valid access token');
      }

      tokenService.setTokens(tokenData.accessToken, tokenData.refreshToken, tokenData.user);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${tokenData.accessToken}`;
      }

      processQueue(null, tokenData.accessToken);
      return apiClient(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      tokenService.clearTokens();
      if (window.location.pathname !== ROUTES.LOGIN) {
        window.location.href = `${ROUTES.LOGIN}?sessionExpired=true`;
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

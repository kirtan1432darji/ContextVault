import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { ApiConstants } from './apiConstants';
import { Result } from '../utils/result';
import {
  AuthResponseModel,
  CategoryModel,
  ClassificationResultModel,
  FolderContextModel,
  TagModel,
  ScreenshotModel,
  ContextSearchResultDto,
} from '../models';
import { useAuthStore } from '../store/auth.store';
import { useSettingsStore } from '../store/settings.store';
import { StorageService } from '../utils/storage';
import { DEVELOPER_MODE } from '../config/developerConfig';
import { EnvironmentManager } from '../config/EnvironmentManager';
import { BackendConnectionManager } from '../services/BackendConnectionManager';

/**
 * Maps raw Axios and HTTP errors to consistent, user-friendly error messages
 * as specified in ContextVault Sprint P0-A requirements.
 */
export function formatApiErrorMessage(error: any, baseUrl: string): string {
  if (!error) return 'An unexpected error occurred.';

  const code = (error.code || '').toUpperCase();
  const rawMsg = error.message || '';
  const status = error.response?.status;
  const backendMsg =
    error.response?.data?.message ||
    error.response?.data?.detail ||
    (Array.isArray(error.response?.data?.errors) && error.response.data.errors[0]);

  if (code === 'ECONNREFUSED' || rawMsg.includes('ECONNREFUSED')) {
    return 'Backend server unavailable';
  }
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    rawMsg.toLowerCase().includes('timeout')
  ) {
    return 'Backend timed out';
  }
  if (
    code === 'ERR_NETWORK' ||
    code === 'NETWORK_ERROR' ||
    rawMsg.includes('Network Error') ||
    !error.response
  ) {
    return 'Unable to connect to ContextVault backend';
  }

  if (status === 401) {
    return backendMsg || 'Invalid email/username or password';
  }
  if (status === 403) {
    return backendMsg || 'Access denied';
  }
  if (status === 404) {
    return backendMsg || 'API endpoint not found';
  }
  if (status === 409) {
    return backendMsg || 'Email or username already exists';
  }
  if (status >= 500) {
    return backendMsg || 'Backend server error. Please retry later.';
  }

  return backendMsg || rawMsg || 'Cannot connect to ContextVault backend';
}

class ApiClient {
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void }[] = [];

  constructor() {
    const initialUrl = BackendConnectionManager.getApiUrl();
    this.axiosInstance = axios.create({
      baseURL: initialUrl,
      timeout: ApiConstants.connectTimeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client-Platform': 'ReactNative-Mobile',
        'X-Client-Version': '1.0.0',
      },
    });

    if (EnvironmentManager.isDeveloperModeAvailable()) {
      console.log(`[ApiClient] Configured baseURL: ${initialUrl} [Env: ${EnvironmentManager.getEnvironment()}]`);
    }

    this.setupInterceptors();
  }

  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    this.failedQueue = [];
  }

  private setupInterceptors() {
    // 1. Request Interceptor: Attach Bearer Token, Validate URL & Set Base URL dynamically
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const dynamicUrl = BackendConnectionManager.getApiUrl();
        if (!BackendConnectionManager.isValidUrl(dynamicUrl)) {
          return Promise.reject(new Error(`Invalid ContextVault backend URL: ${dynamicUrl}`));
        }
        config.baseURL = dynamicUrl;
        config.timeout = ApiConstants.connectTimeout || 30000;

        const token = useAuthStore.getState().accessToken || StorageService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        config.headers['X-Request-Id'] = Date.now().toString();

        if (EnvironmentManager.isDeveloperModeAvailable()) {
          console.log(`[ApiClient] Request to [${config.baseURL}] ${config.url || ''}`);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 2. Response Interceptor: 401 Refresh Token Retries, Temporary Network Failure Retry, Error Mapping
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = (error.config || {}) as AxiosRequestConfig & {
          _retry?: boolean;
          _networkRetry?: boolean;
        };

        const requestUrl = originalRequest.url || '';
        const isAuthEndpoint =
          requestUrl.includes(ApiConstants.authLogin) ||
          requestUrl.includes(ApiConstants.authRegister) ||
          requestUrl.includes(ApiConstants.authRefresh) ||
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/register');

        // Handle 401 Unauthorized with token refresh (for protected endpoints only)
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          if (DEVELOPER_MODE) {
            return Promise.reject(error);
          }

          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return this.axiosInstance(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          const refreshToken =
            useAuthStore.getState().refreshToken || StorageService.getRefreshToken();

          if (!refreshToken) {
            useAuthStore.getState().clearSession();
            this.isRefreshing = false;
            return Promise.reject(error);
          }

          try {
            const refreshRes = await this.axiosInstance.post(
              ApiConstants.authRefresh,
              { refreshToken },
              {
                headers: { 'Content-Type': 'application/json' },
              }
            );

            const unwrapped = this.unwrap<Partial<AuthResponseModel>>(refreshRes.data);
            const newAccessToken = unwrapped?.accessToken;
            const newRefreshToken = unwrapped?.refreshToken || refreshToken;

            if (newAccessToken) {
              useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
              this.processQueue(null, newAccessToken);

              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              }
              return this.axiosInstance(originalRequest);
            } else {
              useAuthStore.getState().clearSession();
              this.processQueue(error, null);
              return Promise.reject(error);
            }
          } catch (refreshErr) {
            useAuthStore.getState().clearSession();
            this.processQueue(refreshErr, null);
            return Promise.reject(refreshErr);
          } finally {
            this.isRefreshing = false;
          }
        }

        // Retry once for temporary network failures
        const isNetworkFailure =
          !error.response ||
          error.code === 'ERR_NETWORK' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNABORTED';

        if (isNetworkFailure && !originalRequest._networkRetry) {
          originalRequest._networkRetry = true;
          if (EnvironmentManager.isDeveloperModeAvailable()) {
            console.log(`[ApiClient] Temporary network failure on ${requestUrl}. Retrying once...`);
          }
          return this.axiosInstance(originalRequest);
        }

        // Standardized Error Mapping per specification
        const formattedMessage = formatApiErrorMessage(error, this.getBaseUrl());
        error.message = formattedMessage;
        (error as any).userMessage = formattedMessage;

        if (EnvironmentManager.isDeveloperModeAvailable()) {
          console.log(
            `[ApiClient] Error [${originalRequest.baseURL || this.getBaseUrl()}] ${requestUrl}: ${formattedMessage}`
          );
        }

        return Promise.reject(error);
      }
    );
  }

  public getBaseUrl(): string {
    return BackendConnectionManager.getApiUrl();
  }

  public getRawBaseUrl(): string {
    return BackendConnectionManager.getBaseUrl();
  }

  public setBaseUrl(url: string): void {
    BackendConnectionManager.setBaseUrl(url);
    this.axiosInstance.defaults.baseURL = BackendConnectionManager.getApiUrl();
    useSettingsStore.getState().setBackendUrl(url);
    // Sync to centralized api config and AsyncStorage
    try {
      const { setApiBaseUrl } = require('../config/api');
      setApiBaseUrl(url);
    } catch {}
  }

  public resetBaseUrl(): void {
    BackendConnectionManager.resetBaseUrl();
    this.axiosInstance.defaults.baseURL = BackendConnectionManager.getApiUrl();
    useSettingsStore.getState().setBackendUrl(BackendConnectionManager.getBaseUrl());
    try {
      const { resetApiBaseUrl } = require('../config/api');
      resetApiBaseUrl();
    } catch {}
  }

  private unwrap<T>(responseData: any): T {
    if (responseData && typeof responseData === 'object') {
      if ('data' in responseData) {
        return responseData.data as T;
      }
    }
    return responseData as T;
  }

  // ==================== SCREENSHOTS ====================

  async uploadScreenshotMetadata(payload: Record<string, any>): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.uploadMetadata, payload);
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Upload metadata failed', e);
    }
  }

  async fetchScreenshotById(id: string): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.get(`${ApiConstants.screenshots}/${id}`);
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Fetch screenshot failed', e);
    }
  }

  async scanScreenshot(payload: Record<string, any>): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.scanScreenshot, payload);
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Scan failed', e);
    }
  }

  async batchScanScreenshots(items: Record<string, any>[]): Promise<Result<any[]>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.batchScan, {
        screenshots: items,
        items,
      });
      const data = this.unwrap<any>(res.data);
      if (Array.isArray(data)) return Result.success(data);
      if (data?.items && Array.isArray(data.items)) return Result.success(data.items);
      return Result.success([]);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Batch scan failed', e);
    }
  }

  async fetchScreenshots(params: Record<string, any> = {}): Promise<Result<any[]>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.screenshots, { params });
      const unwrapped = this.unwrap<any>(res.data);
      if (Array.isArray(unwrapped)) return Result.success(unwrapped);
      if (unwrapped?.items && Array.isArray(unwrapped.items)) return Result.success(unwrapped.items);
      return Result.success([]);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch screenshots', e);
    }
  }

  async updateScreenshot(id: string, updates: Record<string, any>): Promise<Result<boolean>> {
    try {
      await this.axiosInstance.put(`${ApiConstants.screenshots}/${id}`, updates);
      return Result.success(true);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Update failed', e);
    }
  }

  async toggleFavorite(id: string, isFavorite?: boolean): Promise<Result<boolean>> {
    try {
      const res = await this.axiosInstance.patch(
        `${ApiConstants.screenshots}/${id}/favorite`,
        null,
        { params: isFavorite !== undefined ? { isFavorite } : {} }
      );
      return Result.success(this.unwrap<boolean>(res.data) ?? true);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Toggle favorite failed', e);
    }
  }

  async toggleReview(id: string, isReviewed = true): Promise<Result<boolean>> {
    try {
      const res = await this.axiosInstance.patch(
        `${ApiConstants.screenshots}/${id}/review`,
        null,
        { params: { isReviewed } }
      );
      return Result.success(this.unwrap<boolean>(res.data) ?? true);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Toggle review failed', e);
    }
  }

  async deleteScreenshot(id: string): Promise<Result<boolean>> {
    try {
      await this.axiosInstance.delete(`${ApiConstants.screenshots}/${id}`);
      return Result.success(true);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Delete failed', e);
    }
  }

  // ==================== CLASSIFICATION ====================

  async classifyScreenshot(payload: Record<string, any>): Promise<Result<ClassificationResultModel>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.classificationClassify, payload);
      return Result.success(this.unwrap<ClassificationResultModel>(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Classification failed', e);
    }
  }

  async reclassifyScreenshot(payload: Record<string, any>): Promise<Result<ClassificationResultModel>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.classificationReclassify, payload);
      return Result.success(this.unwrap<ClassificationResultModel>(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Reclassification failed', e);
    }
  }

  // ==================== CATEGORIES & TAGS ====================

  async fetchCategories(): Promise<Result<CategoryModel[]>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.categories);
      const data = this.unwrap<CategoryModel[]>(res.data);
      return Result.success(Array.isArray(data) ? data : []);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch categories', e);
    }
  }

  async fetchCategoriesTree(): Promise<Result<any[]>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.categories, { params: { tree: true } });
      const data = this.unwrap<any[]>(res.data);
      return Result.success(Array.isArray(data) ? data : []);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch category tree', e);
    }
  }

  async fetchTags(): Promise<Result<TagModel[]>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.tags);
      const data = this.unwrap<TagModel[]>(res.data);
      return Result.success(Array.isArray(data) ? data : []);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch tags', e);
    }
  }

  // ==================== FOLDER CONTEXT & CHAT ====================

  async fetchFolderContext(categoryId: string): Promise<Result<FolderContextModel>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.folderContext(categoryId));
      return Result.success(this.unwrap<FolderContextModel>(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch folder context', e);
    }
  }

  async generateFolderContext(categoryId: string): Promise<Result<FolderContextModel>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.generateFolderContext(categoryId));
      return Result.success(this.unwrap<FolderContextModel>(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to generate context', e);
    }
  }

  async sendChatMessage(payload: Record<string, any>): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.chatMessage, payload);
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Chat error', e);
    }
  }

  async fetchChatHistory(
    folderId: string,
    params?: { sessionId?: string; page?: number; pageSize?: number }
  ): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.chatHistory(folderId), { params });
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch chat history', e);
    }
  }

  async fetchChatSuggestions(folderId: string): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.chatSuggestions(folderId));
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch chat suggestions', e);
    }
  }

  async fetchChatSessions(folderId: string, limit = 20): Promise<Result<any[]>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.chatSessions(folderId), {
        params: { limit },
      });
      const data = this.unwrap<any[]>(res.data);
      return Result.success(Array.isArray(data) ? data : []);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to fetch chat sessions', e);
    }
  }

  async deleteChatSession(sessionId: string): Promise<Result<boolean>> {
    try {
      const res = await this.axiosInstance.delete(ApiConstants.chatDeleteSession(sessionId));
      return Result.success(Boolean(this.unwrap(res.data)));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Failed to delete chat session', e);
    }
  }

  // ==================== SEARCH & SYNC ====================

  async search(query: string, categoryId?: string, limit = 50): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.semanticSearch, {
        params: { q: query, categoryId, limit },
      });
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Search failed', e);
    }
  }

  async syncMetadata(payload: Record<string, any>): Promise<Result<any>> {
    try {
      const res = await this.axiosInstance.post(ApiConstants.sync, payload);
      return Result.success(this.unwrap(res.data));
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Sync failed', e);
    }
  }

  async searchContextKnowledge(query: string): Promise<Result<ContextSearchResultDto[]>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.contextSearch, {
        params: { q: query },
      });
      const data = this.unwrap<ContextSearchResultDto[]>(res.data);
      return Result.success(data || []);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Context search failed', e);
    }
  }

  async fetchCategoryTree(): Promise<Result<any[]>> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.categoryTree);
      const data = this.unwrap<any[]>(res.data);
      return Result.success(data || []);
    } catch (e: any) {
      return Result.failure(e.response?.data?.message || e.message || 'Category tree fetch failed', e);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.axiosInstance.get(ApiConstants.healthCheck, { timeout: 4000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();

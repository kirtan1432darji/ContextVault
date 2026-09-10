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

class ApiClient {
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void }[] = [];

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: ApiConstants.defaultBaseUrl,
      timeout: ApiConstants.connectTimeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client-Platform': 'ReactNative-Mobile',
        'X-Client-Version': '1.0.0',
      },
    });

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
    // 1. Request Interceptor: Attach Bearer Token & Dynamic Base URL
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const dynamicUrl = useSettingsStore.getState().backendUrl;
        if (dynamicUrl && dynamicUrl !== config.baseURL) {
          config.baseURL = dynamicUrl;
        }

        const token = useAuthStore.getState().accessToken || StorageService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        config.headers['X-Request-Id'] = Date.now().toString();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 2. Response Interceptor: 401 Refresh Token Retries
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (DEVELOPER_MODE) {
            // In Developer Mode, skip token refresh and avoid session eviction
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
            const refreshRes = await axios.post(
              `${this.getBaseUrl()}${ApiConstants.authRefresh}`,
              { refreshToken },
              {
                timeout: ApiConstants.connectTimeout,
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

        // Handle network unreachable / Docker host down or timeout errors with user-friendly messages
        if (!error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
          error.message = `Cannot connect to ContextVault Docker backend at ${this.getBaseUrl()}. Please ensure container 'contextvault-api' is running on Ubuntu host.`;
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          error.message = 'Connection to ContextVault backend timed out after 30 seconds.';
        }

        return Promise.reject(error);
      }
    );
  }

  public getBaseUrl(): string {
    return useSettingsStore.getState().backendUrl || ApiConstants.defaultBaseUrl;
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

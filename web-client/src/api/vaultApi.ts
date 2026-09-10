import { apiClient } from './axios';
import { ApiResponse } from '../types/api';
import {
  Category,
  FolderContext,
  PagedScreenshots,
  Screenshot,
  ScreenshotFilters,
} from '../types/vault';

/**
 * Vault & Screenshots API Service consuming ContextVault core organizational endpoints.
 */
export const vaultApi = {
  /**
   * Retrieve paginated screenshots with filtering by category, search term, and review status.
   */
  async listScreenshots(filters: ScreenshotFilters = {}): Promise<ApiResponse<PagedScreenshots>> {
    const params = new URLSearchParams();
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.subCategory) params.append('subCategory', filters.subCategory);
    if (filters.tag) params.append('tag', filters.tag);
    if (filters.isFavorite !== undefined) params.append('isFavorite', String(filters.isFavorite));
    if (filters.isReviewed !== undefined) params.append('isReviewed', String(filters.isReviewed));
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize));

    const response = await apiClient.get<ApiResponse<PagedScreenshots>>(
      `/api/screenshots?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Fetch single screenshot detail including OCR text and extracted entities.
   */
  async getScreenshotById(id: string): Promise<ApiResponse<Screenshot>> {
    const response = await apiClient.get<ApiResponse<Screenshot>>(`/api/screenshots/${id}`);
    return response.data;
  },

  /**
   * Update screenshot metadata (e.g. mark reviewed or favorite).
   */
  async updateScreenshot(
    id: string,
    payload: {
      categoryId?: string;
      subCategory?: string;
      isFavorite?: boolean;
      isReviewed?: boolean;
      tags?: string[];
    }
  ): Promise<ApiResponse<Screenshot>> {
    const response = await apiClient.put<ApiResponse<Screenshot>>(
      `/api/screenshots/${id}`,
      payload
    );
    return response.data;
  },

  /**
   * Retrieve categories taxonomy (hierarchical tree or flat list).
   */
  async listCategories(tree = true): Promise<ApiResponse<Category[]>> {
    const response = await apiClient.get<ApiResponse<Category[]>>(
      `/api/categories?tree=${tree}`
    );
    return response.data;
  },

  /**
   * Retrieve single category by ID.
   */
  async getCategoryById(id: string): Promise<ApiResponse<Category>> {
    const response = await apiClient.get<ApiResponse<Category>>(`/api/categories/${id}`);
    return response.data;
  },

  /**
   * Retrieve living folder AI executive summary and timeline context.
   */
  async getFolderContext(categoryId: string): Promise<ApiResponse<FolderContext>> {
    const response = await apiClient.get<ApiResponse<FolderContext>>(`/api/context/${categoryId}`);
    return response.data;
  },
};

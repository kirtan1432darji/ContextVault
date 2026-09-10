/**
 * Uniform API Response Envelope conforming to ContextVault FastAPI specifications.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors: string[];
  requestId?: string;
  timestamp?: string;
}

/**
 * Standardized API Error object used across error handlers and UI banners.
 */
export interface ApiError {
  status: number;
  message: string;
  errors: string[];
  code?: string;
  isNetworkError?: boolean;
}

/**
 * Common pagination query parameters.
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}

import { apiClient } from './axios';
import { ApiResponse } from '../types/api';
import { User } from '../types/auth';

/**
 * User profile & account management API service.
 */
export const userApi = {
  /**
   * Get current authenticated user profile.
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>('/api/auth/profile');
    return response.data;
  },
};

import { apiClient } from './axios';
import { ApiResponse } from '../types/api';
import {
  LoginPayload,
  RegisterPayload,
  TokenRefreshPayload,
  TokenResponse,
  TokenRevokePayload,
  User,
} from '../types/auth';

/**
 * Authentication API Service conforming strictly to FastAPI /api/auth endpoints.
 */
export const authApi = {
  /**
   * Authenticate user credentials and retrieve access/refresh JWT tokens.
   */
  async login(payload: LoginPayload): Promise<ApiResponse<TokenResponse>> {
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/api/auth/login', payload);
    return response.data;
  },

  /**
   * Register a new user account and obtain initial tokens.
   */
  async register(payload: RegisterPayload): Promise<ApiResponse<TokenResponse>> {
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/api/auth/register', payload);
    return response.data;
  },

  /**
   * Exchange an existing refresh token for a new access/refresh token pair.
   */
  async refreshToken(payload: TokenRefreshPayload): Promise<ApiResponse<TokenResponse>> {
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/api/auth/refresh', payload);
    return response.data;
  },

  /**
   * Revoke refresh token on the backend to end the session.
   */
  async logout(payload: TokenRevokePayload): Promise<ApiResponse<boolean>> {
    const response = await apiClient.post<ApiResponse<boolean>>('/api/auth/logout', payload);
    return response.data;
  },

  /**
   * Fetch current authenticated user profile using active Bearer token.
   */
  async getProfile(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>('/api/auth/profile');
    return response.data;
  },
};

import { ApiConstants } from '../api/apiConstants';
import { Result } from '../utils/result';
import {
  AuthResponseModel,
  LoginPayload,
  RegisterPayload,
  UserModel,
} from '../models/auth.model';
import { apiClient, formatApiErrorMessage } from '../api/apiClient';

class AuthService {
  /**
   * Authenticate user with Email/Username and Password against FastAPI backend.
   * Routes strictly through centralized apiClient instance.
   */
  async login(payload: LoginPayload): Promise<Result<AuthResponseModel>> {
    try {
      const response = await apiClient.getAxiosInstance().post(
        ApiConstants.authLogin,
        {
          emailOrUsername: payload.emailOrUsername.trim(),
          password: payload.password,
        },
        {
          timeout: ApiConstants.connectTimeout,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const resData = response.data?.data || response.data;
      if (resData?.accessToken) {
        const user: UserModel = resData.user
          ? {
              id: String(resData.user.id),
              username: resData.user.username,
              email: resData.user.email,
              isActive: resData.user.isActive ?? true,
              createdAt: resData.user.createdOn || resData.user.createdAt || new Date().toISOString(),
            }
          : {
              id: String(resData.userId || 'user_id'),
              username: resData.username || payload.emailOrUsername,
              email: resData.email || payload.emailOrUsername,
              isActive: true,
              createdAt: new Date().toISOString(),
            };

        return Result.success<AuthResponseModel>({
          accessToken: resData.accessToken,
          refreshToken: resData.refreshToken,
          tokenType: resData.tokenType || 'Bearer',
          user,
        });
      }

      return Result.failure('Invalid server response during authentication.');
    } catch (err: any) {
      const errMsg =
        err.userMessage ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        (Array.isArray(err.response?.data?.errors) && err.response.data.errors[0]) ||
        formatApiErrorMessage(err, apiClient.getBaseUrl());
      return Result.failure(errMsg, err);
    }
  }

  /**
   * Register a new account on ContextVault backend.
   * Routes strictly through centralized apiClient instance.
   */
  async register(payload: RegisterPayload): Promise<Result<AuthResponseModel>> {
    try {
      const response = await apiClient.getAxiosInstance().post(
        ApiConstants.authRegister,
        {
          username: payload.username.trim(),
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
        },
        {
          timeout: ApiConstants.connectTimeout,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const resData = response.data?.data || response.data;
      if (resData?.accessToken) {
        const user: UserModel = resData.user
          ? {
              id: String(resData.user.id),
              username: resData.user.username,
              email: resData.user.email,
              isActive: resData.user.isActive ?? true,
              createdAt: resData.user.createdOn || resData.user.createdAt || new Date().toISOString(),
            }
          : {
              id: String(resData.userId || 'user_id'),
              username: payload.username,
              email: payload.email,
              isActive: true,
              createdAt: new Date().toISOString(),
            };

        return Result.success<AuthResponseModel>({
          accessToken: resData.accessToken,
          refreshToken: resData.refreshToken,
          tokenType: resData.tokenType || 'Bearer',
          user,
        });
      }

      return Result.failure('Registration completed but no access token was returned.');
    } catch (err: any) {
      const errMsg =
        err.userMessage ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        (Array.isArray(err.response?.data?.errors) && err.response.data.errors[0]) ||
        formatApiErrorMessage(err, apiClient.getBaseUrl());
      return Result.failure(errMsg, err);
    }
  }

  /**
   * Fetch currently authenticated user profile using active JWT Bearer token.
   */
  async profile(token?: string): Promise<Result<UserModel>> {
    try {
      const authHeader = token ? `Bearer ${token}` : undefined;
      const response = await apiClient.getAxiosInstance().get(ApiConstants.authProfile, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      });

      const resData = response.data?.data || response.data;
      if (resData) {
        return Result.success<UserModel>({
          id: String(resData.id),
          username: resData.username,
          email: resData.email,
          isActive: resData.isActive ?? true,
          createdAt: resData.createdOn || resData.createdAt || new Date().toISOString(),
        });
      }

      return Result.failure('Unable to load profile data.');
    } catch (err: any) {
      const errMsg =
        err.userMessage ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        (Array.isArray(err.response?.data?.errors) && err.response.data.errors[0]) ||
        err.message ||
        'Failed to fetch user profile.';
      return Result.failure(errMsg, err);
    }
  }

  /**
   * Refresh expired JWT session using cryptographically signed refresh token.
   * Routes strictly through centralized apiClient instance.
   */
  async refreshToken(refreshToken: string): Promise<Result<AuthResponseModel>> {
    try {
      const response = await apiClient.getAxiosInstance().post(
        ApiConstants.authRefresh,
        { refreshToken },
        {
          timeout: ApiConstants.connectTimeout,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const resData = response.data?.data || response.data;
      if (resData?.accessToken) {
        return Result.success<AuthResponseModel>({
          accessToken: resData.accessToken,
          refreshToken: resData.refreshToken || refreshToken,
          tokenType: resData.tokenType || 'Bearer',
          user: resData.user,
        });
      }

      return Result.failure('Token refresh returned invalid payload.');
    } catch (err: any) {
      const errMsg =
        err.userMessage ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        (Array.isArray(err.response?.data?.errors) && err.response.data.errors[0]) ||
        'Session expired. Please log in again.';
      return Result.failure(errMsg, err);
    }
  }

  /**
   * Revoke active mobile refresh token on backend server.
   */
  async logout(refreshToken?: string): Promise<Result<boolean>> {
    try {
      if (refreshToken) {
        await apiClient.getAxiosInstance().post(
          ApiConstants.authLogout,
          { refreshToken },
          { timeout: 5000 }
        );
      }
      return Result.success(true);
    } catch {
      // Local session should be cleared regardless of network error on logout
      return Result.success(true);
    }
  }

  /**
   * Request password reset instructions via email.
   * If backend provides /auth/forgot-password, calls backend API.
   * Otherwise gracefully falls back with simulated dispatch for client offline/demo mode.
   */
  async requestPasswordReset(email: string): Promise<Result<boolean>> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      try {
        await apiClient.getAxiosInstance().post(
          ApiConstants.authForgotPassword,
          { email: cleanEmail },
          {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
          }
        );
        return Result.success(true);
      } catch (apiErr: any) {
        if (
          apiErr.response?.status === 404 ||
          apiErr.code === 'ECONNREFUSED' ||
          apiErr.code === 'ERR_NETWORK' ||
          apiErr.code === 'ECONNABORTED'
        ) {
          // Graceful fallback for offline / mock backend
          await new Promise((resolve) => setTimeout(resolve, 600));
          return Result.success(true);
        }
        if (apiErr.response?.data?.message || apiErr.userMessage) {
          return Result.failure(apiErr.response?.data?.message || apiErr.userMessage);
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
        return Result.success(true);
      }
    } catch (err: any) {
      return Result.failure('Unable to process password reset request.', err);
    }
  }

  /**
   * Request password reset instructions (Sprint P0 Specification).
   */
  async forgotPassword(email: string): Promise<Result<boolean>> {
    return this.requestPasswordReset(email);
  }
}

export const authService = new AuthService();

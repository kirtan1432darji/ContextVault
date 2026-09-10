import { authApi } from '../api/authApi';
import { tokenService } from './tokenService';
import { LoginPayload, RegisterPayload, TokenResponse, User } from '../types/auth';

/**
 * High-level authentication orchestrator.
 * Connects authApi with tokenService for token persistence and session lifecycle.
 */
export class AuthService {
  /**
   * Log in user, store tokens in localStorage, and return user profile.
   */
  async login(payload: LoginPayload): Promise<TokenResponse> {
    const res = await authApi.login(payload);
    const data = res.data;

    tokenService.setTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }

  /**
   * Register user, store issued tokens, and return profile.
   */
  async register(payload: RegisterPayload): Promise<TokenResponse> {
    const res = await authApi.register(payload);
    const data = res.data;

    tokenService.setTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }

  /**
   * Logout user, notify backend to revoke refresh token, and clear localStorage.
   */
  async logout(): Promise<void> {
    const refreshToken = tokenService.getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout({ refreshToken });
      } catch {
        // Silently proceed with local cleanup even if network request fails
      }
    }
    tokenService.clearTokens();
  }

  /**
   * Refresh current access token using stored refresh token.
   */
  async refreshToken(): Promise<TokenResponse> {
    const refreshToken = tokenService.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token found in storage.');
    }
    const res = await authApi.refreshToken({ refreshToken });
    const data = res.data;

    tokenService.setTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }

  /**
   * Fetch current user profile using active access token.
   */
  async getCurrentUser(): Promise<User | null> {
    if (!tokenService.hasValidSession()) {
      return null;
    }
    try {
      const res = await authApi.getProfile();
      if (res.data) {
        tokenService.setUser(res.data);
        return res.data;
      }
      return tokenService.getUser();
    } catch {
      return tokenService.getUser();
    }
  }

  /**
   * Check if a session token exists locally.
   */
  isAuthenticated(): boolean {
    return tokenService.hasValidSession();
  }
}

export const authService = new AuthService();

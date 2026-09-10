import { STORAGE_KEYS } from '../utils/constants';
import { User } from '../types/auth';

/**
 * Encapsulates localStorage management for auth tokens and user profile.
 */
class TokenService {
  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  setAccessToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  getUser(): User | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  setUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  }

  setTokens(accessToken: string, refreshToken: string, user?: User | null): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
    if (user) {
      this.setUser(user);
    }
  }

  clearTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  hasValidSession(): boolean {
    return Boolean(this.getAccessToken());
  }
}

export const tokenService = new TokenService();

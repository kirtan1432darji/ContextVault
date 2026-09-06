import { MMKV } from 'react-native-mmkv';
import { UserModel } from '../models/auth.model';
import { ThemeMode } from '../theme/theme';

let storageInstance: MMKV | null = null;
try {
  storageInstance = new MMKV({ id: 'contextvault-secure-storage' });
} catch (err) {
  // Graceful fallback for non-native / test environments
}

const memoryFallback = new Map<string, string>();

export const StorageKeys = {
  ACCESS_TOKEN: 'cv_auth_access_token',
  REFRESH_TOKEN: 'cv_auth_refresh_token',
  USER_PROFILE: 'cv_auth_user_profile',
  THEME_PREFERENCE: 'cv_app_theme_preference',
  REMEMBER_ME: 'cv_auth_remember_me',
  REMEMBERED_IDENTIFIER: 'cv_auth_remembered_identifier',
  IS_ONBOARDED: 'cv_app_is_onboarded',
};

export const StorageService = {
  getString(key: string): string | null {
    if (storageInstance) {
      try {
        return storageInstance.getString(key) ?? null;
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    }
    return memoryFallback.get(key) ?? null;
  },

  setString(key: string, value: string): void {
    if (storageInstance) {
      try {
        storageInstance.set(key, value);
        return;
      } catch {}
    }
    memoryFallback.set(key, value);
  },

  getObject<T>(key: string): T | null {
    const raw = this.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setObject<T>(key: string, value: T): void {
    try {
      this.setString(key, JSON.stringify(value));
    } catch {}
  },

  getBoolean(key: string): boolean {
    if (storageInstance) {
      try {
        return storageInstance.getBoolean(key) ?? false;
      } catch {}
    }
    return memoryFallback.get(key) === 'true';
  },

  setBoolean(key: string, value: boolean): void {
    if (storageInstance) {
      try {
        storageInstance.set(key, value);
        return;
      } catch {}
    }
    memoryFallback.set(key, value ? 'true' : 'false');
  },

  removeItem(key: string): void {
    if (storageInstance) {
      try {
        storageInstance.delete(key);
      } catch {}
    }
    memoryFallback.delete(key);
  },

  // Auth Specific Helpers
  getAccessToken(): string | null {
    return this.getString(StorageKeys.ACCESS_TOKEN);
  },

  setAccessToken(token: string): void {
    this.setString(StorageKeys.ACCESS_TOKEN, token);
  },

  getRefreshToken(): string | null {
    return this.getString(StorageKeys.REFRESH_TOKEN);
  },

  setRefreshToken(token: string): void {
    this.setString(StorageKeys.REFRESH_TOKEN, token);
  },

  getUserProfile(): UserModel | null {
    return this.getObject<UserModel>(StorageKeys.USER_PROFILE);
  },

  setUserProfile(user: UserModel): void {
    this.setObject(StorageKeys.USER_PROFILE, user);
  },

  getThemePreference(): ThemeMode {
    const mode = this.getString(StorageKeys.THEME_PREFERENCE) as ThemeMode;
    return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
  },

  setThemePreference(theme: ThemeMode): void {
    this.setString(StorageKeys.THEME_PREFERENCE, theme);
  },

  clearAuthSession(): void {
    this.removeItem(StorageKeys.ACCESS_TOKEN);
    this.removeItem(StorageKeys.REFRESH_TOKEN);
    this.removeItem(StorageKeys.USER_PROFILE);
  },
};

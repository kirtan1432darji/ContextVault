import { UserModel } from '../models/auth.model';
import { ENV } from './environment';

/**
 * Single source of truth for Developer Mode in ContextVault.
 * 
 * In development builds (__DEV__ = true):
 * - Defaults to true for rapid testing and navigation bypass
 * 
 * In production release builds (!__DEV__ = true):
 * - Defaults to false ensuring strict authentication and security
 */
export const DEVELOPER_MODE = ENV.debugFlags.enableDeveloperMode;

/**
 * Mock authenticated user profile provided when DEVELOPER_MODE = true.
 */
export const MOCK_DEVELOPER_USER: UserModel = {
  id: 'developer-user',
  name: 'Kirtan Darji',
  username: 'Kirtan Darji',
  email: 'developer@contextvault.local',
  role: 'Developer',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Mock JWT tokens used in developer mode.
 */
export const MOCK_DEV_ACCESS_TOKEN = 'mock-developer-access-token';
export const MOCK_DEV_REFRESH_TOKEN = 'mock-developer-refresh-token';


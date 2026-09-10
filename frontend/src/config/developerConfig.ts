import { UserModel } from '../models/auth.model';

/**
 * Single source of truth for Developer Mode in ContextVault.
 * 
 * When set to true:
 * - Login screen is completely bypassed on startup
 * - App navigates directly into Main App / Dashboard
 * - Provides mock authenticated session without network calls
 * - Skips auth API calls and token refreshes
 * 
 * When set to false:
 * - Standard production authentication flow is fully active
 */
export const DEVELOPER_MODE = true;

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


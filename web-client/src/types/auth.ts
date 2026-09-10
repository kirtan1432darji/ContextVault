/**
 * Public User Profile Data Transfer Object.
 */
export interface User {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  createdOn: string;
}

/**
 * Authentication tokens returned upon successful login / registration / refresh.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: string;
  username: string;
  email: string;
  user?: User | null;
}

/**
 * Login payload for /api/auth/login.
 */
export interface LoginPayload {
  emailOrUsername: string;
  password: string;
}

/**
 * Registration payload for /api/auth/register.
 */
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

/**
 * Token refresh payload for /api/auth/refresh.
 */
export interface TokenRefreshPayload {
  refreshToken: string;
}

/**
 * Token revocation payload for /api/auth/logout.
 */
export interface TokenRevokePayload {
  refreshToken: string;
}

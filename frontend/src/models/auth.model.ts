export interface UserModel {
  id: string;
  username: string;
  email: string;
  isActive?: boolean;
  createdAt: string;
}

export interface AuthResponseModel {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  userId?: string;
  username?: string;
  email?: string;
  user?: UserModel;
}

export interface LoginPayload {
  emailOrUsername: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

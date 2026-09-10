import React, { createContext, useCallback, useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';
import { LoginPayload, RegisterPayload, User } from '../types/auth';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => tokenService.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    tokenService.hasValidSession()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session and verify token on startup
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (tokenService.hasValidSession()) {
        try {
          const profile = await authService.getCurrentUser();
          if (mounted) {
            setUser(profile);
            setIsAuthenticated(Boolean(profile));
          }
        } catch {
          if (mounted) {
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } else {
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      if (mounted) {
        setIsLoading(false);
      }
    }

    initSession();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const result = await authService.login(payload);
      setUser(result.user || {
        id: result.userId,
        username: result.username,
        email: result.email,
        isActive: true,
        createdOn: new Date().toISOString(),
      });
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const result = await authService.register(payload);
      setUser(result.user || {
        id: result.userId,
        username: result.username,
        email: result.email,
        isActive: true,
        createdOn: new Date().toISOString(),
      });
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authService.getCurrentUser();
    setUser(profile);
    setIsAuthenticated(Boolean(profile));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

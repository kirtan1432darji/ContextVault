import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { UserModel, LoginPayload, RegisterPayload } from '../models/auth.model';
import { useAuthStore } from '../store/auth.store';
import { DEVELOPER_MODE, MOCK_DEVELOPER_USER } from '../config/developerConfig';

export interface AuthContextType {
  user: UserModel | null;
  currentUser: UserModel | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  isDeveloperMode: boolean;
  login: (payload: LoginPayload) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  loginAsGuest: () => void;
  exitGuestMode: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  loadSession: () => Promise<boolean>;
  clearSession: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useAuthStore();

  useEffect(() => {
    // When Developer Mode is enabled, initialize session immediately
    if (DEVELOPER_MODE) {
      store.loadSession();
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user: DEVELOPER_MODE ? (store.user || MOCK_DEVELOPER_USER) : store.user,
      currentUser: DEVELOPER_MODE ? (store.currentUser || MOCK_DEVELOPER_USER) : store.currentUser,
      isAuthenticated: DEVELOPER_MODE ? true : store.isAuthenticated,
      isGuest: DEVELOPER_MODE ? false : store.isGuest,
      isLoading: DEVELOPER_MODE ? false : (store.loading || store.isInitializing),
      loading: DEVELOPER_MODE ? false : store.loading,
      error: store.error,
      isDeveloperMode: DEVELOPER_MODE,
      login: store.login,
      register: store.register,
      loginAsGuest: store.loginAsGuest,
      exitGuestMode: store.exitGuestMode,
      logout: store.logout,
      refreshSession: store.refreshSession,
      loadSession: store.loadSession,
      clearSession: store.clearSession,
    }),
    [
      store.user,
      store.currentUser,
      store.isAuthenticated,
      store.isGuest,
      store.loading,
      store.isInitializing,
      store.error,
      store.login,
      store.register,
      store.loginAsGuest,
      store.exitGuestMode,
      store.logout,
      store.refreshSession,
      store.loadSession,
      store.clearSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    const store = useAuthStore.getState();
    return {
      user: DEVELOPER_MODE ? (store.user || MOCK_DEVELOPER_USER) : store.user,
      currentUser: DEVELOPER_MODE ? (store.currentUser || MOCK_DEVELOPER_USER) : store.currentUser,
      isAuthenticated: DEVELOPER_MODE ? true : store.isAuthenticated,
      isGuest: DEVELOPER_MODE ? false : store.isGuest,
      isLoading: DEVELOPER_MODE ? false : (store.loading || store.isInitializing),
      loading: DEVELOPER_MODE ? false : store.loading,
      error: store.error,
      isDeveloperMode: DEVELOPER_MODE,
      login: store.login,
      register: store.register,
      loginAsGuest: store.loginAsGuest,
      exitGuestMode: store.exitGuestMode,
      logout: store.logout,
      refreshSession: store.refreshSession,
      loadSession: store.loadSession,
      clearSession: store.clearSession,
    };
  }
  return context;
};


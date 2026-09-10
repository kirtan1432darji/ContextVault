jest.mock('react-native-mmkv', () => {
  const map = new Map<string, any>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key: string, val: any) => map.set(key, val)),
      getString: jest.fn((key: string) => map.get(key)),
      getNumber: jest.fn((key: string) => map.get(key)),
      getBoolean: jest.fn((key: string) => map.get(key)),
      delete: jest.fn((key: string) => map.delete(key)),
      clearAll: jest.fn(() => map.clear()),
    })),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DEVELOPER_MODE, MOCK_DEVELOPER_USER } from '../config/developerConfig';
import { useAuthStore } from '../store/auth.store';
import { AuthProvider, useAuth } from '../context/AuthContext';

describe('Developer Mode Configuration, Context and Store Suite', () => {
  it('exports DEVELOPER_MODE as true single source of truth', () => {
    expect(typeof DEVELOPER_MODE).toBe('boolean');
    expect(DEVELOPER_MODE).toBe(true);
  });

  it('provides complete mock developer user profile matching specification', () => {
    expect(MOCK_DEVELOPER_USER.id).toBe('developer-user');
    expect(MOCK_DEVELOPER_USER.name).toBe('Kirtan Darji');
    expect(MOCK_DEVELOPER_USER.email).toBe('developer@contextvault.local');
    expect(MOCK_DEVELOPER_USER.role).toBe('Developer');
    expect(MOCK_DEVELOPER_USER.isActive).toBe(true);
  });

  it('initializes auth store in authenticated developer state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.currentUser?.name).toBe('Kirtan Darji');
    expect(state.currentUser?.role).toBe('Developer');
    expect(state.isDeveloperMode).toBe(true);
  });

  it('provides mock developer session via useAuth context hook inside AuthProvider', () => {
    let authContextValue: any;
    const TestConsumer = () => {
      authContextValue = useAuth();
      return null;
    };

    act(() => {
      TestRenderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(authContextValue).toBeDefined();
    expect(authContextValue.isAuthenticated).toBe(true);
    expect(authContextValue.isDeveloperMode).toBe(true);
    expect(authContextValue.user?.name).toBe('Kirtan Darji');
    expect(authContextValue.user?.role).toBe('Developer');
    expect(authContextValue.isLoading).toBe(false);
  });

  it('loadSession immediately succeeds and retains developer session', async () => {
    let result = false;
    await act(async () => {
      result = await useAuthStore.getState().loadSession();
    });
    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.currentUser?.email).toBe('developer@contextvault.local');
  });

  it('login action bypasses remote authentication in developer mode', async () => {
    let result = false;
    await act(async () => {
      result = await useAuthStore.getState().login({
        emailOrUsername: 'any_dev_account',
        password: 'any_dev_password',
      });
    });
    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('refreshSession succeeds without remote calls in developer mode', async () => {
    let result = false;
    await act(async () => {
      result = await useAuthStore.getState().refreshSession();
    });
    expect(result).toBe(true);
  });
});

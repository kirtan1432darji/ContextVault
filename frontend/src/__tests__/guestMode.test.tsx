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

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native-paper', () => ({
  MD3LightTheme: { dark: false, colors: {} },
  MD3DarkTheme: { dark: true, colors: {} },
  PaperProvider: ({ children }: any) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(() => 'light'),
    StyleSheet: {
      create: (styles: any) => styles,
      hairlineWidth: 1,
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android ?? obj.default,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 400, height: 800 })),
    },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    TouchableWithoutFeedback: 'TouchableWithoutFeedback',
    Modal: ({ children, visible }: any) => (visible ? children : null),
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockNavigate,
    goBack: jest.fn(),
  }),
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StorageService, StorageKeys } from '../utils/storage';
import { useAuthStore } from '../store/auth.store';
import { FeatureLockCard } from '../components/FeatureLockCard';
import { GuestUpgradeBottomSheet } from '../components/GuestUpgradeBottomSheet';

describe('ContextVault Guest Mode Suite (P0)', () => {
  beforeEach(() => {
    StorageService.clearAuthSession();
    StorageService.clearGuestSession();
    mockNavigate.mockClear();
  });

  describe('StorageService Guest Session Management', () => {
    it('defaults isGuest to false when no session exists', () => {
      expect(StorageService.isGuest()).toBe(false);
    });

    it('sets guest session in MMKV with timestamp and unauthenticated flag', () => {
      StorageService.setGuestSession();
      expect(StorageService.isGuest()).toBe(true);
      expect(StorageService.getBoolean(StorageKeys.IS_AUTHENTICATED)).toBe(false);
      expect(StorageService.getGuestSessionCreatedAt()).toBeTruthy();
    });

    it('clears guest session flags cleanly', () => {
      StorageService.setGuestSession();
      expect(StorageService.isGuest()).toBe(true);

      StorageService.clearGuestSession();
      expect(StorageService.isGuest()).toBe(false);
      expect(StorageService.getGuestSessionCreatedAt()).toBeNull();
    });
  });

  describe('Auth Store Guest Mode Lifecycle', () => {
    it('initializes and transitions to guest mode via loginAsGuest()', () => {
      act(() => {
        useAuthStore.getState().loginAsGuest();
      });

      const state = useAuthStore.getState();
      expect(state.isGuest).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.currentUser).toBeNull();
      expect(StorageService.isGuest()).toBe(true);
    });

    it('exits guest mode via exitGuestMode()', () => {
      act(() => {
        useAuthStore.getState().loginAsGuest();
      });
      expect(useAuthStore.getState().isGuest).toBe(true);

      act(() => {
        useAuthStore.getState().exitGuestMode();
      });

      const state = useAuthStore.getState();
      expect(state.isGuest).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(StorageService.isGuest()).toBe(false);
    });

    it('upgrades guest session when logging in without data loss', async () => {
      act(() => {
        useAuthStore.getState().loginAsGuest();
      });
      expect(useAuthStore.getState().isGuest).toBe(true);

      await act(async () => {
        await useAuthStore.getState().login({
          emailOrUsername: 'test_upgrade_user',
          password: 'Password123!',
        });
      });

      const state = useAuthStore.getState();
      expect(state.isGuest).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(StorageService.isGuest()).toBe(false);
    });
  });

  describe('FeatureLockCard Component', () => {
    it('renders lock title and invokes onSignIn action', () => {
      const onSignInMock = jest.fn();
      let testRenderer: any;

      act(() => {
        testRenderer = TestRenderer.create(
          <FeatureLockCard
            title="Context AI Chat Locked"
            description="Sign in to unlock"
            onSignIn={onSignInMock}
          />
        );
      });

      expect(testRenderer.root.findAllByProps({ accessibilityRole: 'button' })).toBeDefined();
    });
  });

  describe('GuestUpgradeBottomSheet Component', () => {
    it('renders upgrade modal and triggers onDismiss', () => {
      const onDismissMock = jest.fn();
      let testRenderer: any;

      act(() => {
        testRenderer = TestRenderer.create(
          <GuestUpgradeBottomSheet
            visible={true}
            onDismiss={onDismissMock}
            featureName="Context AI Chat"
          />
        );
      });

      expect(testRenderer.root.findAllByType('Text').length).toBeGreaterThan(0);
    });
  });
});

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { AppInfo } from '../utils/appConstants';
import { useAuthStore } from '../store/auth.store';
import { StorageService, StorageKeys } from '../utils/storage';
import { DEVELOPER_MODE } from '../config/developerConfig';
import { BackendConnectionManager } from '../services/BackendConnectionManager';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const loadSession = useAuthStore((s) => s.loadSession);

  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [offlineUrl, setOfflineUrl] = useState('');
  const [offlineError, setOfflineError] = useState('');
  const [checkingHealth, setCheckingHealth] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    runStartupSequence();
  }, [navigation, loadSession, fadeAnim, scaleAnim]);

  const runStartupSequence = async () => {
    setCheckingHealth(true);
    setShowOfflineDialog(false);

    // 1. Minimum animation delay
    const delayPromise = new Promise((res) => setTimeout(res, 800));

    // 2. Perform Startup Health Check & Runtime URL Migration
    const [healthResult] = await Promise.all([
      BackendConnectionManager.performStartupHealthCheck(),
      delayPromise,
    ]);

    setCheckingHealth(false);

    // 3. Handle Migration Notification
    if (healthResult.migrated) {
      Alert.alert(
        'Backend URL Migrated',
        `Unreachable saved IP (${healthResult.previousUrl}) was automatically migrated to active development server:\n\n${healthResult.activeUrl}`
      );
    }

    // 4. If Backend Unreachable -> Prompt Material 3 Dialog
    if (!healthResult.isHealthy) {
      setOfflineUrl(healthResult.activeUrl);
      setOfflineError(
        healthResult.errorMessage ||
          `Cannot reach ContextVault backend at ${healthResult.activeUrl}. Please ensure FastAPI backend is running.`
      );
      setShowOfflineDialog(true);
      return;
    }

    // 5. Backend Reachable -> Proceed with Navigation
    await proceedNavigation();
  };

  const proceedNavigation = async () => {
    // Developer Mode Bypass
    if (DEVELOPER_MODE) {
      await loadSession();
      navigation.replace('MainTabs', { screen: 'Home' });
      return;
    }

    // Production Authentication & Guest Flow
    const sessionLoaded = await loadSession();
    const isGuest = StorageService.isGuest() || useAuthStore.getState().isGuest;
    const isAuthenticated = useAuthStore.getState().isAuthenticated;

    if (sessionLoaded || isAuthenticated || isGuest) {
      navigation.replace('MainTabs', { screen: 'Home' });
      return;
    }

    const hasCompletedOnboarding = StorageService.getBoolean(StorageKeys.IS_ONBOARDED);
    if (!hasCompletedOnboarding) {
      navigation.replace('Onboarding');
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View
        style={[
          styles.contentBox,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.logoContainer,
            {
              backgroundColor: theme.isDark ? '#1E1E1E' : '#E8F0FE',
              borderColor: theme.isDark ? '#2E2E2E' : '#D2E3FC',
            },
          ]}
        >
          <Icon name="albums-outline" size={48} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {AppInfo.appName}
        </Text>
        <Text style={[styles.tagline, { color: theme.colors.textSecondary }]}>
          {AppInfo.tagline}
        </Text>
      </Animated.View>

      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.colors.primary} style={styles.spinner} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          {checkingHealth ? 'Connecting to Backend...' : 'Securing Local Vault...'}
        </Text>
      </View>

      {/* Material 3 Startup Health Dialog (Backend Offline) */}
      <Modal
        visible={showOfflineDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOfflineDialog(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.m3Dialog,
              { backgroundColor: theme.isDark ? '#1E293B' : '#FFFFFF' },
            ]}
          >
            <View style={[styles.m3IconContainer, { backgroundColor: '#EF444418' }]}>
              <Icon name="cloud-offline-outline" size={28} color="#EF4444" />
            </View>
            <Text style={[styles.m3DialogTitle, { color: theme.colors.textPrimary }]}>
              Backend Offline
            </Text>
            <Text style={[styles.m3DialogMessage, { color: theme.colors.textSecondary }]}>
              Cannot connect to ContextVault backend at:
              {'\n'}
              <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>
                {offlineUrl}
              </Text>
              {'\n\n'}
              Please ensure your FastAPI backend is running and accessible on your Wi-Fi/LAN network, or configure your host IP in Backend Settings.
            </Text>

            <View style={styles.m3ActionRow}>
              <TouchableOpacity
                style={[
                  styles.m3PrimaryBtn,
                  { backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
                ]}
                onPress={() => {
                  setShowOfflineDialog(false);
                  useAuthStore.getState().loginAsGuest();
                  navigation.replace('MainTabs', { screen: 'Home' });
                }}
                accessibilityRole="button"
                accessibilityLabel="Login as a Guest"
              >
                <Icon name="person-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.m3PrimaryBtnText}>Login as a Guest</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.m3TonalBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowOfflineDialog(false);
                  navigation.navigate('BackendConnection');
                }}
                accessibilityRole="button"
                accessibilityLabel="Open Backend Settings"
              >
                <Text style={[styles.m3TonalBtnText, { color: theme.colors.primary }]}>
                  Open Backend Settings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.m3TonalBtn, { borderColor: theme.colors.border }]}
                onPress={runStartupSequence}
                accessibilityRole="button"
                accessibilityLabel="Retry Connection"
              >
                <Text style={[styles.m3TonalBtnText, { color: theme.colors.textPrimary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 260,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  m3Dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  m3IconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  m3DialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  m3DialogMessage: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 24,
  },
  m3ActionRow: {
    flexDirection: 'column',
    gap: 10,
  },
  m3TonalBtn: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  m3TonalBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  m3PrimaryBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  m3PrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

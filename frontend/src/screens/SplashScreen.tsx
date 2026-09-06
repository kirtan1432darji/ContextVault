import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { AppInfo } from '../utils/appConstants';
import { useAuthStore } from '../store/auth.store';
import { StorageService, StorageKeys } from '../utils/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const loadSession = useAuthStore((s) => s.loadSession);

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

    const verifyAuthAndNavigate = async () => {
      const delayPromise = new Promise((res) => setTimeout(res, 1200));
      const [isAuthenticated] = await Promise.all([
        loadSession(),
        delayPromise,
      ]);

      if (isAuthenticated) {
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

    verifyAuthAndNavigate();
  }, [navigation, loadSession, fadeAnim, scaleAnim]);

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
        <View style={[styles.logoContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
          <Icon name="scan-outline" size={54} color={theme.colors.primary} />
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
          Securing Local Vault...
        </Text>
      </View>
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
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
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
});

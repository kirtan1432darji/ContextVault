import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useAuthStore } from '../store/auth.store';
import { StorageService, StorageKeys } from '../utils/storage';
import { backendConnectionService } from '../services/BackendConnectionService';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const { login, loading, error, loginAsGuest, clearError } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [showHealthDialog, setShowHealthDialog] = useState(false);
  const [healthErrorData, setHealthErrorData] = useState<{ url: string; message: string } | null>(null);

  // Clear stale errors whenever LoginScreen gains or loses focus
  useFocusEffect(
    useCallback(() => {
      clearError();
      setLocalError(null);
      return () => {
        clearError();
        setLocalError(null);
      };
    }, [clearError])
  );

  const handleContinueAsGuest = () => {
    clearError();
    loginAsGuest();
    navigation.replace('MainTabs', { screen: 'Home' });
  };

  useEffect(() => {
    const savedRemember = StorageService.getBoolean(StorageKeys.REMEMBER_ME);
    setRememberMe(savedRemember);
    if (savedRemember) {
      const savedIdentifier = StorageService.getString(StorageKeys.REMEMBERED_IDENTIFIER);
      if (savedIdentifier) {
        setIdentifier(savedIdentifier);
      }
    }
  }, []);

  const handleLogin = async () => {
    setLocalError(null);
    clearError();

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setLocalError('Please enter your email or username.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    // Pre-flight health check before authentication
    setCheckingHealth(true);
    const healthResult = await backendConnectionService.pingBackend();
    setCheckingHealth(false);

    if (!healthResult.isHealthy) {
      setHealthErrorData({
        url: healthResult.baseUrl,
        message: healthResult.errorMessage || 'Cannot connect to ContextVault backend.',
      });
      setShowHealthDialog(true);
      return;
    }

    if (rememberMe) {
      StorageService.setBoolean(StorageKeys.REMEMBER_ME, true);
      StorageService.setString(StorageKeys.REMEMBERED_IDENTIFIER, cleanIdentifier);
    } else {
      StorageService.setBoolean(StorageKeys.REMEMBER_ME, false);
      StorageService.removeItem(StorageKeys.REMEMBERED_IDENTIFIER);
    }

    const success = await login({
      emailOrUsername: cleanIdentifier,
      password,
    });

    if (success) {
      navigation.replace('MainTabs', { screen: 'Home' });
    }
  };

  const activeError = localError || error;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Brand */}
          <View style={styles.header}>
            <View
              style={[
                styles.logoBadge,
                {
                  backgroundColor: theme.isDark ? '#1E1E1E' : '#E8F0FE',
                  borderColor: theme.isDark ? '#2E2E2E' : '#D2E3FC',
                },
              ]}
            >
              <Icon name="albums-outline" size={34} color={theme.colors.primary} />
            </View>
            <Text style={[styles.welcomeTitle, { color: theme.colors.textPrimary }]}>
              Welcome Back
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.colors.textSecondary }]}>
              Sign in to access your encrypted screenshot vault
            </Text>
          </View>

          {/* Error Banner */}
          {activeError ? (
            <View style={[styles.errorBox, { backgroundColor: `${theme.colors.error}15`, borderColor: theme.colors.error }]}>
              <Icon name="alert-circle" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{activeError}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Identifier Input */}
            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>
              Email or Username
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Icon name="person-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                placeholder="e.g. kirtan or user@example.com"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={identifier}
                onChangeText={(val) => {
                  setIdentifier(val);
                  if (localError) setLocalError(null);
                  if (error) clearError();
                }}
                editable={!loading}
              />
              {identifier ? (
                <TouchableOpacity onPress={() => setIdentifier('')}>
                  <Icon name="close-circle" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Password Input */}
            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>
              Password
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Icon name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                placeholder="Password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (localError) setLocalError(null);
                  if (error) clearError();
                }}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Remember Me & Forgot Password */}
            <View style={styles.optionsRow}>
              <View style={styles.rememberMeRow}>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                  thumbColor={rememberMe ? theme.colors.primary : '#F4F3F4'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                <Text style={[styles.rememberMeText, { color: theme.colors.textSecondary }]}>
                  Remember Me
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  clearError();
                  setLocalError(null);
                  navigation.navigate('ForgotPassword');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.forgotPasswordText, { color: theme.colors.primary }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.colors.primary, opacity: loading || checkingHealth ? 0.75 : 1 },
              ]}
              onPress={handleLogin}
              disabled={loading || checkingHealth}
              activeOpacity={0.85}
            >
              {loading || checkingHealth ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Sign In</Text>
                  <Icon name="log-in-outline" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.dividerText, { color: theme.colors.textMuted }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            </View>

            {/* Login as a Guest Button */}
            <TouchableOpacity
              style={[
                styles.guestButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.isDark ? '#1F293750' : '#F8FAFC',
                },
              ]}
              onPress={handleContinueAsGuest}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Login as a Guest without creating an account"
            >
              <Icon name="person-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.guestButtonText, { color: theme.colors.textPrimary }]}>
                Login as a Guest
              </Text>
            </TouchableOpacity>

            <Text style={[styles.guestDisclaimer, { color: theme.colors.textSecondary }]}>
              Use ContextVault without an account. Your data stays only on this device.
            </Text>
          </View>

          {/* Footer - Register Navigation */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => {
                clearError();
                setLocalError(null);
                navigation.navigate('Register');
              }}
            >
              <Text style={[styles.registerLink, { color: theme.colors.primary }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Material 3 Health Check Dialog */}
      <Modal
        visible={showHealthDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHealthDialog(false)}
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
              Cannot connect to ContextVault backend.
            </Text>
            <Text style={[styles.m3DialogMessage, { color: theme.colors.textSecondary }]}>
              Unable to reach backend server at:
              {'\n'}
              <Text style={{ fontWeight: '600', color: theme.colors.textPrimary }}>
                {healthErrorData?.url}
              </Text>
              {'\n\n'}
              Please ensure your FastAPI backend is running and accessible on your Wi-Fi/LAN network, or update your host IP in Backend Settings.
            </Text>

            <View style={styles.m3ActionRow}>
              <TouchableOpacity
                style={[
                  styles.m3PrimaryBtn,
                  { backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
                ]}
                onPress={() => {
                  setShowHealthDialog(false);
                  handleContinueAsGuest();
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
                  setShowHealthDialog(false);
                  navigation.navigate('BackendSettings');
                }}
                accessibilityRole="button"
                accessibilityLabel="Open Backend Settings"
              >
                <Text style={[styles.m3TonalBtnText, { color: theme.colors.primary }]}>
                  Backend Settings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.m3TonalBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowHealthDialog(false);
                  handleLogin();
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry Connection"
              >
                <Text style={[styles.m3TonalBtnText, { color: theme.colors.textPrimary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberMeText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    elevation: 1,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  guestDisclaimer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 10,
    paddingHorizontal: 8,
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
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  m3IconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  m3DialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  m3DialogMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  m3ActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  m3TonalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  m3TonalBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  m3PrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  m3PrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

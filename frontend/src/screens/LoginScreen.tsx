import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useAuthStore } from '../store/auth.store';
import { StorageService, StorageKeys } from '../utils/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const { login, loading, error, loginAsGuest } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleContinueAsGuest = () => {
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

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setLocalError('Please enter your email or username.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
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
            <View style={[styles.logoBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Icon name="scan" size={38} color={theme.colors.primary} />
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
                  backgroundColor: theme.isDark ? '#131B2E' : '#F8FAFC',
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
                  backgroundColor: theme.isDark ? '#131B2E' : '#F8FAFC',
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
                onPress={() => navigation.navigate('ForgotPassword')}
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
                { backgroundColor: theme.colors.primary, opacity: loading ? 0.75 : 1 },
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
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

            {/* Continue as Guest Button (Sprint P0) */}
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
              accessibilityLabel="Continue as Guest without creating an account"
            >
              <Icon name="person-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.guestButtonText, { color: theme.colors.textPrimary }]}>
                Continue as Guest
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
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.registerLink, { color: theme.colors.primary }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
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
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
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
    fontWeight: '600',
    marginLeft: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  guestDisclaimer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 10,
    paddingHorizontal: 8,
  },
});

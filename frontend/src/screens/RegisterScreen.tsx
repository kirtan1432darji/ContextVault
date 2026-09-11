import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useAuthStore } from '../store/auth.store';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const { register, loading, error } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateEmail = (str: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  };

  const handleRegister = async () => {
    setLocalError(null);

    if (!fullName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (username.trim().length < 3) {
      setLocalError('Username must be at least 3 characters.');
      return;
    }
    if (!validateEmail(email.trim())) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters (matches backend policy).');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    const success = await register({
      username: username.trim(),
      email: email.trim().toLowerCase(),
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Unlock non-destructive OCR intelligence for your screenshots
            </Text>
          </View>

          {/* Error Banner */}
          {activeError ? (
            <View style={[styles.errorBox, { backgroundColor: `${theme.colors.error}15`, borderColor: theme.colors.error }]}>
              <Icon name="alert-circle" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{activeError}</Text>
            </View>
          ) : null}

          {/* Input Fields */}
          <View style={styles.form}>
            {/* Full Name */}
            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Full Name</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
              <Icon name="person-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                placeholder="e.g. Kirtan Darji"
                placeholderTextColor={theme.colors.textMuted}
                value={fullName}
                onChangeText={(val) => {
                  setFullName(val);
                  if (localError) setLocalError(null);
                }}
                editable={!loading}
              />
            </View>

            {/* Username */}
            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Username</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
              <Icon name="at-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                placeholder="e.g. kirtandarji"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  if (localError) setLocalError(null);
                }}
                editable={!loading}
              />
            </View>

            {/* Email */}
            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Email Address</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
              <Icon name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                placeholder="e.g. kirtan@contextvault.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (localError) setLocalError(null);
                }}
                editable={!loading}
              />
            </View>

            {/* Password */}
            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
              <Icon name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                placeholder="Min 6 characters"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (localError) setLocalError(null);
                }}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Confirm Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
              <Icon name="shield-checkmark-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                placeholder="Re-enter password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(val) => {
                  setConfirmPassword(val);
                  if (localError) setLocalError(null);
                }}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Icon name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Password policy badge */}
            <View style={styles.policyRow}>
              <Icon name="information-circle-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.policyText, { color: theme.colors.textSecondary }]}>
                Passwords must contain at least 6 characters.
              </Text>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.colors.primary, opacity: loading ? 0.75 : 1 },
              ]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Create Account</Text>
                  <Icon name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer - Login Navigation */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.loginLink, { color: theme.colors.primary }]}>Sign In</Text>
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
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
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  policyText: {
    fontSize: 12,
    marginLeft: 6,
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
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});

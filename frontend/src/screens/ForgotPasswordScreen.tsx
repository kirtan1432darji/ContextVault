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
import { authService } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSendReset = async () => {
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const result = await authService.requestPasswordReset(cleanEmail);
    setLoading(false);

    if (result.isSuccess) {
      setIsSubmitted(true);
    } else {
      setErrorMsg(result.error || 'Failed to dispatch password reset instructions.');
    }
  };

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
          {/* Back Button */}
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          {isSubmitted ? (
            /* Success confirmation view */
            <View style={styles.successContainer}>
              <View style={[styles.iconBadge, { backgroundColor: `${theme.colors.success}15`, borderColor: `${theme.colors.success}30` }]}>
                <Icon name="mail-open-outline" size={32} color={theme.colors.success} />
              </View>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                Check Your Inbox
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                We have sent password reset instructions to:
              </Text>
              <Text style={[styles.emailHighlight, { color: theme.colors.primary }]}>
                {email}
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.colors.primary, marginTop: 32 }]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.buttonText}>Return to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Reset request form */
            <View>
              <View style={styles.header}>
                <View style={[styles.iconBadge, { backgroundColor: `${theme.colors.primary}15`, borderColor: `${theme.colors.primary}30` }]}>
                  <Icon name="key-outline" size={32} color={theme.colors.primary} />
                </View>
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                  Reset Password
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                  Enter the email address registered with your ContextVault account. We will send you a link to reset your password.
                </Text>
              </View>

              {errorMsg ? (
                <View style={[styles.errorBox, { backgroundColor: `${theme.colors.error}15`, borderColor: theme.colors.error }]}>
                  <Icon name="alert-circle" size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMsg}</Text>
                </View>
              ) : null}

              <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>
                Registered Email
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
                <Icon name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.textPrimary }]}
                  placeholder="name@example.com"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.colors.primary, opacity: loading ? 0.75 : 1, marginTop: 24 },
                ]}
                onPress={handleSendReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Send Reset Instructions</Text>
                    <Icon name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backToLoginRow}
                onPress={() => navigation.navigate('Login')}
              >
                <Icon name="chevron-back" size={16} color={theme.colors.primary} />
                <Text style={[styles.backToLoginText, { color: theme.colors.primary }]}>
                  Back to Sign In
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
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
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    elevation: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  backToLoginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emailHighlight: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
});

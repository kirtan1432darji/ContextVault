import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';

export interface GuestUpgradeBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  featureName?: string;
  onLogin?: () => void;
  onRegister?: () => void;
}

const { width } = Dimensions.get('window');

export const GuestUpgradeBottomSheet: React.FC<GuestUpgradeBottomSheetProps> = ({
  visible,
  onDismiss,
  featureName,
  onLogin,
  onRegister,
}) => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleLogin = () => {
    onDismiss();
    if (onLogin) {
      onLogin();
    } else {
      navigation.navigate('Login');
    }
  };

  const handleRegister = () => {
    onDismiss();
    if (onRegister) {
      onRegister();
    } else {
      navigation.navigate('Register');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.cardBorder,
                },
              ]}
            >
              {/* Handle Indicator */}
              <View
                style={[
                  styles.handleIndicator,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              {/* Icon & Badge */}
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: `${theme.colors.primary}18` },
                ]}
              >
                <Icon name="sparkles" size={32} color={theme.colors.primary} />
              </View>

              {/* Title & Description */}
              <Text
                style={[
                  styles.title,
                  { color: theme.colors.textPrimary },
                ]}
              >
                Login to unlock AI features.
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {featureName
                  ? `${featureName} requires a free ContextVault account.`
                  : 'Access multi-turn Context AI Chat, Folder Summaries, and Cloud AI Synchronization.'}
                {'\n'}Your local screenshots and folders will be preserved.
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonStack}>
                {/* 1. Login */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with your ContextVault account"
                >
                  <Icon
                    name="log-in-outline"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryButtonText}>Login</Text>
                </TouchableOpacity>

                {/* 2. Register */}
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.isDark ? '#1F2937' : '#F8FAFC',
                    },
                  ]}
                  onPress={handleRegister}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Create a free ContextVault account"
                >
                  <Icon
                    name="person-add-outline"
                    size={18}
                    color={theme.colors.textPrimary}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.colors.textPrimary },
                    ]}
                  >
                    Register
                  </Text>
                </TouchableOpacity>

                {/* 3. Continue Browsing */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onDismiss}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Continue browsing without signing in"
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Continue Browsing
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
    width,
  },
  handleIndicator: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  buttonStack: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

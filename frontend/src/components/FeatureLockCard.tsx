import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from './ModernCard';

export interface FeatureLockCardProps {
  title?: string;
  description?: string;
  featureName?: string;
  iconName?: string;
  onSignIn?: () => void;
  onCreateAccount?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const FeatureLockCard: React.FC<FeatureLockCardProps> = ({
  title = 'AI Feature Locked',
  description = 'Sign in to ContextVault to unlock multi-turn Context AI Chat, Folder Context Summaries, and Cloud AI Synchronization.',
  featureName,
  iconName = 'lock-closed',
  onSignIn,
  onCreateAccount,
  compact = false,
  style,
}) => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn();
    } else {
      navigation.navigate('Login');
    }
  };

  const handleCreateAccount = () => {
    if (onCreateAccount) {
      onCreateAccount();
    } else {
      navigation.navigate('Register');
    }
  };

  if (compact) {
    return (
      <ModernCard style={[styles.compactCard, { borderColor: theme.colors.cardBorder }, style]}>
        <View style={styles.compactRow}>
          <View style={[styles.compactLockBadge, { backgroundColor: `${theme.colors.accent}20` }]}>
            <Icon name={iconName} size={18} color={theme.colors.accent} />
          </View>
          <View style={styles.compactTextContainer}>
            <View style={styles.badgeRow}>
              <Text style={[styles.compactTitle, { color: theme.colors.textPrimary }]}>
                {title}
              </Text>
              <View style={[styles.pillBadge, { backgroundColor: `${theme.colors.accent}20` }]}>
                <Text style={[styles.pillText, { color: theme.colors.accent }]}>Login required</Text>
              </View>
            </View>
            <Text style={[styles.compactDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {description}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.compactBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleSignIn}
          activeOpacity={0.85}
        >
          <Icon name="log-in-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.compactBtnText}>Sign In to Unlock</Text>
        </TouchableOpacity>
      </ModernCard>
    );
  }

  return (
    <ModernCard style={[styles.card, { borderColor: theme.colors.cardBorder }, style]}>
      {/* Top Badge & Lock Icon */}
      <View style={styles.headerRow}>
        <View style={[styles.lockCircle, { backgroundColor: `${theme.colors.accent}20` }]}>
          <Icon name={iconName} size={28} color={theme.colors.accent} />
        </View>
        <View style={[styles.pillBadge, { backgroundColor: `${theme.colors.accent}20` }]}>
          <Icon name="shield-outline" size={12} color={theme.colors.accent} style={{ marginRight: 4 }} />
          <Text style={[styles.pillText, { color: theme.colors.accent }]}>Login required</Text>
        </View>
      </View>

      {/* Title & Description */}
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      {featureName ? (
        <Text style={[styles.featureHighlight, { color: theme.colors.primary }]}>
          Available with free account
        </Text>
      ) : null}
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
        {description}
      </Text>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSignIn}
          activeOpacity={0.85}
        >
          <Icon name="log-in-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
          onPress={handleCreateAccount}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.colors.textPrimary }]}>
            Create Account
          </Text>
        </TouchableOpacity>
      </View>
    </ModernCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  featureHighlight: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Compact variant
  compactCard: {
    padding: 14,
    borderRadius: 16,
    marginVertical: 8,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  compactLockBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactTextContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  compactBtn: {
    flexDirection: 'row',
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

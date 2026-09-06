import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();

  const handleGrantPermissions = () => {
    navigation.replace('MainTabs', { screen: 'Home' });
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: `${theme.colors.primary}20` }]}>
          <Icon name="shield-checkmark-outline" size={40} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Non-Destructive Intelligence
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          ContextVault organizes your screenshots without moving, editing, or uploading full-size images.
        </Text>
      </View>

      <ModernCard style={styles.guaranteeCard}>
        <View style={styles.featureRow}>
          <Icon name="lock-closed-outline" size={24} color={theme.colors.success} />
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: theme.colors.textPrimary }]}>
              100% On-Device Privacy
            </Text>
            <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
              Full photos never leave your device. Only text keywords and metadata are queried.
            </Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <Icon name="flash-outline" size={24} color={theme.colors.primary} />
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: theme.colors.textPrimary }]}>
              Instant Search & Smart Folders
            </Text>
            <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
              Automatically filed into Receipts, Banking, Code, Social, Work, and Shopping.
            </Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <Icon name="eye-outline" size={24} color={theme.colors.secondary} />
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: theme.colors.textPrimary }]}>
              Originals Untouched
            </Text>
            <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
              We never mutate or delete your photo library.
            </Text>
          </View>
        </View>
      </ModernCard>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleGrantPermissions}
      >
        <Text style={styles.buttonText}>Enable Media Access & Start</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  guaranteeCard: {
    marginVertical: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureText: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

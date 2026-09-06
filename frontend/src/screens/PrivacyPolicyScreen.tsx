import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export const PrivacyPolicyScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: theme.colors.textPrimary }]}>
          Privacy Policy
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ModernCard style={styles.card}>
          <Text style={[styles.heading, { color: theme.colors.primary }]}>
            Non-Destructive Guarantee
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.textPrimary }]}>
            ContextVault guarantees that your original image files are never moved, renamed,
            modified, duplicated, or deleted from your device storage or camera roll.
          </Text>
        </ModernCard>

        <ModernCard style={styles.card}>
          <Text style={[styles.heading, { color: theme.colors.primary }]}>
            Zero Photo Binary Uploads
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.textPrimary }]}>
            All Optical Character Recognition (OCR) is performed locally on your physical
            device using Google ML Kit. Full image binaries and photos are NEVER uploaded
            to our backend servers. Only anonymized extracted text tokens, classification
            categories, and dimensions are synced.
          </Text>
        </ModernCard>

        <ModernCard style={styles.card}>
          <Text style={[styles.heading, { color: theme.colors.primary }]}>
            Storage & Audit Trail
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.textPrimary }]}>
            Metadata and classification histories are stored in your encrypted local SQLite
            database and can be purged at any time from Settings.
          </Text>
        </ModernCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

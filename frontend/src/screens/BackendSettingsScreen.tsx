import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import { EnvironmentManager, AppEnvironment } from '../config/EnvironmentManager';
import {
  backendConnectionService,
  ConnectionStatusResult,
} from '../services/BackendConnectionService';
import { apiClient } from '../api/apiClient';

export const BackendSettingsScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isDevAvailable = EnvironmentManager.isDeveloperModeAvailable();
  const currentEnv = EnvironmentManager.getEnvironment();
  const defaultUrl = EnvironmentManager.getDefaultUrl();

  const [urlInput, setUrlInput] = useState(EnvironmentManager.getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [pingResult, setPingResult] = useState<ConnectionStatusResult | null>(null);

  if (!isDevAvailable) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.restrictedContainer}>
          <Icon name="lock-closed-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.restrictedTitle, { color: theme.colors.textPrimary }]}>
            Developer Mode Disabled
          </Text>
          <Text style={[styles.restrictedSubtitle, { color: theme.colors.textSecondary }]}>
            Backend configuration is disabled in production release builds for security.
          </Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleTestConnection = async () => {
    const target = urlInput.trim();
    if (!target) {
      Alert.alert('Validation Error', 'Please enter a valid backend URL.');
      return;
    }
    if (!EnvironmentManager.isValidUrl(target)) {
      Alert.alert('Invalid URL', 'Backend URL must begin with http:// or https://');
      return;
    }

    setTesting(true);
    setPingResult(null);
    try {
      const result = await backendConnectionService.pingBackend(target);
      setPingResult(result);
    } catch (err: any) {
      setPingResult({
        status: 'Offline',
        isHealthy: false,
        latencyMs: 0,
        errorMessage: err?.message || 'Connection test failed unexpectedly.',
        baseUrl: target,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveUrl = () => {
    const target = urlInput.trim();
    if (!target) {
      Alert.alert('Validation Error', 'Please enter a valid backend URL.');
      return;
    }
    if (!EnvironmentManager.isValidUrl(target)) {
      Alert.alert('Invalid URL', 'Backend URL must begin with http:// or https://');
      return;
    }

    try {
      apiClient.setBaseUrl(target);
      Alert.alert('Backend URL Saved', `Active backend URL set to:\n${target}\n\nSaved to MMKV storage.`);
    } catch (e: any) {
      Alert.alert('Error Saving URL', e?.message || 'Failed to save URL.');
    }
  };

  const handleRestoreDefault = () => {
    EnvironmentManager.resetToDefaultUrl();
    const restored = EnvironmentManager.getDefaultUrl();
    setUrlInput(restored);
    apiClient.setBaseUrl(restored);
    setPingResult(null);
    Alert.alert('Default Restored', `Backend URL reverted to build default:\n${restored}`);
  };

  const getEnvBadgeColor = (env: AppEnvironment) => {
    switch (env) {
      case 'development':
        return '#3B82F6';
      case 'local_release':
        return '#10B981';
      case 'production':
        return '#8B5CF6';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Connected':
        return '#10B981';
      case 'Timeout':
        return '#F59E0B';
      case 'Unauthorized':
        return '#EAB308';
      case 'Offline':
      default:
        return '#EF4444';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top App Bar */}
      <View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.appBarTitle, { color: theme.colors.textPrimary }]}>
          Backend Settings
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Environment Badge Card */}
        <ModernCard style={styles.card}>
          <View style={styles.envHeaderRow}>
            <View>
              <Text style={[styles.cardHeader, { color: theme.colors.textPrimary, marginBottom: 2 }]}>
                Runtime Environment
              </Text>
              <Text style={[styles.helpText, { color: theme.colors.textSecondary, marginBottom: 0 }]}>
                Build Mode: {__DEV__ ? 'Debug / Metro' : 'Release Binary'}
              </Text>
            </View>
            <View
              style={[
                styles.envBadge,
                { backgroundColor: `${getEnvBadgeColor(currentEnv)}1A`, borderColor: getEnvBadgeColor(currentEnv) },
              ]}
            >
              <Text style={[styles.envBadgeText, { color: getEnvBadgeColor(currentEnv) }]}>
                {currentEnv.toUpperCase()}
              </Text>
            </View>
          </View>
        </ModernCard>

        {/* Backend Configuration Form */}
        <ModernCard style={styles.card}>
          <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
            FastAPI Server Endpoint
          </Text>
          <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
            Enter the host IP and port of your ContextVault backend. Changes are saved directly in MMKV.
          </Text>

          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="http://10.122.196.152:8000"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[
              styles.input,
              {
                backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC',
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary,
              },
            ]}
          />

          {/* Action Buttons Row */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              onPress={handleTestConnection}
              disabled={testing}
              style={[styles.actionBtn, styles.testBtn, { borderColor: theme.colors.primary }]}
            >
              {testing ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Icon name="pulse-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.btnText, { color: theme.colors.primary }]}>Test Connection</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSaveUrl}
              style={[styles.actionBtn, styles.saveBtn, { backgroundColor: theme.colors.primary }]}
            >
              <Icon name="save-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Save URL</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleRestoreDefault}
            style={[styles.restoreBtn, { borderColor: theme.colors.border }]}
          >
            <Icon name="refresh-outline" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.restoreBtnText, { color: theme.colors.textSecondary }]}>
              Restore Default ({defaultUrl})
            </Text>
          </TouchableOpacity>
        </ModernCard>

        {/* Live Diagnostics Card */}
        {pingResult && (
          <ModernCard
            style={[
              styles.card,
              {
                borderColor: getStatusColor(pingResult.status),
                borderWidth: 1.5,
              },
            ]}
          >
            <View style={styles.diagHeaderRow}>
              <Text style={[styles.cardHeader, { color: theme.colors.textPrimary, marginBottom: 0 }]}>
                Connection Diagnostics
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: `${getStatusColor(pingResult.status)}1A` },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(pingResult.status) },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: getStatusColor(pingResult.status) },
                  ]}
                >
                  {pingResult.status}
                </Text>
              </View>
            </View>

            <View style={styles.diagDivider} />

            <View style={styles.diagItem}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>
                Round-trip Latency
              </Text>
              <Text style={[styles.diagValue, { color: theme.colors.textPrimary }]}>
                {pingResult.latencyMs} ms
              </Text>
            </View>

            <View style={styles.diagItem}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>
                Backend API Version
              </Text>
              <Text style={[styles.diagValue, { color: theme.colors.textPrimary }]}>
                {pingResult.version || 'unknown'}
              </Text>
            </View>

            {pingResult.database && (
              <View style={styles.diagItem}>
                <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>
                  Database Status
                </Text>
                <Text
                  style={[
                    styles.diagValue,
                    { color: pingResult.database === 'connected' ? '#10B981' : theme.colors.textPrimary },
                  ]}
                >
                  {pingResult.database}
                </Text>
              </View>
            )}

            <View style={styles.diagItem}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>
                Target URL
              </Text>
              <Text style={[styles.diagValue, { color: theme.colors.textSecondary, fontSize: 12 }]}>
                {pingResult.baseUrl}
              </Text>
            </View>

            {pingResult.errorMessage && (
              <View style={[styles.errorBox, { backgroundColor: '#EF444415' }]}>
                <Icon name="alert-circle-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorBoxText}>{pingResult.errorMessage}</Text>
              </View>
            )}
          </ModernCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  envHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  envBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  envBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtn: {
    borderWidth: 1.5,
  },
  saveBtn: {},
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  restoreBtn: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  diagHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  diagDivider: {
    height: 1,
    backgroundColor: '#E2E8F030',
    marginVertical: 12,
  },
  diagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  diagLabel: {
    fontSize: 13,
  },
  diagValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  errorBoxText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  restrictedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});

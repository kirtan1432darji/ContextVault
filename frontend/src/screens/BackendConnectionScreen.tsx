import React, { useState, useEffect } from 'react';
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
import { BackendConnectionManager, PingResult } from '../services/BackendConnectionManager';
import { apiClient } from '../api/apiClient';

export const BackendConnectionScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [currentUrl, setCurrentUrl] = useState(BackendConnectionManager.getBaseUrl());
  const [urlInput, setUrlInput] = useState(BackendConnectionManager.getBaseUrl());
  const [testing, setTesting] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const defaultUrl = BackendConnectionManager.getDefaultUrl();
  const hasCustom = BackendConnectionManager.hasCustomUrl();

  // Test current connection on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await BackendConnectionManager.ping();
        if (isMounted) {
          setPingResult(res);
        }
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleTestConnection = async () => {
    const target = urlInput.trim();
    if (!target) {
      Alert.alert('Validation Error', 'Please enter a valid backend URL.');
      return;
    }
    if (!BackendConnectionManager.isValidUrl(target)) {
      Alert.alert('Invalid URL', 'Backend URL must begin with http:// or https://');
      return;
    }

    setTesting(true);
    setPingResult(null);
    try {
      const result = await BackendConnectionManager.ping(target);
      setPingResult(result);
    } catch (err: any) {
      setPingResult({
        status: 'Offline',
        isHealthy: false,
        latencyMs: 0,
        version: 'unknown',
        database: 'disconnected',
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
    if (!BackendConnectionManager.isValidUrl(target)) {
      Alert.alert('Invalid URL', 'Backend URL must begin with http:// or https://');
      return;
    }

    try {
      BackendConnectionManager.setBaseUrl(target);
      const cleanSaved = BackendConnectionManager.getBaseUrl();
      setCurrentUrl(cleanSaved);
      setUrlInput(cleanSaved);
      apiClient.setBaseUrl(cleanSaved);

      Alert.alert(
        'Backend URL Saved',
        `Successfully updated active backend URL to:\n${cleanSaved}\n\nThis URL is now saved in MMKV and will persist across app restarts.`,
        [
          {
            text: 'Test Now',
            onPress: () => handleTestConnection(),
          },
          { text: 'OK' },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error Saving URL', err?.message || 'Failed to save URL');
    }
  };

  const handleResetDefault = () => {
    Alert.alert(
      'Reset Backend URL',
      `Revert backend connection to default development URL?\n\n${defaultUrl}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            BackendConnectionManager.resetBaseUrl();
            const restored = BackendConnectionManager.getDefaultUrl();
            setCurrentUrl(restored);
            setUrlInput(restored);
            apiClient.setBaseUrl(restored);
            setPingResult(null);
            Alert.alert('Reset Complete', `Restored default backend URL:\n${restored}`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextGroup}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Backend Connection
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Settings → Developer Options → Backend Connection
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Active Status Card */}
        <ModernCard style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View
                style={[
                  styles.indicatorDot,
                  {
                    backgroundColor: pingResult?.isHealthy ? '#10B981' : '#EF4444',
                  },
                ]}
              />
              <Text style={[styles.activeStatusText, { color: theme.colors.textPrimary }]}>
                {pingResult?.isHealthy ? 'Connected & Healthy' : 'Offline / Unreachable'}
              </Text>
            </View>
            <View
              style={[
                styles.envBadge,
                {
                  backgroundColor: hasCustom ? '#8B5CF618' : '#3B82F618',
                },
              ]}
            >
              <Text
                style={[
                  styles.envBadgeText,
                  {
                    color: hasCustom ? '#8B5CF6' : '#3B82F6',
                  },
                ]}
              >
                {hasCustom ? 'MMKV Custom' : 'Default Env'}
              </Text>
            </View>
          </View>

          <Text style={[styles.currentUrlLabel, { color: theme.colors.textSecondary }]}>
            Current Active URL:
          </Text>
          <Text style={[styles.currentUrlValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {currentUrl}
          </Text>
        </ModernCard>

        {/* Configuration & Actions Card */}
        <ModernCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Configure Backend Host
          </Text>
          <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
            Enter the LAN IP and port of your FastAPI backend host (e.g. http://192.168.1.100:8000).
          </Text>

          <View style={styles.inputContainer}>
            <Icon
              name="globe-outline"
              size={20}
              color={theme.colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="http://10.122.196.96:8000"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.textInput,
                {
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                  borderColor: theme.colors.border,
                },
              ]}
            />
            {urlInput.length > 0 && (
              <TouchableOpacity onPress={() => setUrlInput('')} style={styles.clearBtn}>
                <Icon name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsCol}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleSaveUrl}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save Backend URL"
            >
              <Icon name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnTextWhite}>Save URL</Text>
            </TouchableOpacity>

            <View style={styles.secondaryBtnRow}>
              <TouchableOpacity
                style={[
                  styles.tonalBtn,
                  { borderColor: theme.colors.border, backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' },
                ]}
                onPress={handleTestConnection}
                disabled={testing}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Ping Backend"
              >
                {testing ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Icon name="pulse-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.tonalBtnText, { color: theme.colors.primary }]}>
                      Ping Backend
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tonalBtn,
                  { borderColor: theme.colors.border, backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' },
                ]}
                onPress={handleResetDefault}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Reset to Default"
              >
                <Icon name="refresh-outline" size={18} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.tonalBtnText, { color: theme.colors.textSecondary }]}>
                  Reset to Default
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ModernCard>

        {/* Live Diagnostics Card */}
        {pingResult && (
          <ModernCard
            style={[
              styles.card,
              {
                borderColor: pingResult.isHealthy ? '#10B981' : '#EF4444',
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.diagHeader}>
              <Icon
                name={pingResult.isHealthy ? 'checkmark-circle' : 'alert-circle'}
                size={22}
                color={pingResult.isHealthy ? '#10B981' : '#EF4444'}
              />
              <Text style={[styles.diagTitle, { color: theme.colors.textPrimary }]}>
                {pingResult.isHealthy ? 'Connection Successful' : 'Connection Failed'}
              </Text>
            </View>

            <View style={styles.diagItem}>
              <Text style={[styles.diagKey, { color: theme.colors.textSecondary }]}>Status</Text>
              <Text
                style={[
                  styles.diagVal,
                  { color: pingResult.isHealthy ? '#10B981' : '#EF4444', fontWeight: '700' },
                ]}
              >
                {pingResult.status}
              </Text>
            </View>

            <View style={styles.diagItem}>
              <Text style={[styles.diagKey, { color: theme.colors.textSecondary }]}>Round-Trip Latency</Text>
              <Text style={[styles.diagVal, { color: theme.colors.textPrimary }]}>
                {pingResult.latencyMs} ms
              </Text>
            </View>

            <View style={styles.diagItem}>
              <Text style={[styles.diagKey, { color: theme.colors.textSecondary }]}>Backend Version</Text>
              <Text style={[styles.diagVal, { color: theme.colors.textPrimary }]}>
                {pingResult.version}
              </Text>
            </View>

            <View style={styles.diagItem}>
              <Text style={[styles.diagKey, { color: theme.colors.textSecondary }]}>Database Status</Text>
              <Text
                style={[
                  styles.diagVal,
                  {
                    color: pingResult.database === 'connected' ? '#10B981' : '#F59E0B',
                  },
                ]}
              >
                {pingResult.database}
              </Text>
            </View>

            <View style={styles.diagItem}>
              <Text style={[styles.diagKey, { color: theme.colors.textSecondary }]}>Target Host</Text>
              <Text style={[styles.diagVal, { color: theme.colors.textSecondary, fontSize: 12 }]} numberOfLines={1}>
                {pingResult.baseUrl}
              </Text>
            </View>

            {pingResult.errorMessage && (
              <View style={[styles.errorBox, { backgroundColor: '#EF444412' }]}>
                <Text style={styles.errorBoxText}>{pingResult.errorMessage}</Text>
              </View>
            )}
          </ModernCard>
        )}

        {/* Developer Network Tips */}
        <ModernCard style={styles.card}>
          <View style={styles.tipHeader}>
            <Icon name="bulb-outline" size={20} color="#F59E0B" />
            <Text style={[styles.tipTitle, { color: theme.colors.textPrimary }]}>
              Network Configuration Guide
            </Text>
          </View>
          <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
            • Ensure your Android device and development PC are connected to the same Wi-Fi network.{'\n'}
            • Run <Text style={{ fontWeight: '700' }}>ipconfig</Text> (Windows) or <Text style={{ fontWeight: '700' }}>ifconfig</Text> (macOS/Linux) to find your LAN IPv4 address.{'\n'}
            • Do NOT use <Text style={{ fontStyle: 'italic' }}>localhost</Text> or <Text style={{ fontStyle: 'italic' }}>127.0.0.1</Text> on physical devices; physical phones treat localhost as the phone itself.{'\n'}
            • FastAPI default port is <Text style={{ fontWeight: '700' }}>8000</Text>.
          </Text>
        </ModernCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  activeStatusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  envBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  envBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  currentUrlLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  currentUrlValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 14,
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  actionButtonsCol: {
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tonalBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tonalBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  diagTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  diagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F015',
  },
  diagKey: {
    fontSize: 13,
  },
  diagVal: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  errorBoxText: {
    color: '#EF4444',
    fontSize: 12,
    lineHeight: 16,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
  },
});

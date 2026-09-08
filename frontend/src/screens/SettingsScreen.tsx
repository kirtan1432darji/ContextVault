import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useSettingsStore } from '../store/settings.store';
import { useAuthStore } from '../store/auth.store';
import { ModernCard } from '../components/ModernCard';
import { AppInfo } from '../utils/appConstants';
import { apiClient } from '../api/apiClient';
import { StorageService } from '../utils/storage';

export const SettingsScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const themeMode = useSettingsStore((s) => s.themeMode);
  const backendUrl = useSettingsStore((s) => s.backendUrl);
  const autoScan = useSettingsStore((s) => s.autoScanOnLaunch);
  const autoDetect = useSettingsStore((s) => s.autoDetectScreenshots);
  const notifications = useSettingsStore((s) => s.screenshotNotifications);

  const [urlInput, setUrlInput] = useState(backendUrl);
  const [testingHealth, setTestingHealth] = useState(false);

  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const handleSaveUrl = () => {
    useSettingsStore.getState().setBackendUrl(urlInput);
    Alert.alert('Settings Saved', `Backend URL updated to ${urlInput}`);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of ContextVault?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleTestHealth = async () => {
    setTestingHealth(true);
    if (urlInput) {
      useSettingsStore.getState().setBackendUrl(urlInput);
    }
    const ok = await apiClient.checkHealth();
    setTestingHealth(false);
    if (ok) {
      Alert.alert('Connection Success', 'Connected to ContextVault backend API successfully.');
    } else {
      Alert.alert('Connection Failed', 'Could not connect. Verify server IP and network.');
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Settings
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Preferences, API connections & diagnostics
        </Text>
      </View>

      {/* Account Section */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Account & Session
        </Text>
        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Icon name="person-circle-outline" size={32} color={theme.colors.primary} />
            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary }}>
                {currentUser?.username || 'Active User'}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                {currentUser?.email || 'Logged in via JWT'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: theme.colors.error }]}
            onPress={handleLogout}
          >
            <Icon name="log-out-outline" size={16} color={theme.colors.error} style={{ marginRight: 4 }} />
            <Text style={{ color: theme.colors.error, fontSize: 13, fontWeight: '700' }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ModernCard>

      {/* Theme Section */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Appearance
        </Text>
        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Icon name="moon-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>
              Dark Mode
            </Text>
          </View>
          <Switch
            value={themeMode === 'dark'}
            onValueChange={(val) =>
              useSettingsStore.getState().setThemeMode(val ? 'dark' : 'light')
            }
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
      </ModernCard>

      {/* Detection & Automation */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Automation & Background Detection
        </Text>

        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Icon name="sync-outline" size={20} color={theme.colors.secondary} />
            <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>
              Auto-Scan on Launch
            </Text>
          </View>
          <Switch
            value={autoScan}
            onValueChange={(val) =>
              useSettingsStore.getState().setAutoScanOnLaunch(val)
            }
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Icon name="radio-outline" size={20} color={theme.colors.accent} />
            <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>
              MediaStore Observer
            </Text>
          </View>
          <Switch
            value={autoDetect}
            onValueChange={(val) =>
              useSettingsStore.getState().setAutoDetectScreenshots(val)
            }
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Icon name="notifications-outline" size={20} color={theme.colors.warning} />
            <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>
              Organized Notifications
            </Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={(val) =>
              useSettingsStore.getState().setScreenshotNotifications(val)
            }
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
      </ModernCard>

      {/* Backend API Configuration */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Backend API Connection
        </Text>
        <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
          Set local server address (e.g., http://localhost:8000/api or http://10.0.2.2:8000/api)
        </Text>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="http://localhost:8000/api"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.urlInput,
            {
              backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC',
              borderColor: theme.colors.border,
              color: theme.colors.textPrimary,
            },
          ]}
        />
        <View style={styles.apiBtnRow}>
          <TouchableOpacity
            onPress={handleSaveUrl}
            style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.btnText}>Save URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleTestHealth}
            disabled={testingHealth}
            style={[styles.testBtn, { borderColor: theme.colors.primary }]}
          >
            <Text style={[styles.testBtnText, { color: theme.colors.primary }]}>
              {testingHealth ? 'Testing...' : 'Test Connection'}
            </Text>
          </TouchableOpacity>
        </View>
      </ModernCard>

      {/* Privacy & Legal */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Privacy & About
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('PrivacyPolicy')}
          style={styles.legalRow}
        >
          <View style={styles.rowLabelGroup}>
            <Icon name="shield-checkmark-outline" size={20} color={theme.colors.success} />
            <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>
              Privacy Policy & Guarantee
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.versionRow}>
          <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]}>
            {AppInfo.appName} Version
          </Text>
          <Text style={[styles.versionValue, { color: theme.colors.textPrimary }]}>
            {AppInfo.appVersion} (Build {AppInfo.buildNumber})
          </Text>
        </View>
      </ModernCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  urlInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 10,
  },
  apiBtnRow: {
    flexDirection: 'row',
  },
  saveBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  testBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  testBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F030',
  },
  versionLabel: {
    fontSize: 13,
  },
  versionValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});

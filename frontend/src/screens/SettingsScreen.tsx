import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
  Share,
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
import { healthApi, PingResult } from '../api/healthApi';
import { StorageService } from '../utils/storage';
import { loggerService } from '../services/loggerService';
import { storageManagerService } from '../services/storageManagerService';
import { demoModeService } from '../services/demoModeService';
import { backupService } from '../services/backupService';

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
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const isGuest = useAuthStore((s) => s.isGuest);
  const exitGuestMode = useAuthStore((s) => s.exitGuestMode);

  const handleSaveUrl = () => {
    useSettingsStore.getState().setBackendUrl(urlInput);
    Alert.alert('Settings Saved', `Backend URL updated to ${urlInput}`);
  };

  const handleExitGuestMode = () => {
    Alert.alert(
      'Exit Guest Mode',
      'Are you sure you want to return to the login screen? Your local screenshots and folders will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit Guest Mode',
          style: 'destructive',
          onPress: () => {
            exitGuestMode();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of ContextVault?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  const handleTestHealth = async () => {
    setTestingHealth(true);
    const target = (urlInput || backendUrl).trim();
    if (target) {
      useSettingsStore.getState().setBackendUrl(target);
    }
    const res = await healthApi.pingServer(target);
    setPingResult(res);
    setTestingHealth(false);
    if (res.isHealthy) {
      Alert.alert(
        'Backend Online',
        `Connected to ContextVault backend API successfully in ${res.latencyMs}ms.\n\nDatabase: ${res.database}\nVersion: ${res.version}\nStatus: ${res.status}`
      );
    } else {
      Alert.alert(
        'Connection Failed',
        res.errorMessage || `Could not connect to ContextVault Docker backend at ${target}. Please verify server IP and Docker container.`
      );
    }
  };

  const handleExportLogs = async () => {
    try {
      const text = loggerService.exportLogsAsText();
      await Share.share({
        title: 'ContextVault Debug Logs',
        message: text,
      });
    } catch (err) {
      console.warn('Log export error:', err);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Purge App Cache',
      'This will clear OCR text caches, search history, and optimize the local database. Screenshots and folders are completely preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageManagerService.clearAllCaches();
              Alert.alert('Success', 'Application caches purged and SQLite database optimized.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear cache.');
            }
          },
        },
      ]
    );
  };

  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    demoModeService.isDemoModeActive().then(setIsDemoMode);
  }, []);

  const handleToggleDemoMode = async (val: boolean) => {
    try {
      if (val) {
        const count = await demoModeService.loadDemoData();
        setIsDemoMode(true);
        Alert.alert('Demo Mode Enabled', `Loaded ${count} offline sample screenshots, smart folders, and context chats.`);
      } else {
        await demoModeService.clearDemoData();
        setIsDemoMode(false);
        Alert.alert('Demo Mode Disabled', 'Sample screenshots and demo records removed.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update demo mode.');
    }
  };

  const handleExportBackup = async () => {
    try {
      await backupService.shareBackup();
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not export backup.');
    }
  };

  const handleImportBackup = () => {
    if ((Alert as any).prompt) {
      (Alert as any).prompt(
        'Import Backup',
        'Paste ContextVault backup JSON content:',
        async (text: string) => {
          if (!text) return;
          try {
            const res = await backupService.importBackup(text);
            Alert.alert('Restored', `Restored ${res.counts.screenshots} screenshots, ${res.counts.categories} folders.`);
          } catch (e: any) {
            Alert.alert('Import Failed', e?.message || 'Invalid backup JSON.');
          }
        }
      );
    } else {
      Alert.alert(
        'Import Backup',
        'To restore a backup, place ContextVault_Backup.json in device storage or trigger restoration via QA Debug Panel.'
      );
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

      {/* Account Section: Guest Mode vs Authenticated User */}
      {isGuest ? (
        <ModernCard style={styles.card}>
          <View style={styles.appearanceHeaderRow}>
            <View style={styles.rowLabelGroup}>
              <Icon name="person-outline" size={22} color={theme.colors.accent} />
              <Text style={[styles.cardHeader, { color: theme.colors.textPrimary, marginBottom: 0, marginLeft: 8 }]}>
                Guest Account
              </Text>
            </View>
            <View style={[styles.activeThemeBadge, { backgroundColor: `${theme.colors.accent}18` }]}>
              <Text style={[styles.activeThemeBadgeText, { color: theme.colors.accent }]}>
                Local Mode
              </Text>
            </View>
          </View>

          <Text style={[styles.themeSubtitle, { color: theme.colors.textSecondary, marginBottom: 16 }]}>
            You are browsing as a guest. Screenshots and smart folders remain private on this device. Sign in to unlock AI chat and cloud backups.
          </Text>

          {/* Action Buttons: Sign In, Create Account, Exit Guest Mode */}
          <View style={styles.guestBtnGroup}>
            <TouchableOpacity
              style={[styles.guestPrimaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Sign in with your account"
            >
              <Icon name="log-in-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.guestPrimaryBtnText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.guestSecondaryBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.isDark ? '#1F2937' : '#F8FAFC',
                },
              ]}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Create a new ContextVault account"
            >
              <Icon name="person-add-outline" size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.guestSecondaryBtnText, { color: theme.colors.textPrimary }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.exitGuestBtn, { borderColor: theme.colors.border }]}
            onPress={handleExitGuestMode}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Exit Guest Mode and return to login"
          >
            <Icon name="arrow-back-outline" size={15} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.exitGuestBtnText, { color: theme.colors.textSecondary }]}>
              Exit Guest Mode
            </Text>
          </TouchableOpacity>
        </ModernCard>
      ) : (
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
      )}

      {/* Theme Section */}
      <ModernCard style={styles.card}>
        <View style={styles.appearanceHeaderRow}>
          <View style={styles.rowLabelGroup}>
            <Icon name="color-palette-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.cardHeader, { color: theme.colors.textPrimary, marginBottom: 0, marginLeft: 8 }]}>
              Appearance & Theme
            </Text>
          </View>
          <View style={[styles.activeThemeBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
            <Text style={[styles.activeThemeBadgeText, { color: theme.colors.primary }]}>
              {themeMode === 'system'
                ? `System (${theme.isDark ? 'Dark' : 'Light'})`
                : themeMode === 'dark'
                ? 'Dark'
                : 'Light'}
            </Text>
          </View>
        </View>

        <Text style={[styles.themeSubtitle, { color: theme.colors.textSecondary }]}>
          Choose how ContextVault appears on your device.
        </Text>

        <View style={styles.themeSelectorGroup}>
          {(
            [
              { key: 'system', label: 'System', icon: 'phone-portrait-outline', desc: 'Match device' },
              { key: 'light', label: 'Light', icon: 'sunny-outline', desc: 'Always light' },
              { key: 'dark', label: 'Dark', icon: 'moon-outline', desc: 'Always dark' },
            ] as const
          ).map((item) => {
            const isSelected = themeMode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                onPress={() => useSettingsStore.getState().setThemeMode(item.key)}
                style={[
                  styles.themeOptionButton,
                  {
                    backgroundColor: isSelected
                      ? `${theme.colors.primary}18`
                      : theme.isDark
                      ? '#131B2E'
                      : '#F8FAFC',
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={[
                    styles.themeOptionLabel,
                    {
                      color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.themeOptionDesc,
                    { color: isSelected ? theme.colors.primary : theme.colors.textMuted },
                  ]}
                >
                  {item.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
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

        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('NotificationCenter')}
          activeOpacity={0.7}
        >
          <View style={styles.rowLabelGroup}>
            <Icon name="file-tray-full-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>
              Notification Center Inbox
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Icon name="sparkles-outline" size={20} color="#10B981" />
            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary }}>
                Hackathon Demo Mode
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                Preload 12 sample screenshots &amp; offline chats
              </Text>
            </View>
          </View>
          <Switch
            value={isDemoMode}
            onValueChange={handleToggleDemoMode}
            trackColor={{ false: theme.colors.border, true: '#10B981' }}
          />
        </View>
      </ModernCard>

      {/* Backend API Configuration */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Backend API Connection
        </Text>
        <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
          FastAPI backend running inside Docker (e.g., http://10.193.167.152:8000/api)
        </Text>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="http://10.193.167.152:8000/api"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
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
              {testingHealth ? 'Pinging...' : 'Ping Backend'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real-time Diagnostics Display */}
        {pingResult && (
          <View
            style={[
              styles.diagnosticContainer,
              {
                backgroundColor: theme.isDark ? '#0F172A' : '#F1F5F9',
                borderColor: pingResult.isHealthy ? '#10B981' : '#EF4444',
              },
            ]}
          >
            <View style={styles.diagRow}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>Backend Status</Text>
              <View style={styles.diagBadgeRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: pingResult.isHealthy ? '#10B981' : '#EF4444' },
                  ]}
                />
                <Text
                  style={[
                    styles.diagValue,
                    { color: pingResult.isHealthy ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {pingResult.isHealthy ? 'Connected (Healthy)' : 'Disconnected'}
                </Text>
              </View>
            </View>

            <View style={styles.diagRow}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>Response Time</Text>
              <Text style={[styles.diagValue, { color: theme.colors.textPrimary }]}>
                {pingResult.latencyMs} ms
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>Database Status</Text>
              <Text
                style={[
                  styles.diagValue,
                  { color: pingResult.database === 'connected' ? '#10B981' : '#F59E0B' },
                ]}
              >
                {pingResult.database}
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>API Version</Text>
              <Text style={[styles.diagValue, { color: theme.colors.textPrimary }]}>
                {pingResult.version}
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text style={[styles.diagLabel, { color: theme.colors.textSecondary }]}>Base URL</Text>
              <Text
                style={[styles.diagValue, { color: theme.colors.textSecondary, fontSize: 11 }]}
                numberOfLines={1}
              >
                {pingResult.baseUrl}
              </Text>
            </View>
          </View>
        )}
      </ModernCard>

      {/* Storage & Data Management (Sprint RN-10) */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Storage & Intelligence
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('FolderAnalytics')}
          style={styles.legalRow}
          accessibilityRole="button"
          accessibilityLabel="Open Folder Analytics Dashboard"
        >
          <View style={styles.rowLabelGroup}>
            <Icon name="stats-chart-outline" size={20} color={theme.colors.accent} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.textPrimary, marginLeft: 0 }]}>
                Folder Analytics Dashboard
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                Storage distribution, AI confidence & entity tally
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Storage')}
          style={[styles.legalRow, { borderTopWidth: 1, borderTopColor: '#E2E8F020', marginTop: 4 }]}
          accessibilityRole="button"
          accessibilityLabel="Open Storage and Cache Manager"
        >
          <View style={styles.rowLabelGroup}>
            <Icon name="server-outline" size={20} color={theme.colors.primary} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.textPrimary, marginLeft: 0 }]}>
                Storage & Data Management
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                Database size, OCR cache & memory breakdown
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('RecycleBin')}
          style={[styles.legalRow, { borderTopWidth: 1, borderTopColor: '#E2E8F020', marginTop: 4 }]}
          accessibilityRole="button"
          accessibilityLabel="Open Recycle Bin"
        >
          <View style={styles.rowLabelGroup}>
            <Icon name="trash-bin-outline" size={20} color={theme.colors.error} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.textPrimary, marginLeft: 0 }]}>
                Recycle Bin
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                Restore or permanently delete screenshots
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.apiBtnRow}>
          <TouchableOpacity
            onPress={handleClearCache}
            style={[styles.testBtn, { borderColor: theme.colors.error, marginTop: 8 }]}
            accessibilityRole="button"
            accessibilityLabel="Purge App Cache"
          >
            <Icon name="trash-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
            <Text style={[styles.testBtnText, { color: theme.colors.error }]}>
              Purge App Cache
            </Text>
          </TouchableOpacity>
        </View>
      </ModernCard>

      {/* Developer & Diagnostics (Sprint RN-10) */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Diagnostics & Demo QA
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('QADebugPanel')}
          style={styles.legalRow}
          accessibilityRole="button"
          accessibilityLabel="Open QA Debug Panel"
        >
          <View style={styles.rowLabelGroup}>
            <Icon name="bug-outline" size={20} color="#10B981" />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.textPrimary, marginLeft: 0 }]}>
                QA Debug Panel
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                Live pipeline monitors, simulations & metrics
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleExportLogs}
          style={[styles.legalRow, { borderTopWidth: 1, borderTopColor: '#E2E8F020', marginTop: 4 }]}
          accessibilityRole="button"
          accessibilityLabel="Export Diagnostics Logs"
        >
          <View style={styles.rowLabelGroup}>
            <Icon name="document-text-outline" size={20} color={theme.colors.secondary} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.textPrimary, marginLeft: 0 }]}>
                Export Diagnostics Logs
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                Share diagnostic circular log buffer
              </Text>
            </View>
          </View>
          <Icon name="share-outline" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </ModernCard>

      {/* Local Backup & Restore (Sprint RN-11) */}
      <ModernCard style={styles.card}>
        <Text style={[styles.cardHeader, { color: theme.colors.textPrimary }]}>
          Local Backup &amp; Restore
        </Text>
        <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
          Create full offline JSON backups of your SQLite database, folder hierarchies, extracted OCR cache, and AI chat logs.
        </Text>

        <View style={styles.apiBtnRow}>
          <TouchableOpacity
            onPress={handleExportBackup}
            style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Export Backup JSON"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="cloud-download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Export Backup</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleImportBackup}
            style={[styles.testBtn, { borderColor: theme.colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Import Backup JSON"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="cloud-upload-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.testBtnText, { color: theme.colors.primary }]}>
                Import Backup
              </Text>
            </View>
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

        <TouchableOpacity
          onPress={() => {
            navigation.navigate('QADebugPanel');
          }}
          style={styles.versionRow}
          activeOpacity={0.7}
        >
          <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]}>
            {AppInfo.appName} Version
          </Text>
          <Text style={[styles.versionValue, { color: theme.colors.textPrimary }]}>
            {AppInfo.appVersion} (Build {AppInfo.buildNumber})
          </Text>
        </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  appearanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeThemeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeThemeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  themeSubtitle: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  themeSelectorGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  themeOptionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeOptionLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  themeOptionDesc: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  testBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  testBtnText: {
    fontWeight: '600',
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
  diagnosticContainer: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  diagBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  diagLabel: {
    fontSize: 12,
  },
  diagValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  guestBtnGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  guestPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  guestSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exitGuestBtn: {
    flexDirection: 'row',
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  exitGuestBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

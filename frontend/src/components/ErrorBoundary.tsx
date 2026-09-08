import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Share,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { loggerService } from '../services/loggerService';

export const STORAGE_KEY_FATAL_CRASH = '@contextvault_fatal_crashes';

export interface CrashReport {
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  platform: string;
  version: string | number;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo): Promise<void> {
    this.setState({ errorInfo });
    loggerService.error('UI', `Unhandled Render Crash: ${error.message}`, {
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Persist crash report to local storage
    try {
      const report: CrashReport = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack || undefined,
        componentStack: errorInfo.componentStack || undefined,
        platform: `${String(Platform.OS)} ${String(Platform.Version || '')}`,
        version: '1.0.0',
      };
      await AsyncStorage.setItem(STORAGE_KEY_FATAL_CRASH, JSON.stringify(report));
    } catch (e) {
      console.warn('Failed to persist crash report:', e);
    }
  }

  static async getLastCrashReport(): Promise<CrashReport | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_FATAL_CRASH);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static async clearCrashReports(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_FATAL_CRASH);
    } catch {
      // Ignored
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
  };

  handleShareCrash = async (): Promise<void> => {
    const errorMsg = this.state.error?.message || 'Unknown Error';
    const stack = this.state.error?.stack || 'No stack';
    const compStack = this.state.errorInfo?.componentStack || '';

    const text = [
      `=== ContextVault Crash Report ===`,
      `Time: ${new Date().toISOString()}`,
      `OS: ${Platform.OS} (v${Platform.Version})`,
      `Message: ${errorMsg}`,
      `--- Stack ---`,
      stack,
      `--- Component Stack ---`,
      compStack,
    ].join('\n');

    try {
      await Share.share({
        title: 'ContextVault Crash Diagnostics',
        message: text,
      });
      this.setState({ copied: true });
    } catch (e) {
      Alert.alert('Error Details', text.substring(0, 400));
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMsg = this.state.error?.message || 'An unexpected application error occurred.';

      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.iconContainer}>
              <Icon name="warning-outline" size={56} color="#EF4444" />
            </View>

            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              ContextVault encountered an unexpected error. Your screenshots and data remain safely stored locally on your device.
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Crash Details</Text>
              <Text style={styles.errorText} numberOfLines={3}>
                {errorMsg}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={this.handleReset}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Try Again to recover from error"
              >
                <Icon name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={this.handleShareCrash}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Copy or share crash logs"
              >
                <Icon name="copy-outline" size={16} color="#38BDF8" style={{ marginRight: 6 }} />
                <Text style={styles.shareButtonText}>
                  {this.state.copied ? 'Shared' : 'Copy Logs'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={this.toggleDetails}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Toggle technical error stack trace"
              >
                <Text style={styles.secondaryButtonText}>
                  {this.state.showDetails ? 'Hide' : 'Details'}
                </Text>
              </TouchableOpacity>
            </View>

            {this.state.showDetails && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailsHeader}>Stack Trace:</Text>
                <ScrollView horizontal style={styles.codeScroll}>
                  <Text style={styles.codeText}>
                    {this.state.error?.stack || 'No stack trace available'}
                  </Text>
                </ScrollView>
                {this.state.errorInfo?.componentStack && (
                  <>
                    <Text style={[styles.detailsHeader, { marginTop: 12 }]}>Component Stack:</Text>
                    <ScrollView horizontal style={styles.codeScroll}>
                      <Text style={styles.codeText}>
                        {this.state.errorInfo.componentStack}
                      </Text>
                    </ScrollView>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EF444415',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  primaryButton: {
    flex: 1.2,
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shareButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#0369A125',
    borderWidth: 1,
    borderColor: '#0284C750',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  detailsBox: {
    marginTop: 24,
    width: '100%',
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  detailsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  codeScroll: {
    maxHeight: 160,
  },
  codeText: {
    fontSize: 11,
    color: '#F1F5F9',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

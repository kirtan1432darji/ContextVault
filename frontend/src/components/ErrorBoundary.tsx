import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { loggerService } from '../services/loggerService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    loggerService.error('UI', `Unhandled Render Crash: ${error.message}`, {
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDark = true; // Safe high-contrast fallback for crash recovery
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
              ContextVault encountered an unexpected error. Your screenshots and data remain safely stored locally.
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Error Summary</Text>
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
                style={styles.secondaryButton}
                onPress={this.toggleDetails}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Toggle technical error stack trace"
              >
                <Text style={styles.secondaryButtonText}>
                  {this.state.showDetails ? 'Hide Details' : 'View Details'}
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
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
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
    paddingHorizontal: 16,
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
    fontSize: 14,
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

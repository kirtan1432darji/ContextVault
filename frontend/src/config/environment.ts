/**
 * ContextVault Central Runtime Environment Configuration
 *
 * Provides automatic environment selection based on React Native build mode (__DEV__ flag).
 * Separates API Base URL, App Name, Version, and Debug Flags between Development and Production.
 */

export interface EnvironmentConfig {
  env: 'development' | 'production';
  isProduction: boolean;
  appName: string;
  appVersion: string;
  buildNumber: number;
  apiBaseUrl: string;
  debugFlags: {
    enableDeveloperMode: boolean;
    enableDemoMode: boolean;
    enableLogging: boolean;
    enableCrashReporting: boolean;
    mockNetworkDelays: boolean;
  };
}

export const DevelopmentEnvironment: EnvironmentConfig = {
  env: 'development',
  isProduction: false,
  appName: 'ContextVault (Dev)',
  appVersion: '1.0.0',
  buildNumber: 1,
  apiBaseUrl: 'http://10.193.167.152:8000',
  debugFlags: {
    enableDeveloperMode: true,
    enableDemoMode: true,
    enableLogging: true,
    enableCrashReporting: false,
    mockNetworkDelays: true,
  },
};

export const ProductionEnvironment: EnvironmentConfig = {
  env: 'production',
  isProduction: true,
  appName: 'ContextVault',
  appVersion: '1.0.0',
  buildNumber: 1,
  apiBaseUrl: 'https://api.contextvault.app',
  debugFlags: {
    enableDeveloperMode: false,
    enableDemoMode: false,
    enableLogging: false,
    enableCrashReporting: true,
    mockNetworkDelays: false,
  },
};

// Safe evaluation of dev/prod across React Native runtime, Metro bundler, and Node/Jest test runners
const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production');
const isProd = !isDev;

export const ENV: EnvironmentConfig = isProd ? ProductionEnvironment : DevelopmentEnvironment;

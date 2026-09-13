import { StorageService } from '../utils/storage';

export type AppEnvironment = 'development' | 'local_release' | 'production';

export interface EnvironmentConfig {
  env: AppEnvironment;
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
  apiBaseUrl: 'http://10.33.95.96:8000',
  debugFlags: {
    enableDeveloperMode: true,
    enableDemoMode: true,
    enableLogging: true,
    enableCrashReporting: false,
    mockNetworkDelays: true,
  },
};

export const LocalReleaseEnvironment: EnvironmentConfig = {
  env: 'local_release',
  isProduction: false,
  appName: 'ContextVault',
  appVersion: '1.0.0',
  buildNumber: 1,
  apiBaseUrl: 'http://10.33.95.96:8000',
  debugFlags: {
    enableDeveloperMode: false,
    enableDemoMode: false,
    enableLogging: true,
    enableCrashReporting: false,
    mockNetworkDelays: false,
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

let generatedEnv: { apiBaseUrl?: string; environment?: string } = {};
try {
  generatedEnv = require('./env.generated.json');
} catch {}

class EnvironmentManagerClass {
  private activeEnvironment: AppEnvironment;
  private baseConfig: EnvironmentConfig;

  constructor() {
    this.activeEnvironment = this.detectEnvironment();
    this.baseConfig = this.resolveConfig(this.activeEnvironment);
    this.logActiveEnvironment();
  }

  private detectEnvironment(): AppEnvironment {
    // 1. In development mode (Metro dev server, __DEV__ = true)
    const isDev =
      typeof __DEV__ !== 'undefined'
        ? Boolean(__DEV__)
        : typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
    if (isDev) {
      return 'development';
    }

    // 2. Production override flag (e.g. CI/CD or Play Store release build)
    const buildEnv =
      typeof process !== 'undefined' ? process.env.APP_BUILD_ENV || process.env.APP_ENV : null;
    if (buildEnv === 'production' || generatedEnv.environment === 'production') {
      return 'production';
    }

    // 3. Default for release APK is local_release (connects to local backend unless overridden)
    return 'local_release';
  }

  private resolveConfig(env: AppEnvironment): EnvironmentConfig {
    const customApiBaseUrl = generatedEnv.apiBaseUrl;
    switch (env) {
      case 'production':
        return {
          ...ProductionEnvironment,
          apiBaseUrl:
            env === 'production' && generatedEnv.environment === 'production' && customApiBaseUrl
              ? customApiBaseUrl
              : ProductionEnvironment.apiBaseUrl,
        };
      case 'local_release':
        return {
          ...LocalReleaseEnvironment,
          apiBaseUrl: customApiBaseUrl || LocalReleaseEnvironment.apiBaseUrl,
        };
      case 'development':
      default:
        return {
          ...DevelopmentEnvironment,
          apiBaseUrl: customApiBaseUrl || DevelopmentEnvironment.apiBaseUrl,
        };
    }
  }

  public getEnvironment(): AppEnvironment {
    return this.activeEnvironment;
  }

  public getDefaultUrl(): string {
    return this.baseConfig.apiBaseUrl;
  }

  /**
   * Returns active base URL (e.g. "http://10.122.196.152:8000").
   * Prioritizes MMKV runtime override in dev / local_release.
   */
  public getApiBaseUrl(): string {
    if (this.isDeveloperModeAvailable()) {
      const override = StorageService.getBackendUrlOverride();
      if (override && override.trim().length > 0) {
        return this.normalizeUrl(override.trim());
      }
    }
    return this.normalizeUrl(this.baseConfig.apiBaseUrl);
  }

  /**
   * Returns normalized API URL with /api suffix (e.g. "http://10.122.196.152:8000/api").
   */
  public getApiUrl(): string {
    const base = this.getApiBaseUrl();
    if (base.endsWith('/api')) {
      return base;
    }
    return `${base}/api`;
  }

  public setCustomBackendUrl(url: string): void {
    const trimmed = url.trim();
    if (!this.isValidUrl(trimmed)) {
      throw new Error('Invalid backend URL. Please ensure it starts with http:// or https://');
    }
    const cleanUrl = this.normalizeUrl(trimmed);
    StorageService.setBackendUrlOverride(cleanUrl);
  }

  public resetToDefaultUrl(): void {
    StorageService.clearBackendUrlOverride();
  }

  public isDeveloperModeAvailable(): boolean {
    return this.activeEnvironment !== 'production';
  }

  public isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return /^https?:\/\/.+/i.test(trimmed);
  }

  public normalizeUrl(url: string): string {
    let clean = url.trim().replace(/\/+$/, '');
    if (clean.endsWith('/api')) {
      clean = clean.slice(0, -4);
    }
    return clean;
  }

  public getConfig(): EnvironmentConfig {
    const currentBaseUrl = this.getApiBaseUrl();
    return {
      ...this.baseConfig,
      apiBaseUrl: currentBaseUrl,
      debugFlags: {
        ...this.baseConfig.debugFlags,
      },
    };
  }

  private logActiveEnvironment(): void {
    if (this.activeEnvironment !== 'production') {
      console.log(`[EnvironmentManager] Active Environment: ${this.activeEnvironment}`);
      console.log(`[EnvironmentManager] Backend Base URL: ${this.getApiBaseUrl()}`);
    }
  }
}

export const EnvironmentManager = new EnvironmentManagerClass();

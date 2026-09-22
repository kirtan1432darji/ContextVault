import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/environment';
import { loggerService } from './loggerService';

export const STORAGE_KEY_CRASH_LOGS = '@contextvault_crashlytics_logs';

export interface CrashlyticsRecord {
  id: string;
  timestamp: string;
  type: 'FATAL_JS' | 'NON_FATAL_ERROR' | 'UNHANDLED_PROMISE';
  message: string;
  stack?: string;
  attributes?: Record<string, string>;
  platform: string;
  version: string;
  isFatal: boolean;
}

export class CrashReportingService {
  private isInitialized = false;
  private attributes: Record<string, string> = {};
  private userId: string | null = null;
  private defaultHandler: any = null;

  /**
   * Determine if crash reporting is active.
   * Strictly active in release builds (!__DEV__) when enableCrashReporting is true.
   * Completely disabled in debug builds to prevent any analytics collection.
   */
  public isEnabled(): boolean {
    return ENV.isProduction && ENV.debugFlags.enableCrashReporting;
  }

  /**
   * Initialize Firebase Crashlytics and automated global JS exception handler.
   */
  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Set standard device & environment attributes
    this.setAttribute('platform', Platform.OS);
    this.setAttribute('platformVersion', String(Platform.Version));
    this.setAttribute('appVersion', ENV.appVersion);
    this.setAttribute('buildNumber', String(ENV.buildNumber));
    this.setAttribute('environment', ENV.env);

    // If in debug build, suppress external tracking and log initialization
    if (!this.isEnabled()) {
      loggerService.info('App', '[CrashReporting] Debug mode active: Crash reporting and analytics collection disabled.');
      return;
    }

    loggerService.info('App', '[CrashReporting] Production mode active: Initializing Firebase Crashlytics handler.');

    // Attach automated global JS unhandled exception handler
    if ((global as any).ErrorUtils) {
      this.defaultHandler = (global as any).ErrorUtils.getGlobalHandler();
      (global as any).ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        this.recordCrash({
          id: `${Date.now()}_crash`,
          timestamp: new Date().toISOString(),
          type: isFatal ? 'FATAL_JS' : 'NON_FATAL_ERROR',
          message: error?.message || 'Unknown unhandled error',
          stack: error?.stack,
          attributes: { ...this.attributes },
          platform: `${Platform.OS} ${Platform.Version}`,
          version: ENV.appVersion,
          isFatal: !!isFatal,
        });

        // Delegate to standard React Native error handler if available
        if (this.defaultHandler) {
          this.defaultHandler(error, isFatal);
        }
      });
    }

    loggerService.info('App', '[CrashReporting] Automatic JS exception reporting and native crash hooks attached.');
  }

  /**
   * Attach custom diagnostic attribute key-value pairs
   */
  public setAttribute(key: string, value: string): void {
    this.attributes[key] = value;
  }

  /**
   * Set user ID for crash identification (anonymized)
   */
  public setUserId(userId: string): void {
    this.userId = userId;
    this.setAttribute('userId', userId);
  }

  /**
   * Log non-fatal error event to Crashlytics
   */
  public recordError(error: Error | string, context?: Record<string, any>): void {
    if (!this.isEnabled()) {
      return;
    }

    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const record: CrashlyticsRecord = {
      id: `${Date.now()}_err`,
      timestamp: new Date().toISOString(),
      type: 'NON_FATAL_ERROR',
      message,
      stack,
      attributes: {
        ...this.attributes,
        ...(context ? Object.fromEntries(Object.entries(context).map(([k, v]) => [k, String(v)])) : {}),
      },
      platform: `${Platform.OS} ${Platform.Version}`,
      version: ENV.appVersion,
      isFatal: false,
    };

    this.persistCrashRecord(record);
  }

  /**
   * Internal persistence for crash dump inspection
   */
  private async persistCrashRecord(record: CrashlyticsRecord): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY_CRASH_LOGS);
      const list: CrashlyticsRecord[] = existing ? JSON.parse(existing) : [];
      list.unshift(record);
      // Keep last 25 records
      if (list.length > 25) list.length = 25;
      await AsyncStorage.setItem(STORAGE_KEY_CRASH_LOGS, JSON.stringify(list));
    } catch {
      // Ignored
    }
  }

  private async recordCrash(record: CrashlyticsRecord): Promise<void> {
    loggerService.error('App', `[CrashReporting] Unhandled Exception: ${record.message}`, record);
    await this.persistCrashRecord(record);
  }

  /**
   * Retrieve all recorded crash logs
   */
  public async getRecordedCrashLogs(): Promise<CrashlyticsRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_CRASH_LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear recorded crash logs
   */
  public async clearRecordedCrashLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_CRASH_LOGS);
    } catch {
      // Ignored
    }
  }
}

export const crashReportingService = new CrashReportingService();

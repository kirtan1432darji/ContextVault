export const AppInfo = {
  appName: 'ContextVault',
  tagline: 'Turn Screenshots into Searchable Knowledge',
  appVersion: '1.0.0',
  buildNumber: '1',
};

export const AppConstants = {
  appName: AppInfo.appName,
  tagline: AppInfo.tagline,
  appVersion: AppInfo.appVersion,
  buildNumber: AppInfo.buildNumber,

  // Storage Keys (MMKV / AsyncStorage)
  keyIsFirstLaunch: 'is_first_launch',
  keyThemeMode: 'app_theme_mode',
  keyAutoScanOnLaunch: 'auto_scan_on_launch',
  keyAutoDetectScreenshots: 'auto_detect_screenshots',
  keyScreenshotNotifications: 'screenshot_notifications',
  keyScanOnlyScreenshots: 'scan_only_screenshots',
  keyBackendUrl: 'backend_api_url',
  keyUseMockAi: 'use_mock_ai',
  keyLastScanTimestamp: 'last_scan_timestamp',
  keyRecentSearches: 'recent_search_queries',
  keyAuthToken: 'contextvault_auth_token',
  keyRefreshToken: 'contextvault_refresh_token',
  keyUserSession: 'contextvault_user_session',

  // Local SQLite database settings
  databaseName: 'ai_screenshot_organizer.db',
  databaseVersion: 1,

  // Pagination & limits
  defaultPageSize: 30,
  recentScreenshotsLimit: 12,
  maxRecentSearches: 10,

  // AI Confidence thresholds
  highConfidenceThreshold: 0.85,
  mediumConfidenceThreshold: 0.65,
};

export const ApiConstants = {
  // Default base URL for physical device / emulator
  defaultBaseUrl: 'http://127.0.0.1:5000/api',

  // Timeout settings
  connectTimeout: 15000,
  receiveTimeout: 25000,
  sendTimeout: 20000,

  // Auth Endpoints
  authRegister: '/auth/register',
  authLogin: '/auth/login',
  authRefresh: '/auth/refresh',
  authLogout: '/auth/logout',

  // Screenshot Endpoints
  screenshots: '/screenshots',
  scanScreenshot: '/screenshots/scan',
  batchScan: '/screenshots/batch',
  classifyScreenshot: '/screenshots/classify',
  batchClassify: '/screenshots/batch-classify',

  // AI Classification Engine Endpoints (Sprint 1.3)
  classificationClassify: '/classification/classify',
  classificationReclassify: '/classification/reclassify',
  classificationHistory: '/classification/history',

  // Category & Tag Endpoints
  categories: '/categories',
  tags: '/tags',
  folders: '/folders',
  syncFolders: '/folders/sync',

  // Folder Context & AI Chat Endpoints (Sprint 1.4)
  context: '/context',
  folderContext: (categoryId: string) => `/context/${categoryId}`,
  generateFolderContext: (categoryId: string) => `/context/generate/${categoryId}`,
  chatMessage: '/chat/message',
  chatHistory: (sessionId: string) => `/chat/history/${sessionId}`,

  // Sync & Search Endpoints
  sync: '/sync',
  syncChanges: '/sync/changes',
  semanticSearch: '/search',
  healthCheck: '/health',
};

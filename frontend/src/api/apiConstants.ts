export const ApiConstants = {
  // Default base URL for physical device with adb reverse / emulator (FastAPI default port 8000)
  defaultBaseUrl: 'http://localhost:8000/api',

  // Timeout settings
  connectTimeout: 15000,
  receiveTimeout: 25000,
  sendTimeout: 20000,

  // Auth Endpoints (Frozen Backend Contract)
  authRegister: '/auth/register',
  authLogin: '/auth/login',
  authProfile: '/auth/profile',
  authRefresh: '/auth/refresh',
  authLogout: '/auth/logout',

  // Screenshot Endpoints
  screenshots: '/screenshots',
  uploadMetadata: '/screenshots/upload-metadata',
  syncScreenshots: '/screenshots/sync',
  scanScreenshot: '/screenshots/scan',
  batchScan: '/screenshots/batch',
  classifyScreenshot: '/screenshots/classify',
  batchClassify: '/screenshots/batch-classify',

  // AI Classification Engine Endpoints
  classificationClassify: '/classification/classify',
  classificationReclassify: '/classification/reclassify',
  classificationHistory: '/classification/history',

  // Category & Tag Endpoints
  categories: '/categories',
  tags: '/tags',
  folders: '/folders',
  syncFolders: '/folders/sync',

  // Folder Context & AI Chat Endpoints
  context: '/context',
  folderContext: (categoryId: string) => `/context/${categoryId}`,
  generateFolderContext: (categoryId: string) => `/context/generate/${categoryId}`,
  chatMessage: '/chat/message',
  chatHistory: (folderId: string) => `/chat/history/${folderId}`,
  chatSuggestions: (folderId: string) => `/chat/suggestions/${folderId}`,
  chatSessions: (folderId: string) => `/chat/sessions/${folderId}`,
  chatDeleteSession: (sessionId: string) => `/chat/session/${sessionId}`,

  // Sync & Search Endpoints
  sync: '/sync',
  syncChanges: '/sync/changes',
  semanticSearch: '/search',
  healthCheck: '/health',
};

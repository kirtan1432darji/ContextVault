import { API_BASE_URL, REQUEST_TIMEOUT_MS, API_V1_PREFIX } from '../config/apiConfig';

export const ApiConstants = {
  // Default base URL for physical device / APK connecting to Docker host (FastAPI default port 8000)
  defaultBaseUrl: `${API_BASE_URL}${API_V1_PREFIX}`,

  // Timeout settings (30s)
  connectTimeout: REQUEST_TIMEOUT_MS,
  receiveTimeout: REQUEST_TIMEOUT_MS,
  sendTimeout: REQUEST_TIMEOUT_MS,

  // Auth Endpoints (Frozen Backend Contract)
  authRegister: '/auth/register',
  authLogin: '/auth/login',
  authProfile: '/auth/profile',
  authRefresh: '/auth/refresh',
  authLogout: '/auth/logout',
  authForgotPassword: '/auth/forgot-password',

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
  contextSearch: '/context/search',
  categoryTree: '/categories?tree=true',
  singleScreenshot: (id: string) => `/screenshots/${id}`,
  healthCheck: '/health',
};

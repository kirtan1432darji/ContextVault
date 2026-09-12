/**
 * Vision AI Foundation Types (ContextVault Version 1.1)
 */

export type VisionScreenType =
  | 'shopping_receipt'
  | 'payment_confirmation'
  | 'banking_transaction'
  | 'code_editor'
  | 'chat_conversation'
  | 'social_feed'
  | 'travel_ticket'
  | 'food_delivery'
  | 'document_article'
  | 'entertainment_media'
  | 'settings_system'
  | 'other';

export interface VisionScene {
  screenType: VisionScreenType | string;
  application: string;
  summary: string;
  objects: string[];
  entities: Record<string, any>;
  confidence: number;
  detectedLogos: string[];
  detectedIcons: string[];
  colors: string[];
  language: string;
}

export type VisionApiProvider = 'groq' | 'gemini' | 'openai_compatible';

export interface VisionApiKeyEntry {
  id: string;
  provider: VisionApiProvider;
  apiKey: string;
  model: string;
  enabled: boolean;
  endpoint?: string;
  errorCount?: number;
  lastUsedAt?: string;
  cooldownUntil?: number;
}

export interface VisionModelConfig {
  id: string;
  name: string;
  family: 'gemma_vision' | 'qwen_vl' | 'llama_vision' | 'gemini_vision' | 'heuristic_offline';
  version: string;
  parameterSize: string;
  quantization?: string;
  preferredCompute: 'cpu' | 'gpu' | 'npu' | 'cloud' | 'auto';
  maxResolution: number;
  contextWindow: number;
  isAvailable: boolean;
}

export interface DeviceCapabilities {
  totalMemoryMB: number;
  availableMemoryMB: number;
  hasHardwareAcceleration: boolean;
  supportedCompute: ('cpu' | 'gpu' | 'npu' | 'cloud')[];
  recommendedModelId: string;
}

export interface PreprocessedImage {
  uri: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  scaleFactor: number;
  aspectRatio: number;
  format: 'rgb' | 'rgba' | 'jpeg';
  colorSpace: 'sRGB';
  orientation: number;
  base64?: string;
  compressedSizeEstimateBytes: number;
}

export type VisionQueueStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface VisionQueueItem {
  id: string;
  screenshotId: string;
  filePath: string;
  fileName: string;
  ocrText?: string;
  deviceFolder?: string;
  status: VisionQueueStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  processingTimeMs?: number;
}

export interface VisionCacheRecord {
  screenshot_id: string;
  screen_type: string;
  application_name: string;
  summary: string;
  detected_objects: string; // JSON string of string[]
  detected_entities: string; // JSON string of Record<string, any>
  detected_logos: string; // JSON string of string[]
  confidence: number;
  processed_at: string;
  model_version: string;
}

export interface VisionInferenceResult {
  screenshotId: string;
  scene: VisionScene;
  processingTimeMs: number;
  modelVersion: string;
  provider: string;
  cached: boolean;
  rawResponse?: string;
}

export interface UnifiedScreenshotMetadata {
  screenshotId: string;
  screenType: string;
  primaryApplication: string;
  merchant?: string;
  amount?: string;
  orderId?: string;
  referenceNumber?: string;
  deliveryDate?: string;
  urls: string[];
  emails: string[];
  phoneNumbers: string[];
  objects: string[];
  detectedLogos: string[];
  summary: string;
  ocrText: string;
  confidence: number;
  mergedAt: string;
}

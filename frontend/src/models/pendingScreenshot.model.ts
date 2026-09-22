export type PendingScreenshotStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface PendingScreenshot {
  id: string;
  deviceAssetId: string;
  filePath: string;
  localPath?: string;
  contentUri?: string;
  thumbnailUri?: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  capturedAt: string;
  status: PendingScreenshotStatus;
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;

  // Sprint RN-04 Metadata & OCR Extraction Fields
  deviceFolder?: string;
  mimeType?: string;
  resolution?: string;
  width?: number;
  height?: number;
  ocrStatus?: PendingScreenshotStatus;
  ocrProcessingTime?: number;
  extractedText?: string;
}

export interface DetectedScreenshotEvent {
  deviceAssetId?: string;
  filePath: string;
  localPath?: string;
  contentUri?: string;
  thumbnailUri?: string;
  fileName?: string;
  fileSize?: number;
  fileHash?: string;
  width?: number;
  height?: number;
  timestamp?: number;
  uri?: string;
  deviceFolder?: string;
  mimeType?: string;
}

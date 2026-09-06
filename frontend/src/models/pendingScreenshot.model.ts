export type PendingScreenshotStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface PendingScreenshot {
  id: string;
  deviceAssetId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  capturedAt: string;
  status: PendingScreenshotStatus;
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedScreenshotEvent {
  deviceAssetId?: string;
  filePath: string;
  fileName?: string;
  fileSize?: number;
  fileHash?: string;
  width?: number;
  height?: number;
  timestamp?: number;
  uri?: string;
}

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { screenshotScannerService } from '../screenshotScannerService';
import { FileUtils } from '../../utils/fileUtils';

const { MediaObserverModule } = NativeModules;

export class MediaObserverService {
  private isObserving = false;
  private eventEmitter: NativeEventEmitter | null = null;
  private subscription: any = null;

  startObserving() {
    if (this.isObserving) return;
    this.isObserving = true;

    if (Platform.OS === 'android' && MediaObserverModule) {
      this.eventEmitter = new NativeEventEmitter(MediaObserverModule);
      this.subscription = this.eventEmitter.addListener(
        'onScreenshotDetected',
        this.handleScreenshotDetected
      );
      MediaObserverModule.startObserving();
      console.log('[MediaObserver] Android MediaStore ContentObserver started.');
    } else {
      console.log('[MediaObserver] Background observer active (fallback mode).');
    }
  }

  stopObserving() {
    if (!this.isObserving) return;
    this.isObserving = false;

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (Platform.OS === 'android' && MediaObserverModule) {
      MediaObserverModule.stopObserving();
    }
    console.log('[MediaObserver] Stopped observing.');
  }

  private handleScreenshotDetected = async (event: {
    uri: string;
    filePath: string;
    fileName?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    timestamp?: number;
  }) => {
    try {
      const fileName = event.fileName || FileUtils.getFileName(event.filePath);
      const fileSize = event.fileSize || 0;
      const width = event.width || 1080;
      const height = event.height || 2400;
      const createdAt = event.timestamp
        ? new Date(event.timestamp).toISOString()
        : new Date().toISOString();

      await screenshotScannerService.processScreenshotAsset({
        id: event.uri || `asset_${Date.now()}`,
        filePath: event.filePath,
        fileName,
        fileSize,
        width,
        height,
        createdAt,
      });
    } catch (err) {
      console.error('[MediaObserver] Error handling detected screenshot:', err);
    }
  };
}

export const mediaObserverService = new MediaObserverService();

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { DetectedScreenshotEvent } from '../../models';

const MediaObserverModule = NativeModules?.MediaObserverModule;

export type ScreenshotDetectedListener = (event: DetectedScreenshotEvent) => void;

export class MediaObserverService {
  private isObserving = false;
  private eventEmitter: NativeEventEmitter | null = null;
  private subscription: any = null;
  private listeners: Set<ScreenshotDetectedListener> = new Set();

  constructor() {
    if (Platform.OS === 'android' && MediaObserverModule) {
      this.eventEmitter = new NativeEventEmitter(MediaObserverModule);
    }
  }

  isSupported(): boolean {
    return Platform.OS === 'android' && !!MediaObserverModule;
  }

  getIsObserving(): boolean {
    return this.isObserving;
  }

  startObserving(callback?: ScreenshotDetectedListener): boolean {
    if (callback) {
      this.listeners.add(callback);
    }

    if (this.isObserving) {
      return true;
    }

    if (Platform.OS === 'android' && MediaObserverModule) {
      if (!this.eventEmitter) {
        this.eventEmitter = new NativeEventEmitter(MediaObserverModule);
      }

      this.subscription = this.eventEmitter.addListener(
        'onScreenshotDetected',
        this.handleScreenshotDetected
      );

      try {
        MediaObserverModule.startObserving();
        this.isObserving = true;
        console.log('[MediaObserver] Android MediaStore ContentObserver started.');
        return true;
      } catch (err) {
        console.error('[MediaObserver] Failed to start native ContentObserver:', err);
        return false;
      }
    } else {
      console.log('[MediaObserver] Native module not available on this platform (fallback mode active).');
      this.isObserving = true;
      return true;
    }
  }

  stopObserving(): void {
    if (!this.isObserving) return;
    this.isObserving = false;

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (Platform.OS === 'android' && MediaObserverModule) {
      try {
        MediaObserverModule.stopObserving();
      } catch (err) {
        console.error('[MediaObserver] Failed to stop native observer:', err);
      }
    }
    console.log('[MediaObserver] Stopped observing MediaStore.');
  }

  addListener(listener: ScreenshotDetectedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  removeListener(listener: ScreenshotDetectedListener): void {
    this.listeners.delete(listener);
  }

  async checkLatestScreenshot(): Promise<DetectedScreenshotEvent | null> {
    if (Platform.OS === 'android' && MediaObserverModule?.checkLatestScreenshot) {
      try {
        return await MediaObserverModule.checkLatestScreenshot();
      } catch (err) {
        console.warn('[MediaObserver] Error checking latest screenshot:', err);
      }
    }
    return null;
  }

  async queryRecentScreenshots(limit = 20): Promise<DetectedScreenshotEvent[]> {
    if (Platform.OS === 'android' && MediaObserverModule?.queryRecentScreenshots) {
      try {
        return await MediaObserverModule.queryRecentScreenshots(limit);
      } catch (err) {
        console.warn('[MediaObserver] Error querying recent screenshots:', err);
      }
    }
    return [];
  }

  async generateThumbnail(uriOrPath: string, targetSize = 300): Promise<string | null> {
    if (Platform.OS === 'android' && MediaObserverModule?.generateThumbnail) {
      try {
        return await MediaObserverModule.generateThumbnail(uriOrPath, targetSize);
      } catch (err) {
        console.warn('[MediaObserver] Error generating native thumbnail:', err);
      }
    }
    return null;
  }

  async deleteThumbnail(thumbnailUri: string): Promise<boolean> {
    if (Platform.OS === 'android' && MediaObserverModule?.deleteThumbnail) {
      try {
        return await MediaObserverModule.deleteThumbnail(thumbnailUri);
      } catch (err) {
        console.warn('[MediaObserver] Error deleting native thumbnail:', err);
      }
    }
    return false;
  }

  private handleScreenshotDetected = (event: DetectedScreenshotEvent) => {
    console.log('[MediaObserver] Native screenshot detected:', event?.fileName);
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[MediaObserver] Listener error:', err);
      }
    });
  };
}

export const mediaObserverService = new MediaObserverService();

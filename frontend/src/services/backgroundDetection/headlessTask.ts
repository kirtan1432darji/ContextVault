import { mediaObserverService } from './mediaObserver';
import { screenshotListenerService } from '../ScreenshotListenerService';

/**
 * Headless JS task for Android background screenshot processing.
 * Runs in background without UI thread blocking.
 */
export const screenshotDetectionHeadlessTask = async (taskData?: any) => {
  console.log('[HeadlessTask] ScreenshotDetectionTask triggered in background', taskData);

  try {
    // If specific screenshot data was provided by an Android broadcast/intent
    if (taskData?.filePath) {
      await screenshotListenerService.handleDetectedScreenshot({
        deviceAssetId: taskData.deviceAssetId,
        filePath: taskData.filePath,
        fileName: taskData.fileName,
        fileSize: taskData.fileSize,
        fileHash: taskData.fileHash,
        width: taskData.width,
        height: taskData.height,
        timestamp: taskData.timestamp,
      });
    } else {
      // Otherwise check latest media screenshot from MediaStore
      const latest = await mediaObserverService.checkLatestScreenshot();
      if (latest) {
        await screenshotListenerService.handleDetectedScreenshot(latest);
      }
    }
  } catch (err) {
    console.error('[HeadlessTask] Error in screenshot detection headless task:', err);
  }
};

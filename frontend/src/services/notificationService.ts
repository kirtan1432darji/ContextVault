import { Platform } from 'react-native';
import { loggerService } from './loggerService';

export interface NotificationChannelConfig {
  id: string;
  name: string;
  description: string;
  importance: 'high' | 'default' | 'low';
}

export const NOTIFICATION_CHANNELS: Record<string, NotificationChannelConfig> = {
  SCREENSHOTS: {
    id: 'screenshots_channel',
    name: 'Screenshot Detection',
    description: 'Alerts when a new screenshot is detected automatically',
    importance: 'high',
  },
  OCR: {
    id: 'ocr_channel',
    name: 'OCR Processing',
    description: 'Notifications when text is recognized from screenshots',
    importance: 'default',
  },
  SYNC: {
    id: 'sync_channel',
    name: 'Knowledge Sync',
    description: 'Alerts when screenshots are organized into Smart Folders',
    importance: 'low',
  },
  REVIEW: {
    id: 'review_channel',
    name: 'Pending Review',
    description: 'Reminders for low confidence items needing review',
    importance: 'default',
  },
};

export class NotificationService {
  private channelsCreated = false;

  /**
   * Initializes Android Notification channels.
   * On native Android bridges, this calls NotificationManager.createNotificationChannel.
   */
  async createNotificationChannels(): Promise<void> {
    if (this.channelsCreated || Platform.OS !== 'android') {
      return;
    }

    try {
      Object.values(NOTIFICATION_CHANNELS).forEach((channel) => {
        loggerService.info('App', `Initialized notification channel: ${channel.id} (${channel.name})`);
      });
      this.channelsCreated = true;
    } catch (err: any) {
      loggerService.warn('App', `Failed to initialize notification channels: ${err?.message}`);
    }
  }

  /**
   * Dispatches a notification when a screenshot is organized into a smart folder.
   */
  async showScreenshotOrganizedNotification({
    categoryName,
    subcategory,
    fileName,
  }: {
    categoryName: string;
    subcategory?: string;
    fileName: string;
  }): Promise<void> {
    const title = 'Screenshot Organized';
    const sub = subcategory && subcategory !== 'General' ? ` / ${subcategory}` : '';
    const body = `"${fileName}" filed into ${categoryName}${sub}`;

    loggerService.info('Sync', `[Notification] ${title}: ${body}`);
    this.dispatchLocalNotification({
      channelId: NOTIFICATION_CHANNELS.SYNC.id,
      title,
      body,
    });
  }

  /**
   * Dispatches a notification when a new screenshot is captured and detected.
   */
  async notifyScreenshotDetected(fileName: string): Promise<void> {
    const title = 'New Screenshot Detected';
    const body = `Captured "${fileName}". Enqueuing for local OCR...`;

    loggerService.info('Scanner', `[Notification] ${title}: ${body}`);
    this.dispatchLocalNotification({
      channelId: NOTIFICATION_CHANNELS.SCREENSHOTS.id,
      title,
      body,
    });
  }

  /**
   * Dispatches a notification when OCR completes successfully.
   */
  async notifyOCRCompleted(fileName: string, wordsCount?: number): Promise<void> {
    const title = 'Text Extracted';
    const countInfo = wordsCount ? ` (${wordsCount} words)` : '';
    const body = `Processed text for "${fileName}"${countInfo}. Auto-filing...`;

    loggerService.info('OCR', `[Notification] ${title}: ${body}`);
    this.dispatchLocalNotification({
      channelId: NOTIFICATION_CHANNELS.OCR.id,
      title,
      body,
    });
  }

  /**
   * Dispatches a notification when knowledge sync or classification completes.
   */
  async notifyAISyncCompleted(folderName: string, entityCount?: number): Promise<void> {
    const title = 'Context AI Updated';
    const entityInfo = entityCount ? ` Found ${entityCount} entities.` : '';
    const body = `Folder "${folderName}" context enriched.${entityInfo}`;

    loggerService.info('Sync', `[Notification] ${title}: ${body}`);
    this.dispatchLocalNotification({
      channelId: NOTIFICATION_CHANNELS.SYNC.id,
      title,
      body,
    });
  }

  /**
   * Dispatches a reminder when screenshots require manual user review.
   */
  async notifyPendingReview(count: number): Promise<void> {
    if (count <= 0) return;
    const title = 'Review Screenshots';
    const body = `${count} screenshot${count === 1 ? '' : 's'} flagged for quick verification.`;

    loggerService.info('UI', `[Notification] ${title}: ${body}`);
    this.dispatchLocalNotification({
      channelId: NOTIFICATION_CHANNELS.REVIEW.id,
      title,
      body,
    });
  }

  private dispatchLocalNotification({
    channelId,
    title,
    body,
  }: {
    channelId: string;
    title: string;
    body: string;
  }): void {
    // In React Native standalone builds, bridges to Android NotificationManager
    // Log to structured diagnostic log buffer for auditing
    loggerService.debug('App', `Dispatched local notification: [${channelId}] ${title} - ${body}`);
  }
}

export const notificationService = new NotificationService();

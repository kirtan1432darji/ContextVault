import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { loggerService } from './loggerService';

export type StoragePermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

export interface AllPermissionsStatus {
  storage: StoragePermissionStatus;
  notifications: StoragePermissionStatus;
  allGranted: boolean;
}

export class PermissionService {
  /**
   * Returns the exact storage permission string based on Android SDK level:
   * - Android 13+ (API 33+): READ_MEDIA_IMAGES
   * - Android 12- (API <= 32): READ_EXTERNAL_STORAGE
   */
  getRequiredStoragePermission(): (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS] | null {
    if (Platform.OS !== 'android') {
      return null;
    }

    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);

    if (apiLevel >= 33) {
      return PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;
    } else {
      return PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    }
  }

  // Alias for backward compatibility
  getRequiredPermission(): (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS] | null {
    return this.getRequiredStoragePermission();
  }

  getPermissionDescription(): string {
    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    return apiLevel >= 33 ? 'READ_MEDIA_IMAGES (Android 13+)' : 'READ_EXTERNAL_STORAGE (Android 12-)';
  }

  /**
   * Checks current storage/media permission status.
   */
  async checkStoragePermission(): Promise<StoragePermissionStatus> {
    if (Platform.OS !== 'android') {
      return 'granted';
    }

    const permission = this.getRequiredStoragePermission();
    if (!permission) return 'unavailable';

    try {
      const hasPermission = await PermissionsAndroid.check(permission);
      const status: StoragePermissionStatus = hasPermission ? 'granted' : 'denied';
      loggerService.debug('Scanner', `Storage permission checked: ${status}`);
      return status;
    } catch (err) {
      loggerService.warn('Scanner', 'Error checking storage permission', err);
      return 'denied';
    }
  }

  /**
   * Checks current notification permission status (Android 13+).
   */
  async checkNotificationPermission(): Promise<StoragePermissionStatus> {
    if (Platform.OS !== 'android') {
      return 'granted';
    }

    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (apiLevel < 33) {
      return 'granted'; // Notifications granted by default below Android 13
    }

    try {
      const postNotificationPerm = (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS;
      if (!postNotificationPerm) return 'granted';

      const hasPermission = await PermissionsAndroid.check(postNotificationPerm);
      return hasPermission ? 'granted' : 'denied';
    } catch (err) {
      loggerService.warn('App', 'Error checking notification permission', err);
      return 'denied';
    }
  }

  /**
   * Checks all application permissions together.
   */
  async checkAllPermissions(): Promise<AllPermissionsStatus> {
    const [storage, notifications] = await Promise.all([
      this.checkStoragePermission(),
      this.checkNotificationPermission(),
    ]);

    return {
      storage,
      notifications,
      allGranted: storage === 'granted' && notifications === 'granted',
    };
  }

  /**
   * Requests media permission with rationale dialog if needed.
   */
  async requestStoragePermission(promptSettingsIfBlocked = true): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = this.getRequiredStoragePermission();
    if (!permission) return true;

    try {
      const rationale = {
        title: 'ContextVault Storage Permission',
        message:
          'ContextVault requires access to your photos to automatically detect screenshots and organize them locally on your device.',
        buttonPositive: 'Allow Access',
        buttonNegative: 'Deny',
      };

      const result = await PermissionsAndroid.request(permission, rationale);

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        loggerService.info('Scanner', 'Storage permission granted by user');
        return true;
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        loggerService.warn('Scanner', 'Storage permission permanently blocked');
        if (promptSettingsIfBlocked) {
          this.showBlockedPermissionDialog();
        }
        return false;
      } else {
        loggerService.info('Scanner', 'Storage permission denied by user');
        return false;
      }
    } catch (err) {
      loggerService.error('Scanner', 'Error requesting storage permission', err);
      return false;
    }
  }

  /**
   * Requests notification permission on Android 13+.
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (apiLevel < 33) {
      return true;
    }

    try {
      const postNotificationPerm = (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS;
      if (!postNotificationPerm) return true;

      const result = await PermissionsAndroid.request(postNotificationPerm, {
        title: 'ContextVault Notifications',
        message: 'Allow ContextVault to notify you when screenshots are detected and organized into smart folders.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not Now',
      });

      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      loggerService.info('App', `Notification permission result: ${result}`);
      return granted;
    } catch (err) {
      loggerService.warn('App', 'Error requesting notification permission', err);
      return false;
    }
  }

  /**
   * Requests all necessary permissions in a clean sequence.
   */
  async requestAllPermissions(): Promise<boolean> {
    const storageOk = await this.requestStoragePermission(false);
    const notifOk = await this.requestNotificationPermission();
    return storageOk && notifOk;
  }

  showBlockedPermissionDialog(): void {
    Alert.alert(
      'Permission Required',
      'ContextVault cannot automatically detect screenshots without photo access. Please enable Media/Photos permission in App Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ]
    );
  }

  openSettings(): void {
    Linking.openSettings().catch(() => {});
  }
}

export const permissionService = new PermissionService();

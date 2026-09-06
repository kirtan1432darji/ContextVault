import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

export type StoragePermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

export class PermissionService {
  /**
   * Returns the exact permission string based on Android SDK level:
   * - Android 13+ (API 33+): READ_MEDIA_IMAGES
   * - Android 12- (API <= 32): READ_EXTERNAL_STORAGE
   */
  getRequiredPermission(): (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS] | null {
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

  getPermissionDescription(): string {
    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    return apiLevel >= 33 ? 'READ_MEDIA_IMAGES (Android 13+)' : 'READ_EXTERNAL_STORAGE (Android 12-)';
  }

  /**
   * Checks current storage/media permission status
   */
  async checkStoragePermission(): Promise<StoragePermissionStatus> {
    if (Platform.OS !== 'android') {
      return 'granted';
    }

    const permission = this.getRequiredPermission();
    if (!permission) return 'unavailable';

    try {
      const hasPermission = await PermissionsAndroid.check(permission);
      return hasPermission ? 'granted' : 'denied';
    } catch (err) {
      console.warn('[PermissionService] Error checking permission:', err);
      return 'denied';
    }
  }

  /**
   * Requests media permission with rationale dialog if needed.
   * Handles granted, denied, and permanently denied states.
   */
  async requestStoragePermission(promptSettingsIfBlocked = true): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = this.getRequiredPermission();
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
        return true;
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        if (promptSettingsIfBlocked) {
          this.showBlockedPermissionDialog();
        }
        return false;
      } else {
        return false;
      }
    } catch (err) {
      console.error('[PermissionService] Error requesting permission:', err);
      return false;
    }
  }

  showBlockedPermissionDialog() {
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

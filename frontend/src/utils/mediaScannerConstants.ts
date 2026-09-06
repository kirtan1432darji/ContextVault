export enum DeviceMediaType {
  camera = 'camera',
  screenshot = 'screenshot',
  screenRecording = 'screenRecording',
  download = 'download',
  whatsappImage = 'whatsappImage',
  whatsappStatus = 'whatsappStatus',
  telegramImage = 'telegramImage',
  other = 'other',
}

export const MediaScannerConstants = {
  // OEM-specific screenshot directories on Android
  screenshotPaths: [
    '/storage/emulated/0/Pictures/Screenshots',
    '/storage/emulated/0/DCIM/Screenshots',
    '/storage/emulated/0/Pictures/ScreenShots',
    '/storage/emulated/0/Screenshots',
  ],

  // Screen recording paths
  screenRecordingPaths: [
    '/storage/emulated/0/Movies/ScreenRecords',
    '/storage/emulated/0/DCIM/ScreenRecorder',
    '/storage/emulated/0/Movies/Screen recordings',
    '/storage/emulated/0/DCIM/Screen recordings',
  ],

  // Common download paths
  downloadPaths: [
    '/storage/emulated/0/Download',
    '/storage/emulated/0/Downloads',
  ],

  // WhatsApp & Telegram media paths
  whatsappImagePaths: [
    '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images',
    '/storage/emulated/0/WhatsApp/Media/WhatsApp Images',
  ],
  telegramImagePaths: [
    '/storage/emulated/0/Android/media/org.telegram.messenger/Telegram/Telegram Images',
    '/storage/emulated/0/Telegram/Telegram Images',
  ],

  supportedImageExtensions: new Set([
    'jpg',
    'jpeg',
    'png',
    'webp',
    'heic',
    'heif',
    'gif',
    'bmp',
  ]),

  supportedVideoExtensions: new Set([
    'mp4',
    'mov',
    'mkv',
    'webm',
    '3gp',
  ]),

  isImageExtension(ext: string): boolean {
    return MediaScannerConstants.supportedImageExtensions.has(
      ext.toLowerCase().replace('.', '')
    );
  },

  isVideoExtension(ext: string): boolean {
    return MediaScannerConstants.supportedVideoExtensions.has(
      ext.toLowerCase().replace('.', '')
    );
  },
};

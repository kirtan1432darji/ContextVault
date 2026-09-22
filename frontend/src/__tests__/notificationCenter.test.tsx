jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(() => 'light'),
    StyleSheet: {
      create: (styles: any) => styles,
      hairlineWidth: 1,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android ?? obj.default,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 400, height: 800 })),
    },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    FlatList: 'FlatList',
    Alert: { alert: jest.fn() },
  };
});

jest.mock('../theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E5E7EB',
      primary: '#1A73E8',
      secondary: '#5F6368',
      accent: '#188038',
      success: '#188038',
      warning: '#F29900',
      error: '#D93025',
      textPrimary: '#202124',
      textSecondary: '#5F6368',
      textMuted: '#80868B',
    },
  }),
}));

import { notificationService } from '../services/notificationService';
import { useNotificationStore } from '../store/notification.store';
import { StorageService } from '../utils/storage';

describe('ContextVault Sprint P1-3 — Notification Center Suite', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  describe('1. OCR Complete Notification Deliverable', () => {
    it('creates an OCR notification in store with extracted word counts and filename', async () => {
      await notificationService.notifyOCRCompleted('invoice_august.png', 142);

      const items = useNotificationStore.getState().notifications;
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('ocr');
      expect(items[0].title).toBe('OCR Text Extracted');
      expect(items[0].body).toContain('invoice_august.png');
      expect(items[0].body).toContain('142 words');
      expect(items[0].isRead).toBe(false);
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });
  });

  describe('2. AI Sync Notification Deliverable', () => {
    it('creates an AI Sync notification when folder metadata is synchronized', async () => {
      await notificationService.notifyAISyncCompleted('Finance', 8);

      const items = useNotificationStore.getState().notifications;
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('sync');
      expect(items[0].title).toBe('AI Sync Completed');
      expect(items[0].body).toContain('Finance');
      expect(items[0].body).toContain('8 entities');
      expect(items[0].targetScreen).toBe('FolderDetail');
    });
  });

  describe('3. Needs Review Notification Deliverable', () => {
    it('creates a Needs Review notification for low confidence screenshots', async () => {
      await notificationService.notifyPendingReview(3);

      const items = useNotificationStore.getState().notifications;
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('review');
      expect(items[0].title).toBe('Needs Review');
      expect(items[0].body).toContain('3 screenshots');
      expect(items[0].targetScreen).toBe('Dashboard');
    });

    it('ignores non-positive review counts', async () => {
      await notificationService.notifyPendingReview(0);
      expect(useNotificationStore.getState().notifications.length).toBe(0);
    });
  });

  describe('4. Context Generated Notification Deliverable', () => {
    it('creates a Context Generated notification when living folder context is created', async () => {
      await notificationService.notifyContextGenerated(
        'Projects',
        'NHDC Q3 sprint roadmap and salary payout milestones summarized.'
      );

      const items = useNotificationStore.getState().notifications;
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('context');
      expect(items[0].title).toBe('Folder Context Generated');
      expect(items[0].body).toContain('NHDC Q3 sprint roadmap');
      expect(items[0].targetScreen).toBe('FolderContext');
    });
  });

  describe('5. Notification Center State & MMKV Persistence', () => {
    it('tracks unread counter accurately and marks single notification as read', async () => {
      await notificationService.notifyOCRCompleted('shot1.png', 50);
      await notificationService.notifyAISyncCompleted('Work', 3);

      expect(useNotificationStore.getState().unreadCount).toBe(2);

      const firstId = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markAsRead(firstId);

      expect(useNotificationStore.getState().unreadCount).toBe(1);
      expect(useNotificationStore.getState().notifications[0].isRead).toBe(true);
      expect(useNotificationStore.getState().notifications[1].isRead).toBe(false);
    });

    it('marks all notifications as read', async () => {
      await notificationService.notifyOCRCompleted('shot1.png', 50);
      await notificationService.notifyAISyncCompleted('Work', 3);
      await notificationService.notifyPendingReview(2);

      expect(useNotificationStore.getState().unreadCount).toBe(3);

      useNotificationStore.getState().markAllAsRead();

      expect(useNotificationStore.getState().unreadCount).toBe(0);
      expect(useNotificationStore.getState().notifications.every((n) => n.isRead)).toBe(true);
    });

    it('deletes single notification and clears all notifications', async () => {
      await notificationService.notifyOCRCompleted('shot1.png', 50);
      await notificationService.notifyAISyncCompleted('Work', 3);

      const notifs = useNotificationStore.getState().notifications;
      useNotificationStore.getState().deleteNotification(notifs[0].id);

      expect(useNotificationStore.getState().notifications.length).toBe(1);

      useNotificationStore.getState().clearAll();
      expect(useNotificationStore.getState().notifications.length).toBe(0);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });
});

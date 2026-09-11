import { create } from 'zustand';
import { VaultNotificationItem, NotificationType } from '../models/notification.model';
import { StorageService, StorageKeys } from '../utils/storage';

interface NotificationState {
  notifications: VaultNotificationItem[];
  unreadCount: number;

  // Actions
  addNotification: (
    item: Omit<VaultNotificationItem, 'id' | 'timestamp' | 'isRead'>
  ) => VaultNotificationItem;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  loadNotifications: () => void;
}

const loadInitialNotifications = (): VaultNotificationItem[] => {
  const stored = StorageService.getObject<VaultNotificationItem[]>(
    StorageKeys.NOTIFICATIONS
  );
  return stored || [];
};

export const useNotificationStore = create<NotificationState>((set, get) => {
  const initial = loadInitialNotifications();
  const initialUnread = initial.filter((n) => !n.isRead).length;

  return {
    notifications: initial,
    unreadCount: initialUnread,

    addNotification: (item) => {
      const newNotification: VaultNotificationItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        isRead: false,
        ...item,
      };

      const updated = [newNotification, ...get().notifications].slice(0, 100);
      const unreadCount = updated.filter((n) => !n.isRead).length;

      StorageService.setObject(StorageKeys.NOTIFICATIONS, updated);
      set({ notifications: updated, unreadCount });
      return newNotification;
    },

    markAsRead: (id: string) => {
      const updated = get().notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      const unreadCount = updated.filter((n) => !n.isRead).length;

      StorageService.setObject(StorageKeys.NOTIFICATIONS, updated);
      set({ notifications: updated, unreadCount });
    },

    markAllAsRead: () => {
      const updated = get().notifications.map((n) => ({ ...n, isRead: true }));
      StorageService.setObject(StorageKeys.NOTIFICATIONS, updated);
      set({ notifications: updated, unreadCount: 0 });
    },

    deleteNotification: (id: string) => {
      const updated = get().notifications.filter((n) => n.id !== id);
      const unreadCount = updated.filter((n) => !n.isRead).length;

      StorageService.setObject(StorageKeys.NOTIFICATIONS, updated);
      set({ notifications: updated, unreadCount });
    },

    clearAll: () => {
      StorageService.setObject(StorageKeys.NOTIFICATIONS, []);
      set({ notifications: [], unreadCount: 0 });
    },

    loadNotifications: () => {
      const stored = loadInitialNotifications();
      const unreadCount = stored.filter((n) => !n.isRead).length;
      set({ notifications: stored, unreadCount });
    },
  };
});

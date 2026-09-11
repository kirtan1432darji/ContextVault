export type NotificationType =
  | 'ocr'
  | 'sync'
  | 'review'
  | 'context'
  | 'screenshot';

export interface VaultNotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  targetScreen?: string;
  targetParams?: Record<string, any>;
}

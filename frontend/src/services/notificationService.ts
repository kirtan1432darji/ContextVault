export class NotificationService {
  async showScreenshotOrganizedNotification({
    categoryName,
    subcategory,
    fileName,
  }: {
    categoryName: string;
    subcategory?: string;
    fileName: string;
  }): Promise<void> {
    const title = 'ContextVault';
    const sub = subcategory && subcategory !== 'General' ? ` / ${subcategory}` : '';
    const body = `"${fileName}" organized into ${categoryName}${sub}`;
    // In React Native native bridges, invokes local push notification
    console.log(`[Notification] ${title}: ${body}`);
  }
}

export const notificationService = new NotificationService();

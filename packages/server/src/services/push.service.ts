import webPush from 'web-push';
import { User } from '../models/User.js';

export class PushService {
  private configured = false;

  configure(vapidPublicKey: string, vapidPrivateKey: string, contact: string): void {
    webPush.setVapidDetails(contact, vapidPublicKey, vapidPrivateKey);
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async subscribe(userId: string, subscription: any): Promise<void> {
    await User.findByIdAndUpdate(userId, { pushSubscription: subscription });
  }

  async unsubscribe(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: 1 } });
  }

  async sendNotification(
    userId: string,
    payload: { title: string; body: string; url?: string },
  ): Promise<boolean> {
    if (!this.configured) return false;
    const user = await User.findById(userId);
    if (!user || !(user as any).pushSubscription) return false;
    try {
      await webPush.sendNotification(
        (user as any).pushSubscription,
        JSON.stringify(payload),
      );
      return true;
    } catch {
      return false;
    }
  }

  async sendBulk(
    userIds: string[],
    payload: { title: string; body: string; url?: string },
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const userId of userIds) {
      const success = await this.sendNotification(userId, payload);
      if (success) sent++;
      else failed++;
    }
    return { sent, failed };
  }
}

export const pushService = new PushService();

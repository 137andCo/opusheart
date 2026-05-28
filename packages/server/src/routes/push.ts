import { Router } from 'express';
import { pushService } from '../services/push.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function pushRoutes(config: AppConfig): Router {
  const router = Router();

  // Public: return VAPID public key so clients can subscribe
  router.get('/vapid-public-key', (_req, res) => {
    const key = process.env['VAPID_PUBLIC_KEY'] || '';
    if (!key) {
      return res.status(503).json({ error: { message: 'Push notifications not configured', code: 'PUSH_NOT_CONFIGURED' } });
    }
    res.json({ vapidPublicKey: key });
  });

  // Auth required for subscribe/unsubscribe
  router.use(authenticate(config));

  // Subscribe to push notifications
  router.post('/subscribe', async (req, res) => {
    try {
      const { subscription } = req.body;
      // Validate W3C Push API subscription structure
      if (
        !subscription ||
        typeof subscription.endpoint !== 'string' ||
        !subscription.endpoint.startsWith('https://') ||
        subscription.endpoint.length > 2048 ||
        !subscription.keys ||
        typeof subscription.keys.p256dh !== 'string' ||
        typeof subscription.keys.auth !== 'string' ||
        !subscription.keys.p256dh ||
        !subscription.keys.auth
      ) {
        throw new AppError('Invalid push subscription: must include endpoint (https), keys.p256dh, and keys.auth', 400, 'INVALID_SUBSCRIPTION');
      }
      // Only pass validated fields to prevent prototype pollution / extra field injection
      const sanitizedSub = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      };
      await pushService.subscribe(req.user!.id, sanitizedSub);
      res.json({ message: 'Subscribed to push notifications' });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Unsubscribe from push notifications
  router.post('/unsubscribe', async (req, res) => {
    try {
      await pushService.unsubscribe(req.user!.id);
      res.json({ message: 'Unsubscribed from push notifications' });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

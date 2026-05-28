import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { privacyService } from '../services/privacy.service.js';
import { audit } from '../services/auditContext.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function privacyRoutes(config: AppConfig): Router {
  const router = Router();

  // All privacy routes require authentication
  router.use(authenticate(config));

  // GET /api/privacy/export — GDPR data export (Article 20)
  router.get('/export', async (req, res) => {
    try {
      const data = await privacyService.exportUserData(req.user!.id);
      await audit(req, { action: 'privacy.export', target: 'user', targetId: req.user!.id });
      res.json(data);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // DELETE /api/privacy/account — GDPR right to erasure (Article 17)
  router.delete('/account', async (req, res) => {
    try {
      // Audit BEFORE deletion so the actor can still be resolved.
      await audit(req, { action: 'privacy.account_deleted', target: 'user', targetId: req.user!.id });
      await privacyService.deleteUserData(req.user!.id);
      res.clearCookie('refreshToken', { path: '/api/auth' });
      res.json({ message: 'Account and all personal data deleted', deletedAt: new Date().toISOString() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  return router;
}

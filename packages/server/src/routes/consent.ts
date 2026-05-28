import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { consentService } from '../services/consent.service.js';
import { CONSENT_TYPES } from '../models/ConsentRecord.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

const recordConsentSchema = z.object({
  type: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
});

export function consentRoutes(config: AppConfig): Router {
  const router = Router();
  router.use(authenticate(config));

  // GET /api/consent — own consent history (newest first)
  router.get('/', async (req, res) => {
    try {
      const records = await consentService.history(req.user!.id);
      res.json({ records: records.map(r => r.toJSON()) });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/consent — explicitly record a consent decision for self
  router.post('/', validate(recordConsentSchema), async (req, res) => {
    try {
      const record = await consentService.record(req.user!.id, req.body.type, req.body.granted, 'self-service', req.ip);
      res.status(201).json({ record: record.toJSON() });
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

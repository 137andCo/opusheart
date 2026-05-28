import { Router } from 'express';
import {
  createCareNoteSchema,
  updateCareNoteSchema,
  careNoteQuerySchema,
} from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { featureGate } from '../middleware/featureGate.js';
import { CareService } from '../services/care.service.js';
import { audit } from '../services/auditContext.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function careRoutes(config: AppConfig): Router {
  const router = Router();
  const careService = new CareService(config);

  // All care routes require auth + feature gate + pastor/admin
  router.use(authenticate(config));
  router.use(featureGate('memberCare', config));
  router.use(authorize('pastor', 'admin'));

  // GET /api/care/:memberId — list care notes for a member
  router.get('/:memberId', validate(careNoteQuerySchema, 'query'), async (req, res) => {
    try {
      const memberId = req.params['memberId'] as string;
      const result = await careService.findByMember(memberId, req.query as any);
      // Audit access to special-category pastoral care data (read access).
      await audit(req, { action: 'care.viewed', target: 'member', targetId: memberId });
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/care — create care note
  router.post('/', validate(createCareNoteSchema), async (req, res) => {
    try {
      const note = await careService.create(req.body, req.user!.id);
      res.status(201).json({ careNote: note.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PUT /api/care/:id — update care note
  router.put('/:id', validate(updateCareNoteSchema), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const note = await careService.update(id, req.body, req.user!.id, req.user!.role);
      res.json({ careNote: note.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PATCH /api/care/:id/resolve — resolve care note
  router.patch('/:id/resolve', async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const note = await careService.resolve(id, req.user!.id, req.user!.role);
      res.json({ careNote: note.toJSON() });
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

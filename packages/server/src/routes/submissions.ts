import { Router } from 'express';
import { submissionQuerySchema, rejectSubmissionSchema } from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { featureGate } from '../middleware/featureGate.js';
import { SubmissionService } from '../services/submission.service.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function submissionRoutes(config: AppConfig): Router {
  const router = Router();
  const submissionService = new SubmissionService();

  // All submission management routes require auth + feature gate
  router.use(authenticate(config));
  router.use(featureGate('resourceHub', config));

  // GET /api/submissions — list submissions (admin/pastor)
  router.get('/', authorize('pastor', 'admin'), validate(submissionQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await submissionService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PATCH /api/submissions/:id/approve — approve submission (admin/pastor)
  router.patch('/:id/approve', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const submission = await submissionService.approve(id, req.user!.id);
      res.json({ submission: submission.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PATCH /api/submissions/:id/reject — reject submission (admin/pastor)
  router.patch('/:id/reject', authorize('pastor', 'admin'), validate(rejectSubmissionSchema), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const submission = await submissionService.reject(id, req.user!.id, req.body.notes);
      res.json({ submission: submission.toJSON() });
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

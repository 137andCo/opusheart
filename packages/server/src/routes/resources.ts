import { Router } from 'express';
import {
  createResourceSchema,
  updateResourceSchema,
  resourceQuerySchema,
} from '@opusheart/shared';
import {
  submitResourceSchema,
  nearbyQuerySchema,
} from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { featureGate } from '../middleware/featureGate.js';
import { ResourceService } from '../services/resource.service.js';
import { SubmissionService } from '../services/submission.service.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function resourceRoutes(config: AppConfig): Router {
  const router = Router();
  const resourceService = new ResourceService();
  const submissionService = new SubmissionService();

  // ─── Public routes (no auth, always available) ─────────────────────

  // GET /api/resources/public/featured — featured resources
  // Must be before :id route to avoid treating "public" as an ID
  router.get('/public/featured', async (_req, res) => {
    try {
      const resources = await resourceService.findFeatured();
      res.json({ resources: resources.map(r => r.toJSON()) });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/resources/public/nearby — nearby resources
  router.get('/public/nearby', validate(nearbyQuerySchema, 'query'), async (req, res) => {
    try {
      const query = req.query as any;
      const result = await resourceService.findNearby(
        query.lat,
        query.lng,
        query.maxKm,
        { category: query.category, page: query.page, limit: query.limit }
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/resources/public — list approved resources
  router.get('/public', validate(resourceQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await resourceService.findPublic(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/resources/public/:id — get approved resource
  router.get('/public/:id', async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const resource = await resourceService.findById(id);
      if (!resource.approved) {
        res.status(404).json({ error: { message: 'Resource not found', code: 'RESOURCE_NOT_FOUND' } });
        return;
      }
      res.json({ resource: resource.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/resources/public/submit — submit community resource (moderation queue)
  router.post('/public/submit', validate(submitResourceSchema), async (req, res) => {
    try {
      const { submitterName, submitterEmail, ...resourceData } = req.body;
      const submission = await submissionService.submit(resourceData, {
        submitterName,
        submitterEmail,
      });
      res.status(201).json({ submission: submission.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // ─── Admin routes (auth required, feature-gated) ──────────────────

  router.use(authenticate(config));
  router.use(featureGate('resourceHub', config));

  // GET /api/resources — list all resources (admin/pastor)
  router.get('/', authorize('pastor', 'admin'), validate(resourceQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await resourceService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/resources — create resource directly (admin/pastor, auto-approved)
  router.post('/', authorize('pastor', 'admin'), validate(createResourceSchema), async (req, res) => {
    try {
      const resource = await resourceService.create(req.body, req.user!.id);
      res.status(201).json({ resource: resource.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/resources/:id — get any resource (admin/pastor)
  router.get('/:id', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const resource = await resourceService.findById(id);
      res.json({ resource: resource.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PUT /api/resources/:id — update resource (admin/pastor)
  router.put('/:id', authorize('pastor', 'admin'), validate(updateResourceSchema), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const resource = await resourceService.update(id, req.body, req.user!.id);
      res.json({ resource: resource.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // DELETE /api/resources/:id — delete resource (admin only)
  router.delete('/:id', authorize('admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      await resourceService.delete(id);
      res.json({ message: 'Resource deleted' });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PATCH /api/resources/:id/verify — mark resource as re-verified
  router.patch('/:id/verify', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const resource = await resourceService.verify(id, req.user!.id);
      res.json({ resource: resource.toJSON() });
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

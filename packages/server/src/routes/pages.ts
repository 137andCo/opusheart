import { Router } from 'express';
import {
  createPageSchema,
  updatePageSchema,
  pageQuerySchema,
} from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { PageService } from '../services/page.service.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function pageRoutes(config: AppConfig): Router {
  const router = Router();
  const pageService = new PageService();

  // Public route — get published page by slug (no auth)
  router.get('/slug/:slug', async (req, res) => {
    try {
      const slug = req.params['slug'] as string;
      const page = await pageService.findBySlug(slug);
      res.json({ page: page.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // All remaining routes require authentication
  router.use(authenticate(config));

  // GET /api/pages — list pages (admin/pastor/leader)
  router.get('/', authorize('leader', 'pastor', 'admin'), validate(pageQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await pageService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/pages — create page (admin/pastor)
  router.post('/', authorize('pastor', 'admin'), validate(createPageSchema), async (req, res) => {
    try {
      const page = await pageService.create(req.body, req.user!.id);
      res.status(201).json({ page: page.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/pages/:id — get page (editor endpoint: returns drafts/archived too,
  // so it must be staff-only; the public reads published pages via /slug/:slug)
  router.get('/:id', authorize('leader', 'pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const page = await pageService.findById(id);
      res.json({ page: page.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PUT /api/pages/:id — update page (admin/pastor)
  router.put('/:id', authorize('pastor', 'admin'), validate(updatePageSchema), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const page = await pageService.update(id, req.body, req.user!.id);
      res.json({ page: page.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // DELETE /api/pages/:id — archive page (admin/pastor)
  router.delete('/:id', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      await pageService.delete(id);
      res.json({ message: 'Page archived' });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/pages/:id/publish — publish page (admin/pastor)
  router.post('/:id/publish', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const page = await pageService.publish(id, req.user!.id);
      res.json({ page: page.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/pages/:id/duplicate — duplicate page (admin/pastor)
  router.post('/:id/duplicate', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const page = await pageService.duplicate(id, req.user!.id);
      res.status(201).json({ page: page.toJSON() });
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

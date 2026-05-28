import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { TemplateService } from '../services/template.service.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  vertical: z.string().min(1).max(50).optional(),
  category: z.string().min(1).max(50).optional(),
  content: z.array(z.any()).optional(),
});

const templateQuerySchema = z.object({
  vertical: z.string().min(1).max(50).optional(),
});

export function templateRoutes(config: AppConfig): Router {
  const router = Router();
  const templateService = new TemplateService();

  // All template routes require authentication
  router.use(authenticate(config));

  // GET /api/templates — list templates
  router.get('/', validate(templateQuerySchema, 'query'), async (req, res) => {
    try {
      const vertical = (req.query as any).vertical as string | undefined;
      const templates = await templateService.findAll(vertical);
      res.json({ templates: templates.map(t => t.toJSON()) });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/templates/:id — get template
  router.get('/:id', async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const template = await templateService.findById(id);
      res.json({ template: template.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/templates — create template (admin only)
  router.post('/', authorize('admin'), validate(createTemplateSchema, 'body'), async (req, res) => {
    try {
      const template = await templateService.create(req.body);
      res.status(201).json({ template: template.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/templates/:id/instantiate — create page from template
  router.post('/:id/instantiate', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const templateId = req.params['id'] as string;
      const page = await templateService.createPageFromTemplate(
        templateId,
        req.body,
        req.user!.id
      );
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

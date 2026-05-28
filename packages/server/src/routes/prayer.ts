import { Router } from 'express';
import { prayerService } from '../services/prayer.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createPrayerSchema, updatePrayerSchema, prayerQuerySchema } from '@opusheart/shared/schemas/prayer.schema.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function prayerRoutes(config: AppConfig): Router {
  const router = Router();

  // Public prayer wall (no auth required)
  router.get('/wall', validate(prayerQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await prayerService.findCongregation(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Auth'd routes
  router.use(authenticate(config));

  // List prayer requests (pastor/admin see all, others see congregation)
  router.get('/', validate(prayerQuerySchema, 'query'), async (req, res) => {
    try {
      const role = req.user!.role;
      const result = role === 'pastor' || role === 'admin'
        ? await prayerService.findForPastor(req.query as any)
        : await prayerService.findCongregation(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // My prayer requests
  router.get('/mine', validate(prayerQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await prayerService.findMine(req.user!.id, req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Get single prayer request (owner or pastor/admin)
  router.get('/:id', async (req, res) => {
    try {
      const request = await prayerService.findById(req.params['id']! as string);
      const isOwner = request.submittedBy?.toString() === req.user!.id;
      const isPastorOrAdmin = req.user!.role === 'pastor' || req.user!.role === 'admin';

      // pastor_only requests: only visible to owner and pastor/admin
      if (request.visibility === 'pastor_only' && !isOwner && !isPastorOrAdmin) {
        throw new AppError('Prayer request not found', 404, 'PRAYER_NOT_FOUND');
      }

      const json = request.toJSON();
      // Strip submittedBy for anonymous requests unless pastor/admin
      if (json.anonymous && !isPastorOrAdmin) {
        delete json.submittedBy;
      }
      res.json({ prayerRequest: json });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create prayer request
  router.post('/', validate(createPrayerSchema, 'body'), async (req, res) => {
    try {
      const request = await prayerService.create(req.body, req.user!.id);
      res.status(201).json({ prayerRequest: request.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Update prayer request (owner or pastor/admin only)
  router.put('/:id', validate(updatePrayerSchema, 'body'), async (req, res) => {
    try {
      const request = await prayerService.findById(req.params['id']! as string);
      const isOwner = request.submittedBy?.toString() === req.user!.id;
      const isPastorOrAdmin = req.user!.role === 'pastor' || req.user!.role === 'admin';
      if (!isOwner && !isPastorOrAdmin) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }
      const updated = await prayerService.update(req.params['id']! as string, req.body);
      res.json({ prayerRequest: updated.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Delete prayer request (owner or pastor/admin only)
  router.delete('/:id', async (req, res) => {
    try {
      const request = await prayerService.findById(req.params['id']! as string);
      const isOwner = request.submittedBy?.toString() === req.user!.id;
      const isPastorOrAdmin = req.user!.role === 'pastor' || req.user!.role === 'admin';
      if (!isOwner && !isPastorOrAdmin) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }
      await prayerService.delete(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Pray for a request
  router.post('/:id/pray', async (req, res) => {
    try {
      const response = await prayerService.pray(req.params['id']! as string, req.user!.id);
      res.status(201).json({ prayerResponse: response.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Respond with message (validate message body)
  router.post('/:id/respond', async (req, res) => {
    try {
      const message = req.body.message;
      if (!message || typeof message !== 'string' || message.length > 5000) {
        throw new AppError('Message is required and must be under 5000 characters', 400, 'VALIDATION_ERROR');
      }
      const response = await prayerService.respond(req.params['id']! as string, req.user!.id, message.trim());
      res.status(201).json({ prayerResponse: response.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // List responses for a prayer request
  router.get('/:id/responses', async (req, res) => {
    try {
      const responses = await prayerService.findResponses(req.params['id']! as string);
      res.json({ responses: responses.map(r => r.toJSON()) });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

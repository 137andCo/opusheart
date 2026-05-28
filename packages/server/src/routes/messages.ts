import { Router } from 'express';
import { messageService } from '../services/message.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { featureGate } from '../middleware/featureGate.js';
import { validate } from '../middleware/validate.js';
import { createMessageSchema, updateMessageSchema, messageQuerySchema } from '@opusheart/shared/schemas/communication.schema.js';
import { AppError } from '../utils/errors.js';
import { authorize } from '../middleware/authorize.js';
import type { AppConfig } from '../config/index.js';

export function messageRoutes(config: AppConfig): Router {
  const router = Router();

  router.use(authenticate(config));
  router.use(featureGate('communication', config));
  // Messages are admin/pastor-only — regular members should not read/create/send broadcasts
  router.use(authorize('pastor', 'admin'));

  // List messages
  router.get('/', validate(messageQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await messageService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Get single message
  router.get('/:id', async (req, res) => {
    try {
      const message = await messageService.findById(req.params['id']! as string);
      res.json({ message: message.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create message
  router.post('/', validate(createMessageSchema, 'body'), async (req, res) => {
    try {
      const message = await messageService.create(req.body, (req as any).user.id);
      res.status(201).json({ message: message.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Update message
  router.put('/:id', validate(updateMessageSchema, 'body'), async (req, res) => {
    try {
      const message = await messageService.update(req.params['id']! as string, req.body);
      res.json({ message: message.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Delete message
  router.delete('/:id', async (req, res) => {
    try {
      await messageService.delete(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Send message now
  router.post('/:id/send', async (req, res) => {
    try {
      const message = await messageService.send(req.params['id']! as string);
      res.json({ message: message.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Cancel scheduled message
  router.post('/:id/cancel', async (req, res) => {
    try {
      const message = await messageService.cancelScheduled(req.params['id']! as string);
      res.json({ message: message.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

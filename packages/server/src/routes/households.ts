import { Router } from 'express';
import {
  createHouseholdSchema,
  householdQuerySchema,
} from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { HouseholdService } from '../services/household.service.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function householdRoutes(config: AppConfig): Router {
  const router = Router();
  const householdService = new HouseholdService(config);

  // All routes require authentication
  router.use(authenticate(config));

  // GET /api/households — list households
  router.get('/', validate(householdQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await householdService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/households — create household (admin/pastor)
  router.post('/', authorize('pastor', 'admin'), validate(createHouseholdSchema), async (req, res) => {
    try {
      const household = await householdService.create(req.body);
      res.status(201).json({ household: household.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/households/:id — get household with members (pastor/admin only)
  router.get('/:id', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const household = await householdService.findById(id);
      res.json({ household });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/households/:id/members — add member to household
  router.post('/:id/members', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const { memberId } = req.body;
      if (!memberId || typeof memberId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(memberId)) {
        res.status(400).json({ error: { message: 'Valid memberId is required', code: 'VALIDATION_ERROR' } });
        return;
      }
      const household = await householdService.addMember(id, memberId);
      res.json({ household: household.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // DELETE /api/households/:id/members/:memberId — remove from household
  router.delete('/:id/members/:memberId', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const memberId = req.params['memberId'] as string;
      const household = await householdService.removeMember(id, memberId);
      res.json({ household: household.toJSON() });
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

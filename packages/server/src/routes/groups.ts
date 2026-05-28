import { Router } from 'express';
import { groupService } from '../services/group.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { featureGate } from '../middleware/featureGate.js';
import { validate } from '../middleware/validate.js';
import { createGroupSchema, updateGroupSchema, groupQuerySchema, addMaterialSchema } from '@opusheart/shared/schemas/group.schema.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function groupRoutes(config: AppConfig): Router {
  const router = Router();

  // Public routes (no auth required)
  router.get('/public', validate(groupQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await groupService.findPublicDirectory(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Auth'd + feature-gated routes
  router.use(authenticate(config));
  router.use(featureGate('groups', config));

  // List all groups
  router.get('/', validate(groupQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await groupService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // User's groups
  router.get('/mine', async (req, res) => {
    try {
      const groups = await groupService.findByUser((req as any).user.id);
      res.json({ groups });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Get single group
  router.get('/:id', async (req, res) => {
    try {
      const group = await groupService.findById(req.params['id']! as string);
      res.json({ group: group.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create group
  router.post('/', validate(createGroupSchema, 'body'), async (req, res) => {
    try {
      const group = await groupService.create(req.body, (req as any).user.id);
      res.status(201).json({ group: group.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Update group (leader of group or admin/pastor)
  router.put('/:id', validate(updateGroupSchema, 'body'), async (req, res) => {
    try {
      const group = await groupService.findById(req.params['id']! as string);
      const userId = (req as any).user.id;
      const isLeader = group.members.some(m => m.userId.toString() === userId && m.role === 'leader');
      const isAdminOrPastor = req.user!.role === 'admin' || req.user!.role === 'pastor';
      if (!isLeader && !isAdminOrPastor) {
        throw new AppError('Only group leaders or admins can update groups', 403, 'FORBIDDEN');
      }
      const updated = await groupService.update(req.params['id']! as string, req.body);
      res.json({ group: updated.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Delete group (leader of group or admin/pastor)
  router.delete('/:id', async (req, res) => {
    try {
      const group = await groupService.findById(req.params['id']! as string);
      const userId = (req as any).user.id;
      const isLeader = group.members.some(m => m.userId.toString() === userId && m.role === 'leader');
      const isAdminOrPastor = req.user!.role === 'admin' || req.user!.role === 'pastor';
      if (!isLeader && !isAdminOrPastor) {
        throw new AppError('Only group leaders or admins can delete groups', 403, 'FORBIDDEN');
      }
      await groupService.delete(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Join group
  router.post('/:id/join', async (req, res) => {
    try {
      const group = await groupService.join(req.params['id']! as string, (req as any).user.id);
      res.json({ group: group.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Leave group
  router.post('/:id/leave', async (req, res) => {
    try {
      const group = await groupService.leave(req.params['id']! as string, (req as any).user.id);
      res.json({ group: group.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Invite user (leader or admin/pastor only)
  router.post('/:id/invite/:userId', async (req, res) => {
    try {
      const group = await groupService.findById(req.params['id']! as string);
      const userId = (req as any).user.id;
      const isLeader = group.members.some(m => m.userId.toString() === userId && m.role === 'leader');
      const isAdminOrPastor = req.user!.role === 'admin' || req.user!.role === 'pastor';
      if (!isLeader && !isAdminOrPastor) {
        throw new AppError('Only group leaders or admins can invite', 403, 'FORBIDDEN');
      }
      const updated = await groupService.invite(req.params['id']! as string, req.params['userId']! as string);
      res.json({ group: updated.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Promote to leader (leader or admin/pastor only)
  router.patch('/:id/promote/:userId', async (req, res) => {
    try {
      const group = await groupService.findById(req.params['id']! as string);
      const userId = (req as any).user.id;
      const isLeader = group.members.some(m => m.userId.toString() === userId && m.role === 'leader');
      const isAdminOrPastor = req.user!.role === 'admin' || req.user!.role === 'pastor';
      if (!isLeader && !isAdminOrPastor) {
        throw new AppError('Only group leaders or admins can promote members', 403, 'FORBIDDEN');
      }
      const updated = await groupService.promoteMember(req.params['id']! as string, req.params['userId']! as string);
      res.json({ group: updated.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Add material (leader or admin/pastor only)
  router.post('/:id/materials', validate(addMaterialSchema, 'body'), async (req, res) => {
    try {
      const group = await groupService.findById(req.params['id']! as string);
      const userId = (req as any).user.id;
      const isLeader = group.members.some(m => m.userId.toString() === userId && m.role === 'leader');
      const isAdminOrPastor = req.user!.role === 'admin' || req.user!.role === 'pastor';
      if (!isLeader && !isAdminOrPastor) {
        throw new AppError('Only group leaders or admins can add materials', 403, 'FORBIDDEN');
      }
      const updated = await groupService.addMaterial(req.params['id']! as string, req.body, userId);
      res.status(201).json({ group: updated.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Remove material (leader or admin/pastor only)
  router.delete('/:id/materials/:materialId', async (req, res) => {
    try {
      const group = await groupService.findById(req.params['id']! as string);
      const userId = (req as any).user.id;
      const isLeader = group.members.some(m => m.userId.toString() === userId && m.role === 'leader');
      const isAdminOrPastor = req.user!.role === 'admin' || req.user!.role === 'pastor';
      if (!isLeader && !isAdminOrPastor) {
        throw new AppError('Only group leaders or admins can remove materials', 403, 'FORBIDDEN');
      }
      const updated = await groupService.removeMaterial(req.params['id']! as string, req.params['materialId']! as string);
      res.json({ group: updated.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

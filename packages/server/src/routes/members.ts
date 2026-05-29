import { Router } from 'express';
import {
  createMemberSchema,
  updateMemberSchema,
  memberQuerySchema,
  assignRoleSchema,
} from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { MemberService } from '../services/member.service.js';
import { audit } from '../services/auditContext.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function memberRoutes(config: AppConfig): Router {
  const router = Router();
  const memberService = new MemberService(config);

  // All routes require authentication
  router.use(authenticate(config));

  // GET /api/members — list members (paginated, privacy-filtered)
  router.get('/', validate(memberQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await memberService.findAll(req.query as any, req.user!.role);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/members — create member (admin/pastor)
  router.post('/', authorize('pastor', 'admin'), validate(createMemberSchema), async (req, res) => {
    try {
      const member = await memberService.create(req.body);
      res.status(201).json({ member: member.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // GET /api/members/:id — get member (privacy-filtered in the service layer)
  router.get('/:id', async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const member = await memberService.findByIdForViewer(id, { id: req.user!.id, role: req.user!.role });
      res.json({ member });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PUT /api/members/:id — update member (admin/pastor or self)
  router.put('/:id', validate(updateMemberSchema), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const isPastorOrAdmin = req.user!.role === 'pastor' || req.user!.role === 'admin';

      // Check if user is updating their own member record
      if (!isPastorOrAdmin) {
        const existing = await memberService.findById(id);
        const user = existing['userId'] as Record<string, unknown> | null;
        const userId = user?.['id'] || user?.['_id'];
        if (userId?.toString() !== req.user!.id) {
          res.status(403).json({ error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
          return;
        }
      }

      const member = await memberService.update(id, req.body);
      res.json({ member: member.toJSON() });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PATCH /api/members/:id/role — assign a role to the member's user account (admin only)
  router.patch('/:id/role', authorize('admin'), validate(assignRoleSchema), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      const result = await memberService.setRole(id, req.body.role);
      await audit(req, { action: 'member.role_assigned', target: 'member', targetId: id, metadata: { role: req.body.role, userId: result.userId } });
      res.json({ message: 'Role updated', ...result });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // DELETE /api/members/:id — archive member (admin only)
  router.delete('/:id', authorize('admin'), async (req, res) => {
    try {
      const id = req.params['id'] as string;
      await memberService.delete(id);
      res.json({ message: 'Member archived' });
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

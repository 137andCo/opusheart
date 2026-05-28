import { Router } from 'express';
import { updateThemeSchema } from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ThemeService } from '../services/theme.service.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function themeRoutes(config: AppConfig): Router {
  const router = Router();
  const themeService = new ThemeService();

  // GET /api/theme — public, no auth required
  router.get('/', async (_req, res) => {
    try {
      const theme = await themeService.getTheme();
      res.json({ theme });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PUT /api/theme — admin only
  router.put('/', authenticate(config), authorize('admin'), validate(updateThemeSchema), async (req, res) => {
    try {
      const theme = await themeService.updateTheme(req.body);
      res.json({ theme: theme.toJSON() });
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

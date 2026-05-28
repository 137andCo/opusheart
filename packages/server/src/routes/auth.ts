import { Router } from 'express';
import { createUserSchema, loginSchema, updateUserSchema } from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { AuthService, AppError } from '../services/auth.service.js';
import { auditByEmail } from '../services/auditContext.js';
import { User } from '../models/User.js';
import type { AppConfig } from '../config/index.js';

export function authRoutes(config: AppConfig): Router {
  const router = Router();
  const authService = new AuthService(config);

  // POST /api/auth/register
  router.post('/register', validate(createUserSchema), async (req, res) => {
    try {
      const user = await authService.register(req.body);
      await auditByEmail(req.body.email, 'visitor', req.ip, { action: 'auth.register', target: 'user', targetId: user._id.toString() });
      const tokens = await authService.generateTokens(user);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.status(201).json({
        user: user.toJSON(),
        accessToken: tokens.accessToken,
      });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/auth/login
  router.post('/login', validate(loginSchema), async (req, res) => {
    try {
      const { user, tokens } = await authService.login(
        req.body.email,
        req.body.password,
        req.body.mfaCode,
      );

      await auditByEmail(req.body.email, user.role, req.ip, { action: 'auth.login', target: 'user', targetId: user._id.toString() });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.json({
        user: user.toJSON(),
        accessToken: tokens.accessToken,
      });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/auth/refresh
  router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: { message: 'No refresh token', code: 'NO_TOKEN' } });
      return;
    }

    try {
      const tokens = await authService.refreshTokens(refreshToken);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.json({ accessToken: tokens.accessToken });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ message: 'Logged out' });
  });

  // GET /api/auth/me
  router.get('/me', authenticate(config), async (req, res) => {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) {
        res.status(404).json({ error: { message: 'User not found', code: 'NOT_FOUND' } });
        return;
      }
      res.json({ user: user.toJSON() });
    } catch {
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  // PUT /api/auth/me — update own profile + privacy settings (never role/email)
  router.put('/me', authenticate(config), validate(updateUserSchema), async (req, res) => {
    try {
      const user = await authService.updateProfile(req.user!.id, req.body);
      res.json({ user: user.toJSON() });
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

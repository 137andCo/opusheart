import { Router } from 'express';
import { createUserSchema, loginSchema, updateUserSchema, mfaCodeSchema, changePasswordSchema, requestPasswordResetSchema, resetPasswordSchema } from '@opusheart/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { AuthService, AppError } from '../services/auth.service.js';
import { auditByEmail } from '../services/auditContext.js';
import { consentService } from '../services/consent.service.js';
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

  // ── MFA (TOTP) ──────────────────────────────────────────

  // POST /api/auth/mfa/enroll — begin enrollment, returns otpauth URL for QR
  router.post('/mfa/enroll', authenticate(config), async (req, res) => {
    try {
      const result = await authService.beginMfaEnrollment(req.user!.id);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/auth/mfa/confirm — confirm enrollment with a code from the app
  router.post('/mfa/confirm', authenticate(config), validate(mfaCodeSchema), async (req, res) => {
    try {
      await authService.confirmMfa(req.user!.id, req.body.code);
      res.json({ message: 'MFA enabled' });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/auth/mfa/disable — disable MFA (requires a valid current code)
  router.post('/mfa/disable', authenticate(config), validate(mfaCodeSchema), async (req, res) => {
    try {
      await authService.disableMfa(req.user!.id, req.body.code);
      res.json({ message: 'MFA disabled' });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/auth/change-password — authenticated self-service change
  router.post('/change-password', authenticate(config), validate(changePasswordSchema), async (req, res) => {
    try {
      await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
      res.clearCookie('refreshToken', { path: '/api/auth' });
      res.json({ message: 'Password changed. Please sign in again.' });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // POST /api/auth/forgot-password — email a reset link (always 200, no enumeration)
  router.post('/forgot-password', validate(requestPasswordResetSchema), async (req, res) => {
    try {
      await authService.requestPasswordReset(req.body.email);
    } catch {
      // swallow — the response must not vary by whether the email exists
    }
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  });

  // POST /api/auth/reset-password — complete a reset with the emailed token
  router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    try {
      await authService.resetPassword(req.body.token, req.body.newPassword);
      res.json({ message: 'Password reset. Please sign in.' });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    }
  });

  // PUT /api/auth/me — update own profile + privacy settings (never role/email)
  router.put('/me', authenticate(config), validate(updateUserSchema), async (req, res) => {
    try {
      const user = await authService.updateProfile(req.user!.id, req.body);
      // Preserve a history of consent changes (GDPR Art. 7 accountability).
      await consentService.recordPrivacyChanges(req.user!.id, req.body.privacySettings, 'self-service', req.ip);
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

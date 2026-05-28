import type { Request, Response, NextFunction } from 'express';
import { AuthService, AppError } from '../services/auth.service.js';
import { User } from '../models/User.js';
import type { AppConfig } from '../config/index.js';

// Extend Express Request (module augmentation requires a namespace here)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}

export function authenticate(config: AppConfig) {
  const authService = new AuthService(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: { message: 'No token provided', code: 'NO_TOKEN' } });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = authService.verifyAccessToken(token);

      // Check user is still active and token hasn't been invalidated
      const user = await User.findById(payload.sub).select('tokenInvalidatedAt active').lean();
      if (!user || !user.active) {
        res.status(401).json({ error: { message: 'Authentication failed', code: 'AUTH_FAILED' } });
        return;
      }

      // Reject tokens issued before tokenInvalidatedAt (e.g., password change, forced logout)
      if (user.tokenInvalidatedAt && payload.iat) {
        const invalidatedAtSec = Math.floor(new Date(user.tokenInvalidatedAt).getTime() / 1000);
        if (payload.iat < invalidatedAtSec) {
          res.status(401).json({ error: { message: 'Authentication failed', code: 'AUTH_FAILED' } });
          return;
        }
      }

      req.user = { id: payload.sub, role: payload.role };
      next();
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      } else {
        res.status(401).json({ error: { message: 'Authentication failed', code: 'AUTH_FAILED' } });
      }
    }
  };
}

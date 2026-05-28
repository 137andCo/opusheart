import type { Request, Response, NextFunction } from 'express';
import { ROLE_HIERARCHY, type UserRole } from '@opusheart/shared';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    const userRole = req.user.role as UserRole;
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const minLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r] ?? 100));

    if (userLevel < minLevel) {
      res.status(403).json({ error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
      return;
    }

    next();
  };
}

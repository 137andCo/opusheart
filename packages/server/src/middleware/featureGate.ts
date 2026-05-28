import type { Request, Response, NextFunction } from 'express';
import { FeatureService, type FeatureKey } from '../services/features.service.js';
import type { AppConfig } from '../config/index.js';

// Returns 404 when feature is disabled — as if the route doesn't exist.
// NOT 403 — we don't want to reveal that the feature exists but is off.
export function featureGate(feature: FeatureKey, config: AppConfig) {
  const featureService = new FeatureService(config);

  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const enabled = await featureService.isEnabled(feature);
    if (!enabled) {
      res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      return;
    }
    next();
  };
}

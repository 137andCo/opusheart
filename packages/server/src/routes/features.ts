import { Router } from 'express';
import { FeatureService } from '../services/features.service.js';
import type { AppConfig } from '../config/index.js';

export function featuresRoutes(config: AppConfig): Router {
  const router = Router();
  const featureService = new FeatureService(config);

  router.get('/', async (_req, res) => {
    const features = await featureService.getAllFeatures();
    res.json({ features });
  });

  return router;
}

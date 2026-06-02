import { Router } from 'express';
import type { AppConfig } from '../config/index.js';
import { getVerticalConfig, listVerticals } from '../services/vertical.service.js';

export function verticalRoutes(config: AppConfig): Router {
  const router = Router();

  // Public: the active vertical's labels, terminology, templates, and blocks, so
  // the web and dashboard can speak the community's language (e.g. render
  // "Congregation" instead of "Members") without hard-coding church wording.
  router.get('/', (_req, res) => {
    res.json({
      vertical: getVerticalConfig(config.vertical),
      available: listVerticals(),
    });
  });

  return router;
}

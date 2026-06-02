import { Router } from 'express';
import { BLOCK_DEFINITIONS, BLOCK_TYPES } from '@opusheart/builder';

export function builderRoutes(): Router {
  const router = Router();

  // Public: the available page-builder block types + metadata, so the dashboard
  // editor can populate its "Add block" menu from one source of truth.
  router.get('/blocks', (_req, res) => {
    res.json({
      blocks: BLOCK_TYPES.map((type) => {
        const def = BLOCK_DEFINITIONS[type];
        return { type: def.type, label: def.label, description: def.description };
      }),
    });
  });

  return router;
}

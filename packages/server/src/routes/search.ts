import { Router } from 'express';
import { searchService } from '../services/search.service.js';

export function searchRoutes(): Router {
  const router = Router();

  // Public global search over the community resource directory. Backed by
  // Elasticsearch when ELASTICSEARCH_URL is set, otherwise MongoDB. The `backend`
  // field tells the caller which served the result.
  router.get('/', async (req, res) => {
    const q = String(req.query['q'] ?? '').slice(0, 200);
    const category = req.query['category'] ? String(req.query['category']).slice(0, 60) : undefined;
    const { backend, results } = await searchService.search(q, { category });
    res.json({ backend, results });
  });

  return router;
}

import { Router } from 'express';
import { sermonService } from '../services/sermon.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { featureGate } from '../middleware/featureGate.js';
import { validate } from '../middleware/validate.js';
import {
  createSermonSchema,
  updateSermonSchema,
  sermonQuerySchema,
  createSeriesSchema,
  updateSeriesSchema,
} from '@opusheart/shared/schemas/sermon.schema.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function sermonRoutes(config: AppConfig): Router {
  const router = Router();

  // ── Public routes (no auth) ────────────────────────────

  // Published sermons
  router.get('/public', validate(sermonQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await sermonService.findPublished(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Public series list (must be before /public/:id to avoid matching "series" as :id)
  router.get('/public/series', async (_req, res) => {
    try {
      const series = await sermonService.findAllSeries();
      res.json({ series: series.map(s => s.toJSON()) });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Single published sermon
  router.get('/public/:id', async (req, res) => {
    try {
      const sermon = await sermonService.findById(req.params['id']! as string);
      if (!sermon.published) {
        return res.status(404).json({ error: { message: 'Sermon not found', code: 'SERMON_NOT_FOUND' } });
      }
      res.json({ sermon: sermon.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Podcast RSS feed
  router.get('/podcast.xml', async (_req, res) => {
    try {
      const instanceName = config.instance.name;
      const instanceUrl = config.instance.url;
      const xml = await sermonService.generatePodcastFeed(instanceName, instanceUrl);
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // ── Auth + featureGate routes ──────────────────────────

  router.use(authenticate(config));
  router.use(featureGate('sermons', config));

  // List all sermons
  router.get('/', validate(sermonQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await sermonService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // ── Series CRUD (must be before /:id to avoid matching "series" as :id) ──

  // List all series
  router.get('/series', async (_req, res) => {
    try {
      const series = await sermonService.findAllSeries();
      res.json({ series: series.map(s => s.toJSON()) });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create series (pastor/admin only)
  router.post('/series', authorize('pastor', 'admin'), validate(createSeriesSchema, 'body'), async (req, res) => {
    try {
      const series = await sermonService.createSeries(req.body, req.user!.id);
      res.status(201).json({ series: series.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Update series (pastor/admin only)
  router.put('/series/:id', authorize('pastor', 'admin'), validate(updateSeriesSchema, 'body'), async (req, res) => {
    try {
      const series = await sermonService.updateSeries(req.params['id']! as string, req.body);
      res.json({ series: series.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Delete series (pastor/admin only)
  router.delete('/series/:id', authorize('pastor', 'admin'), async (req, res) => {
    try {
      await sermonService.deleteSeries(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // ── Single sermon CRUD (after /series to avoid route conflicts) ──

  // Get single sermon
  router.get('/:id', async (req, res) => {
    try {
      const sermon = await sermonService.findById(req.params['id']! as string);
      res.json({ sermon: sermon.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create sermon (pastor/admin only)
  router.post('/', authorize('pastor', 'admin'), validate(createSermonSchema, 'body'), async (req, res) => {
    try {
      const sermon = await sermonService.create(req.body, req.user!.id);
      res.status(201).json({ sermon: sermon.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Update sermon (pastor/admin only)
  router.put('/:id', authorize('pastor', 'admin'), validate(updateSermonSchema, 'body'), async (req, res) => {
    try {
      const sermon = await sermonService.update(req.params['id']! as string, req.body);
      res.json({ sermon: sermon.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Delete sermon (pastor/admin only)
  router.delete('/:id', authorize('pastor', 'admin'), async (req, res) => {
    try {
      await sermonService.delete(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

import { Router } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { featureGate } from '../middleware/featureGate.js';
import { validate } from '../middleware/validate.js';
import type { AppConfig } from '../config/index.js';

const summarizeResourceSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
});

const draftContentSchema = z.object({
  type: z.string().min(1).max(100).trim(),
  context: z.string().min(1).max(5000).trim(),
});

const categorizePrayerSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
});

const translateSchema = z.object({
  text: z.string().min(1).max(5000).trim(),
  targetLanguage: z.string().min(1).max(50).trim(),
});

const sermonSummarySchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  notes: z.string().max(10000).trim().optional(),
});

export function aiRoutes(config: AppConfig): Router {
  const router = Router();

  // All AI routes require auth + ai feature enabled
  router.use(authenticate(config));
  router.use(featureGate('ai', config));

  // POST /summarize-resource
  router.post('/summarize-resource', validate(summarizeResourceSchema, 'body'), async (req, res) => {
    try {
      const { name, description } = req.body;
      const result = await aiService.summarizeResource(name, description, req.user!.id);
      if (result === null) {
        res.status(503).json({ error: { message: 'AI service unavailable', code: 'AI_UNAVAILABLE' } });
        return;
      }
      res.json({ result });
    } catch (err) {
      console.error('[AI Route] summarize-resource error:', err);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  // POST /draft-content
  router.post('/draft-content', validate(draftContentSchema, 'body'), async (req, res) => {
    try {
      const { type, context } = req.body;
      const result = await aiService.draftContent(type, context, req.user!.id);
      if (result === null) {
        res.status(503).json({ error: { message: 'AI service unavailable', code: 'AI_UNAVAILABLE' } });
        return;
      }
      res.json({ result });
    } catch (err) {
      console.error('[AI Route] draft-content error:', err);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  // POST /categorize-prayer
  router.post('/categorize-prayer', validate(categorizePrayerSchema, 'body'), async (req, res) => {
    try {
      const { content } = req.body;
      const result = await aiService.categorizePrayer(content, req.user!.id);
      if (result === null) {
        res.status(503).json({ error: { message: 'AI service unavailable', code: 'AI_UNAVAILABLE' } });
        return;
      }
      res.json({ result });
    } catch (err) {
      console.error('[AI Route] categorize-prayer error:', err);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  // POST /translate
  router.post('/translate', validate(translateSchema, 'body'), async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;
      const result = await aiService.translateContent(text, targetLanguage, req.user!.id);
      if (result === null) {
        res.status(503).json({ error: { message: 'AI service unavailable', code: 'AI_UNAVAILABLE' } });
        return;
      }
      res.json({ result });
    } catch (err) {
      console.error('[AI Route] translate error:', err);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  // POST /sermon-summary
  router.post('/sermon-summary', validate(sermonSummarySchema, 'body'), async (req, res) => {
    try {
      const { title, description, notes } = req.body;
      const result = await aiService.generateSermonSummary(title, description, notes, req.user!.id);
      if (result === null) {
        res.status(503).json({ error: { message: 'AI service unavailable', code: 'AI_UNAVAILABLE' } });
        return;
      }
      res.json({ result });
    } catch (err) {
      console.error('[AI Route] sermon-summary error:', err);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  return router;
}

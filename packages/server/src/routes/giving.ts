import { Router } from 'express';
import { givingService } from '../services/giving.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { featureGate } from '../middleware/featureGate.js';
import { validate } from '../middleware/validate.js';
import { createDonationSchema, createFundSchema, updateFundSchema } from '@opusheart/shared/schemas/giving.schema.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function givingRoutes(config: AppConfig): Router {
  const router = Router();

  // ─── Public: active funds for giving page ────────────────
  router.get('/funds/public', async (_req, res) => {
    try {
      const funds = await givingService.findActiveFunds();
      res.json({ funds: funds.map(f => f.toJSON()) });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // ─── Auth + feature gate for all remaining routes ────────
  router.use(authenticate(config));
  router.use(featureGate('giving', config));

  // ─── Fund CRUD ───────────────────────────────────────────

  router.get('/funds', authorize('pastor', 'admin'), async (req, res) => {
    try {
      const result = await givingService.findAllFunds(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.post('/funds', authorize('admin', 'pastor'), validate(createFundSchema, 'body'), async (req, res) => {
    try {
      const fund = await givingService.createFund(req.body);
      res.status(201).json({ fund: fund.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.put('/funds/:id', authorize('admin', 'pastor'), validate(updateFundSchema, 'body'), async (req, res) => {
    try {
      const fund = await givingService.updateFund(req.params['id']! as string, req.body);
      res.json({ fund: fund.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.delete('/funds/:id', authorize('admin', 'pastor'), async (req, res) => {
    try {
      await givingService.deleteFund(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // ─── Donations ───────────────────────────────────────────

  router.post('/donations', validate(createDonationSchema, 'body'), async (req, res) => {
    try {
      const donation = await givingService.recordDonation(req.body, req.user!.id);
      res.status(201).json({ donation: donation.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.get('/donations', authorize('admin', 'pastor'), async (req, res) => {
    try {
      const result = await givingService.findDonations(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.get('/donations/mine', async (req, res) => {
    try {
      const result = await givingService.findByMember(req.user!.id, req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.get('/statements/:year', async (req, res) => {
    try {
      const year = parseInt(req.params['year']! as string, 10);
      if (isNaN(year) || year < 1900 || year > 2100) {
        res.status(400).json({ error: { message: 'Invalid year (must be 1900-2100)', code: 'INVALID_YEAR' } });
        return;
      }
      const statement = await givingService.generateStatement(req.user!.id, year);
      res.json({ statement });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.post('/donations/:id/refund', authorize('admin', 'pastor'), async (req, res) => {
    try {
      const donation = await givingService.refundDonation(req.params['id']! as string);
      res.json({ donation: donation.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

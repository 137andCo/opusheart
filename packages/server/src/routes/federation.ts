import { Router } from 'express';
import { z } from 'zod';
import { federationService } from '../services/federation.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { featureGate } from '../middleware/featureGate.js';
import { validate } from '../middleware/validate.js';
import { federationRequestSchema, emergencyBroadcastSchema, pledgeSchema } from '@opusheart/shared/schemas/connect.schema.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function federationRoutes(config: AppConfig): Router {
  const router = Router();

  // ─── Public peer-to-peer endpoints (no auth, no feature gate) ───

  const emergencyReceiveSchema = z.object({
    originInstanceId: z.string().min(1).max(500),
    originInstanceName: z.string().min(1).max(200),
    // Must match the canonical severity enum used by the model and the outbound
    // emergencyBroadcastSchema — previously ['low','medium','high','critical'],
    // which made every interop attempt fail Mongoose validation with a 500.
    severity: z.enum(['need', 'urgent', 'disaster']),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(5000),
    needs: z.array(z.object({
      type: z.string().min(1).max(100),
      description: z.string().min(1).max(1000),
      quantity: z.number().positive().optional(),
      unit: z.string().max(50).optional(),
    })).max(50),
    location: z.object({
      city: z.string().min(1).max(200),
      state: z.string().min(1).max(200),
      country: z.string().min(1).max(200),
      coordinates: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }).optional(),
    }),
    contactMethod: z.string().min(1).max(500),
    expiresAt: z.coerce.date(),
    hopCount: z.number().int().min(0).max(100),
    maxHops: z.number().int().min(1).max(100),
    signature: z.string().min(1).max(1000),
  });

  // NOTE: a generic /receive endpoint was removed. It validated a signature
  // field but performed NO verification and simply returned { received: true } —
  // a misleading no-op that advertised a capability it did not have. Typed
  // inbound endpoints (e.g. /emergency/receive) do real signature checks.

  // Receive emergency broadcast from a peer
  router.post('/emergency/receive', validate(emergencyReceiveSchema, 'body'), async (req, res) => {
    try {
      const broadcast = await federationService.receiveEmergency(req.body);
      res.status(201).json({ broadcast: broadcast.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // ─── Auth'd + feature-gated endpoints ───

  router.use(authenticate(config));
  router.use(featureGate('connect', config));

  // List peers
  router.get('/peers', async (req, res) => {
    try {
      const result = await federationService.listPeers(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Request peer connection (admin only)
  router.post('/peers', authorize('admin'), validate(federationRequestSchema, 'body'), async (req, res) => {
    try {
      const peer = await federationService.requestPeer(req.body);
      res.status(201).json({ peer: peer.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Approve peer (admin only)
  router.patch('/peers/:id/approve', authorize('admin'), async (req, res) => {
    try {
      const peer = await federationService.approvePeer(req.params['id']! as string);
      res.json({ peer: peer.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Block peer (admin only)
  router.patch('/peers/:id/block', authorize('admin'), async (req, res) => {
    try {
      const peer = await federationService.blockPeer(req.params['id']! as string);
      res.json({ peer: peer.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Remove peer (admin only)
  router.delete('/peers/:id', authorize('admin'), async (req, res) => {
    try {
      await federationService.removePeer(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create emergency broadcast (admin only)
  router.post('/emergency', authorize('admin'), validate(emergencyBroadcastSchema, 'body'), async (req, res) => {
    try {
      const broadcast = await federationService.broadcastEmergency(
        req.body,
        config.instance.url,
        config.instance.name,
      );
      res.status(201).json({ broadcast: broadcast.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // List active emergencies
  router.get('/emergency', async (req, res) => {
    try {
      const result = await federationService.listActiveEmergencies(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Pledge to a need
  router.post('/emergency/:id/pledge', validate(pledgeSchema, 'body'), async (req, res) => {
    try {
      const broadcast = await federationService.pledgeToNeed(
        req.params['id']! as string,
        {
          ...req.body,
          instanceId: config.instance.url,
          instanceName: config.instance.name,
        },
      );
      res.json({ broadcast: broadcast.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Get federation config
  router.get('/config', async (_req, res) => {
    try {
      const cfg = await federationService.getConfig();
      res.json(cfg);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Update federation config
  const updateConfigSchema = z.object({
    participationLevel: z.enum(['isolated', 'observe', 'participate', 'full']),
  });

  router.put('/config', authorize('admin'), validate(updateConfigSchema, 'body'), async (req, res) => {
    try {
      const { participationLevel } = req.body;
      const cfg = await federationService.updateConfig(participationLevel);
      res.json(cfg);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

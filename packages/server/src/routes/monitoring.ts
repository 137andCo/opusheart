import { Router } from 'express';
import mongoose from 'mongoose';

export function monitoringRoutes(): Router {
  const router = Router();
  const startTime = Date.now();

  router.get('/health', (_req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;
    const status = mongoReady ? 'ok' : 'degraded';
    res.status(mongoReady ? 200 : 503).json({
      status,
      mongo: mongoReady ? 'connected' : 'disconnected',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', async (_req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;
    const status = mongoReady ? 'ready' : 'not_ready';
    const code = mongoReady ? 200 : 503;
    res.status(code).json({
      status,
      mongo: mongoReady,
      timestamp: new Date().toISOString(),
    });
  });

  // Metrics endpoint returns only basic uptime in public mode
  // Detailed memory/heap info requires X-Monitoring-Token header
  router.get('/metrics', (req, res) => {
    const monitoringToken = process.env['MONITORING_TOKEN'];
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // Without valid token, return minimal info only
    if (!monitoringToken || req.headers['x-monitoring-token'] !== monitoringToken) {
      res.json({ uptime, timestamp: new Date().toISOString() });
      return;
    }

    const mem = process.memoryUsage();
    res.json({
      uptime,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      mongo: { readyState: mongoose.connection.readyState },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

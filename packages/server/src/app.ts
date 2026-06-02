import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { requestContextMiddleware, getRequestContext } from './middleware/requestContext.js';
import { authLimiter, apiLimiter } from './middleware/rateLimit.js';
import { validateObjectId } from './middleware/validateObjectId.js';
import { sanitizeMongo } from './middleware/sanitizeMongo.js';
import { authRoutes } from './routes/auth.js';
import { memberRoutes } from './routes/members.js';
import { householdRoutes } from './routes/households.js';
import { careRoutes } from './routes/care.js';
import { pageRoutes } from './routes/pages.js';
import { templateRoutes } from './routes/templates.js';
import { verticalRoutes } from './routes/vertical.js';
import { themeRoutes } from './routes/theme.js';
import { resourceRoutes } from './routes/resources.js';
import { submissionRoutes } from './routes/submissions.js';
import { messageRoutes } from './routes/messages.js';
import { eventRoutes } from './routes/events.js';
import { bookingRoutes } from './routes/bookings.js';
import { groupRoutes } from './routes/groups.js';
import { prayerRoutes } from './routes/prayer.js';
import { sermonRoutes } from './routes/sermons.js';
import { aiRoutes } from './routes/ai.js';
import { federationRoutes } from './routes/federation.js';
import { givingRoutes } from './routes/giving.js';
import { featuresRoutes } from './routes/features.js';
import { pushRoutes } from './routes/push.js';
import { privacyRoutes } from './routes/privacy.js';
import { consentRoutes } from './routes/consent.js';
import { pushService } from './services/push.service.js';
import { emailService } from './services/email.service.js';
import { monitoringRoutes } from './routes/monitoring.js';
import type { AppConfig } from './config/index.js';

export function createApp(config: AppConfig): express.Application {
  const app = express();

  // Behind a reverse proxy (nginx / ingress / cloud LB in every shipped topology).
  // Without this, req.ip is the proxy's IP — collapsing per-IP rate limiting into
  // one global bucket and poisoning audit/consent IP records. Operators with no
  // proxy set TRUST_PROXY=false. See config.parseTrustProxy.
  app.set('trust proxy', config.trustProxy);

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));
  app.use(cors({
    origin: config.cors.origins,
    credentials: true,
  }));

  // Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // Defense-in-depth: strip Mongo operator keys ($-prefixed / dotted) from input
  app.use(sanitizeMongo);

  // Request context (AsyncLocalStorage)
  app.use(requestContextMiddleware);

  // Logging
  const logger = pino({
    name: 'opusheart',
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    // SECURITY: never write credentials to logs. pino-http's default request
    // serializer logs all headers verbatim, which would otherwise leak the
    // Bearer access token and the refresh-token cookie on every request.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
  });
  // @ts-expect-error pino-http types don't match default export callable
  app.use(pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    customProps: () => {
      const ctx = getRequestContext();
      return ctx ? { requestId: ctx.requestId } : {};
    },
  }));

  // Rate limiting (before routes)
  if (config.nodeEnv !== 'test') {
    app.use('/api/auth', authLimiter);
    app.use('/api', apiLimiter);
  }

  // Validate ObjectId params globally (before any route handlers)
  app.use('/api', validateObjectId);

  // Auth routes
  app.use('/api/auth', authRoutes(config));

  // Member management routes
  app.use('/api/members', memberRoutes(config));
  app.use('/api/households', householdRoutes(config));
  app.use('/api/care', careRoutes(config));

  // Website builder routes
  app.use('/api/pages', pageRoutes(config));
  app.use('/api/templates', templateRoutes(config));
  app.use('/api/vertical', verticalRoutes(config));
  app.use('/api/theme', themeRoutes(config));

  // Community resource hub routes
  app.use('/api/resources', resourceRoutes(config));
  app.use('/api/submissions', submissionRoutes(config));

  // Communication routes
  app.use('/api/messages', messageRoutes(config));

  // Event routes
  app.use('/api/events', eventRoutes(config));

  // Booking routes
  app.use('/api/bookings', bookingRoutes(config));

  // Group routes
  app.use('/api/groups', groupRoutes(config));

  // Prayer routes
  app.use('/api/prayer', prayerRoutes(config));

  // Sermon routes
  app.use('/api/sermons', sermonRoutes(config));

  // AI routes
  app.use('/api/ai', aiRoutes(config));

  // Federation routes
  app.use('/api/federation', federationRoutes(config));

  // Giving routes
  app.use('/api/giving', givingRoutes(config));

  // Feature toggles (public, no auth required)
  app.use('/api/features', featuresRoutes(config));

  // Privacy / GDPR routes
  app.use('/api/privacy', privacyRoutes(config));
  app.use('/api/consent', consentRoutes(config));

  // Email transport — configured from SMTP env if present (otherwise sends are
  // skipped with a warning, so the app still boots without mail configured).
  if (process.env['SMTP_HOST']) {
    emailService.configure({
      host: process.env['SMTP_HOST'],
      port: parseInt(process.env['SMTP_PORT'] || '587', 10),
      secure: process.env['SMTP_SECURE'] === 'true' || process.env['SMTP_PORT'] === '465',
      user: process.env['SMTP_USER'] || '',
      pass: process.env['SMTP_PASS'] || '',
      from: process.env['SMTP_FROM'] || `noreply@${config.instance.url.replace(/^https?:\/\//, '')}`,
    });
  }

  // Push notification routes
  if (process.env['VAPID_PUBLIC_KEY'] && process.env['VAPID_PRIVATE_KEY']) {
    pushService.configure(
      process.env['VAPID_PUBLIC_KEY'],
      process.env['VAPID_PRIVATE_KEY'],
      process.env['VAPID_CONTACT'] || `mailto:admin@${config.instance.url}`,
    );
  }
  app.use('/api/push', pushRoutes(config));

  // Health checks & monitoring
  app.use('/', monitoringRoutes());

  // Store config on app for middleware access
  app.set('config', config);

  // Global error handler — prevent stack traces from leaking to clients
  app.use((err: any, _req: any, res: any, _next: any) => {
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;
    const code = err.code || 'INTERNAL_ERROR';
    if (statusCode === 500) {
      // Log minimal, non-PII detail — the raw error object can embed request
      // payload values (e.g. Mongoose validation / duplicate-key errors).
      logger.error({ name: err.name, message: err.message, code: err.code, stack: err.stack }, 'Unhandled error');
    }
    res.status(statusCode).json({ error: { message, code } });
  });

  return app;
}

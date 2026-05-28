import { Router } from 'express';
import { eventService } from '../services/event.service.js';
import { icalService } from '../services/ical.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createEventSchema, updateEventSchema, rsvpSchema, eventQuerySchema } from '@opusheart/shared/schemas/event.schema.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

export function eventRoutes(config: AppConfig): Router {
  const router = Router();

  // Public iCal feed (no auth required)
  router.get('/public/ical', async (_req, res) => {
    try {
      const ics = await icalService.generateCalendar({ visibility: 'public' });
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="events.ics"');
      res.send(ics);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Public routes (no auth required)
  router.get('/public', validate(eventQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await eventService.findPublic(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  router.get('/public/:id', async (req, res) => {
    try {
      const event = await eventService.findById(req.params['id']! as string);
      if (event.visibility !== 'public') {
        return res.status(404).json({ error: { message: 'Event not found', code: 'EVENT_NOT_FOUND' } });
      }
      res.json({ event: event.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Auth'd routes
  router.use(authenticate(config));

  // List all events
  router.get('/', validate(eventQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await eventService.findAll(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Get single event
  router.get('/:id', async (req, res) => {
    try {
      const event = await eventService.findById(req.params['id']! as string);
      res.json({ event: event.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create event (pastor/admin only)
  router.post('/', authorize('pastor', 'admin'), validate(createEventSchema, 'body'), async (req, res) => {
    try {
      const event = await eventService.create(req.body, (req as any).user.id);
      res.status(201).json({ event: event.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Update event (pastor/admin only)
  router.put('/:id', authorize('pastor', 'admin'), validate(updateEventSchema, 'body'), async (req, res) => {
    try {
      const event = await eventService.update(req.params['id']! as string, req.body);
      res.json({ event: event.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Delete event (pastor/admin only)
  router.delete('/:id', authorize('pastor', 'admin'), async (req, res) => {
    try {
      await eventService.delete(req.params['id']! as string);
      res.status(204).end();
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // RSVP to event
  router.post('/:id/rsvp', validate(rsvpSchema, 'body'), async (req, res) => {
    try {
      const event = await eventService.rsvp(req.params['id']! as string, (req as any).user.id, req.body);
      res.json({ event: event.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Volunteer sign-up
  router.post('/:id/volunteer/:role', async (req, res) => {
    try {
      const event = await eventService.volunteerSignup(req.params['id']! as string, (req as any).user.id, req.params['role']! as string);
      res.json({ event: event.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Volunteer withdraw
  router.delete('/:id/volunteer/:role', async (req, res) => {
    try {
      const event = await eventService.volunteerWithdraw(req.params['id']! as string, (req as any).user.id, req.params['role']! as string);
      res.json({ event: event.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

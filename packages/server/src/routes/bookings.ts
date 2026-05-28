import { Router } from 'express';
import { z } from 'zod';
import { bookingService } from '../services/booking.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

const createBookableResourceSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['room', 'vehicle', 'equipment', 'other']),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().positive().optional(),
});

const createBookingSchema = z.object({
  resource: z.string().min(1),
  event: z.string().optional(),
  title: z.string().min(1).max(200),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  notes: z.string().max(1000).optional(),
}).refine(data => data.endTime > data.startTime, {
  message: 'endTime must be after startTime',
  path: ['endTime'],
});

const bookingQuerySchema = z.object({
  resource: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export function bookingRoutes(config: AppConfig): Router {
  const router = Router();

  // All booking routes require authentication
  router.use(authenticate(config));

  // List bookable resources
  router.get('/resources', async (req, res) => {
    try {
      const activeOnly = req.query['active'] !== 'false';
      const resources = await bookingService.listResources(activeOnly);
      res.json({ resources });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create bookable resource (pastor/admin only)
  router.post('/resources', authorize('pastor', 'admin'), validate(createBookableResourceSchema, 'body'), async (req, res) => {
    try {
      const resource = await bookingService.createResource(req.body);
      res.status(201).json({ resource: resource.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // List bookings
  router.get('/', validate(bookingQuerySchema, 'query'), async (req, res) => {
    try {
      const result = await bookingService.findBookings(req.query as any);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Create booking
  router.post('/', validate(createBookingSchema, 'body'), async (req, res) => {
    try {
      const booking = await bookingService.createBooking(req.body, (req as any).user.id);
      res.status(201).json({ booking: booking.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  // Cancel booking (owner or admin only)
  router.patch('/:id/cancel', async (req, res) => {
    try {
      const booking = await bookingService.cancelBooking(req.params['id']!, req.user!.id, req.user!.role);
      res.json({ booking: booking.toJSON() });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
      throw err;
    }
  });

  return router;
}

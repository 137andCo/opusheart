import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3050,
  nodeEnv: 'test',
  mongo: { uri: '' },
  redis: { url: 'redis://localhost:6379' },
  jwt: {
    secret: 'test-jwt-secret-that-is-long-enough-for-testing-purposes-here-64!!',
    issuer: 'opusheart-test',
    audience: 'opusheart-test',
    accessExpiresIn: '15m',
    refreshSecret: 'test-refresh-secret-long-enough-for-testing-purposes-64chars!!',
    refreshExpiresIn: '7d',
  },
  encryption: { key: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
  cors: { origins: ['http://localhost:3051'] },
  features: {
    giving: false, attendance: false, memberCare: true, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3050' },
  vertical: 'church',
};

function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, role, jti: 'test-jti' },
    testConfig.jwt.secret,
    { algorithm: 'HS256', issuer: testConfig.jwt.issuer, audience: testConfig.jwt.audience, expiresIn: '15m' }
  );
}

let app: ReturnType<typeof createApp>;

async function createUser(overrides: Record<string, unknown> = {}) {
  return User.create({
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@church.org`,
    emailHash: `hash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fake',
    firstName: 'Test',
    lastName: 'User',
    role: 'member',
    active: true,
    privacySettings: {
      showInDirectory: true,
      showEmail: true,
      showPhone: true,
      allowCareTracking: false,
    },
    ...overrides,
  });
}

describe('Booking API', () => {
  beforeAll(async () => {
    await connectTestDb('bookings');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_bookings';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── POST /api/bookings/resources ────────────────────────────

  describe('POST /api/bookings/resources', () => {
    it('should create a bookable resource', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Fellowship Hall', type: 'room', capacity: 100 });

      expect(res.status).toBe(201);
      expect(res.body.resource).toBeDefined();
      expect(res.body.resource.name).toBe('Fellowship Hall');
      expect(res.body.resource.type).toBe('room');
      expect(res.body.resource.active).toBe(true);
    });
  });

  // ─── GET /api/bookings/resources ─────────────────────────────

  describe('GET /api/bookings/resources', () => {
    it('should list active resources', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });
      await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Van 1', type: 'vehicle' });

      const res = await request(app)
        .get('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.resources).toHaveLength(2);
    });
  });

  // ─── POST /api/bookings ──────────────────────────────────────

  describe('POST /api/bookings', () => {
    it('should create a booking', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const resourceRes = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });

      const resourceId = resourceRes.body.resource.id;
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Team Meeting',
          startTime: '2026-04-01T09:00:00Z',
          endTime: '2026-04-01T10:00:00Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.title).toBe('Team Meeting');
      expect(res.body.booking.status).toBe('confirmed');
    });

    it('should detect booking conflicts (409 BOOKING_CONFLICT)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const resourceRes = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });

      const resourceId = resourceRes.body.resource.id;

      // First booking
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Meeting 1',
          startTime: '2026-04-01T09:00:00Z',
          endTime: '2026-04-01T10:00:00Z',
        });

      // Overlapping booking
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Meeting 2',
          startTime: '2026-04-01T09:30:00Z',
          endTime: '2026-04-01T10:30:00Z',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BOOKING_CONFLICT');
    });

    it('should reject booking for inactive resource', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const resourceRes = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Old Room', type: 'room' });

      const resourceId = resourceRes.body.resource.id;

      // Deactivate the resource directly via model
      const { BookableResource } = await import('../../src/models/BookableResource.js');
      await BookableResource.findByIdAndUpdate(resourceId, { active: false });

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Nope',
          startTime: '2026-04-01T09:00:00Z',
          endTime: '2026-04-01T10:00:00Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('RESOURCE_INACTIVE');
    });

    it('should reject booking where endTime <= startTime', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const resourceRes = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });

      const resourceId = resourceRes.body.resource.id;
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Bad Booking',
          startTime: '2026-04-01T10:00:00Z',
          endTime: '2026-04-01T09:00:00Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /api/bookings ───────────────────────────────────────

  describe('GET /api/bookings', () => {
    it('should list bookings', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const resourceRes = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });

      const resourceId = resourceRes.body.resource.id;

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Meeting 1',
          startTime: '2026-04-01T09:00:00Z',
          endTime: '2026-04-01T10:00:00Z',
        });
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Meeting 2',
          startTime: '2026-04-02T09:00:00Z',
          endTime: '2026-04-02T10:00:00Z',
        });

      const res = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter bookings by resource', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res1 = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });
      const res2 = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room B', type: 'room' });

      const resourceA = res1.body.resource.id;
      const resourceB = res2.body.resource.id;

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ resource: resourceA, title: 'A1', startTime: '2026-04-01T09:00:00Z', endTime: '2026-04-01T10:00:00Z' });
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ resource: resourceB, title: 'B1', startTime: '2026-04-01T09:00:00Z', endTime: '2026-04-01T10:00:00Z' });

      const res = await request(app)
        .get(`/api/bookings?resource=${resourceA}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(1);
      expect(res.body.bookings[0].title).toBe('A1');
    });

    it('should paginate bookings', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const resourceRes = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });

      const resourceId = resourceRes.body.resource.id;

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            resource: resourceId,
            title: `Meeting ${i}`,
            startTime: `2026-04-0${i + 1}T09:00:00Z`,
            endTime: `2026-04-0${i + 1}T10:00:00Z`,
          });
      }

      const res = await request(app)
        .get('/api/bookings?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
      expect(res.body.page).toBe(1);
    });
  });

  // ─── PATCH /api/bookings/:id/cancel ──────────────────────────

  describe('PATCH /api/bookings/:id/cancel', () => {
    it('should cancel a booking', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const resourceRes = await request(app)
        .post('/api/bookings/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Room A', type: 'room' });

      const resourceId = resourceRes.body.resource.id;

      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resource: resourceId,
          title: 'Cancel Me',
          startTime: '2026-04-01T09:00:00Z',
          endTime: '2026-04-01T10:00:00Z',
        });

      const bookingId = bookingRes.body.booking.id;
      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('cancelled');
    });

    it('should return 404 for non-existent booking', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/bookings/${fakeId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  // ─── Auth Enforcement ────────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should return 401 for GET /api/bookings without token', async () => {
      const res = await request(app).get('/api/bookings');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/bookings without token', async () => {
      const res = await request(app).post('/api/bookings').send({});
      expect(res.status).toBe(401);
    });

    it('should return 401 for GET /api/bookings/resources without token', async () => {
      const res = await request(app).get('/api/bookings/resources');
      expect(res.status).toBe(401);
    });
  });
});

// ─── iCal Export ───────────────────────────────────────────────

describe('iCal Export', () => {
  let app: ReturnType<typeof createApp>;

  const icalConfig: AppConfig = { ...testConfig, port: 3052 };

  beforeAll(async () => {
    await connectTestDb('bookings_ical');
    icalConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_bookings_ical';
    app = createApp(icalConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  describe('GET /api/events/public/ical', () => {
    it('should return text/calendar content type', async () => {
      const res = await request(app).get('/api/events/public/ical');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
    });

    it('should return valid VCALENDAR content', async () => {
      const res = await request(app).get('/api/events/public/ical');

      expect(res.status).toBe(200);
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('END:VCALENDAR');
    });

    it('should include public events in the calendar', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Public Worship',
          description: 'Sunday morning worship',
          startDate: '2026-04-01T10:00:00Z',
          endDate: '2026-04-01T12:00:00Z',
          location: 'Main Sanctuary',
          visibility: 'public',
        });

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Leaders Only',
          description: 'Private meeting',
          startDate: '2026-04-02T10:00:00Z',
          endDate: '2026-04-02T12:00:00Z',
          location: 'Office',
          visibility: 'leaders',
        });

      const res = await request(app).get('/api/events/public/ical');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Public Worship');
      expect(res.text).not.toContain('Leaders Only');
    });

    it('should not require authentication', async () => {
      const res = await request(app).get('/api/events/public/ical');
      expect(res.status).toBe(200);
    });
  });
});

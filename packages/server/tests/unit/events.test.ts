import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Event } from '../../src/models/Event.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3040,
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
  cors: { origins: ['http://localhost:3041'] },
  features: {
    giving: false, attendance: false, memberCare: true, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3040' },
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

const sampleEvent = {
  title: 'Sunday Service',
  description: 'Weekly worship service',
  startDate: new Date('2026-04-01T10:00:00Z'),
  endDate: new Date('2026-04-01T12:00:00Z'),
  location: 'Main Sanctuary',
  visibility: 'public',
};

function buildEvent(overrides: Record<string, unknown> = {}) {
  return { ...sampleEvent, ...overrides };
}

describe('Event API', () => {
  beforeAll(async () => {
    await connectTestDb('events');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_events';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── POST /api/events ──────────────────────────────────────

  describe('POST /api/events', () => {
    it('should create an event', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent());

      expect(res.status).toBe(201);
      expect(res.body.event).toBeDefined();
      expect(res.body.event.title).toBe('Sunday Service');
      expect(res.body.event.createdBy).toBe(user._id.toString());
    });

    it('should create an event with recurrence', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({
          recurring: { frequency: 'weekly', interval: 1, dayOfWeek: [0] },
        }));

      expect(res.status).toBe(201);
      expect(res.body.event.recurring).toBeDefined();
      expect(res.body.event.recurring.frequency).toBe('weekly');
    });

    it('should create an event with volunteer slots', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({
          volunteerSlots: [
            { role: 'Greeter', needed: 3 },
            { role: 'Usher', needed: 2 },
          ],
        }));

      expect(res.status).toBe(201);
      expect(res.body.event.volunteerSlots).toHaveLength(2);
      expect(res.body.event.volunteerSlots[0].role).toBe('Greeter');
    });

    it('should reject event where endDate < startDate', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({
          startDate: new Date('2026-04-01T12:00:00Z'),
          endDate: new Date('2026-04-01T10:00:00Z'),
        }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /api/events/public ────────────────────────────────

  describe('GET /api/events/public', () => {
    it('should return only public events', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'Public Event', visibility: 'public' }));
      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'Members Only', visibility: 'members' }));

      const res = await request(app).get('/api/events/public');

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].title).toBe('Public Event');
    });

    it('should filter by date range', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'April Event', startDate: '2026-04-01T10:00:00Z', endDate: '2026-04-01T12:00:00Z' }));
      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'June Event', startDate: '2026-06-01T10:00:00Z', endDate: '2026-06-01T12:00:00Z' }));

      const res = await request(app)
        .get('/api/events/public?from=2026-03-01T00:00:00Z&to=2026-05-01T00:00:00Z');

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].title).toBe('April Event');
    });

    it('should paginate results', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
          .send(buildEvent({
            title: `Event ${i}`,
            startDate: new Date(`2026-04-0${i + 1}T10:00:00Z`),
            endDate: new Date(`2026-04-0${i + 1}T12:00:00Z`),
          }));
      }

      const res = await request(app).get('/api/events/public?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
      expect(res.body.page).toBe(1);
    });
  });

  // ─── GET /api/events/public/:id ────────────────────────────

  describe('GET /api/events/public/:id', () => {
    it('should return a public event by ID', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ visibility: 'public' }));

      const eventId = createRes.body.event.id;
      const res = await request(app).get(`/api/events/public/${eventId}`);

      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('Sunday Service');
    });

    it('should return 404 for a non-public event', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ visibility: 'members' }));

      const eventId = createRes.body.event.id;
      const res = await request(app).get(`/api/events/public/${eventId}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
    });
  });

  // ─── GET /api/events (auth'd) ─────────────────────────────

  describe('GET /api/events', () => {
    it('should list all events', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'Event A' }));
      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'Event B', visibility: 'members' }));

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter by visibility', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'Public', visibility: 'public' }));
      await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ title: 'Leaders', visibility: 'leaders' }));

      const res = await request(app)
        .get('/api/events?visibility=leaders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].title).toBe('Leaders');
    });
  });

  // ─── GET /api/events/:id (auth'd) ─────────────────────────

  describe('GET /api/events/:id', () => {
    it('should return an event by ID', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent());

      const eventId = createRes.body.event.id;
      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('Sunday Service');
    });

    it('should return 404 for non-existent event', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/events/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
    });
  });

  // ─── PUT /api/events/:id ──────────────────────────────────

  describe('PUT /api/events/:id', () => {
    it('should update event title', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent());

      const eventId = createRes.body.event.id;
      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Service' });

      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('Updated Service');
    });

    it('should do a partial update without affecting other fields', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent());

      const eventId = createRes.body.event.id;
      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ location: 'Fellowship Hall' });

      expect(res.status).toBe(200);
      expect(res.body.event.location).toBe('Fellowship Hall');
      expect(res.body.event.title).toBe('Sunday Service');
    });
  });

  // ─── DELETE /api/events/:id ───────────────────────────────

  describe('DELETE /api/events/:id', () => {
    it('should delete an event', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent());

      const eventId = createRes.body.event.id;
      const res = await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const check = await Event.findById(eventId);
      expect(check).toBeNull();
    });

    it('should return 404 for non-existent event', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .delete(`/api/events/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
    });
  });

  // ─── POST /api/events/:id/rsvp ────────────────────────────

  describe('POST /api/events/:id/rsvp', () => {
    it('should RSVP yes to an event', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent());

      const eventId = createRes.body.event.id;
      const res = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'yes', headcount: 2 });

      expect(res.status).toBe(200);
      expect(res.body.event.rsvps).toHaveLength(1);
      expect(res.body.event.rsvps[0].status).toBe('yes');
      expect(res.body.event.rsvps[0].headcount).toBe(2);
    });

    it('should update an existing RSVP', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent());

      const eventId = createRes.body.event.id;

      // First RSVP
      await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'yes', headcount: 2 });

      // Update RSVP
      const res = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'no' });

      expect(res.status).toBe(200);
      expect(res.body.event.rsvps).toHaveLength(1);
      expect(res.body.event.rsvps[0].status).toBe('no');
    });

    it('should reject RSVP when event is full (maxAttendees)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({ maxAttendees: 2 }));

      const eventId = createRes.body.event.id;

      // First user RSVPs with headcount 2 (fills capacity)
      await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'yes', headcount: 2 });

      // Second user tries to RSVP
      const user2 = await createUser({ role: 'member' });
      const token2 = makeToken(user2._id.toString(), 'member');

      const res = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ status: 'yes', headcount: 1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EVENT_FULL');
    });
  });

  // ─── POST /api/events/:id/volunteer/:role ─────────────────

  describe('POST /api/events/:id/volunteer/:role', () => {
    it('should sign up for a volunteer slot', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({
          volunteerSlots: [{ role: 'Greeter', needed: 2 }],
        }));

      const eventId = createRes.body.event.id;
      const res = await request(app)
        .post(`/api/events/${eventId}/volunteer/Greeter`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.event.volunteerSlots[0].filled).toHaveLength(1);
    });

    it('should reject when volunteer slot is full', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({
          volunteerSlots: [{ role: 'Greeter', needed: 1 }],
        }));

      const eventId = createRes.body.event.id;

      // First user fills the slot
      await request(app)
        .post(`/api/events/${eventId}/volunteer/Greeter`)
        .set('Authorization', `Bearer ${token}`);

      // Second user tries
      const user2 = await createUser({ role: 'member' });
      const token2 = makeToken(user2._id.toString(), 'member');

      const res = await request(app)
        .post(`/api/events/${eventId}/volunteer/Greeter`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLOT_FULL');
    });

    it('should reject duplicate volunteer signup', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({
          volunteerSlots: [{ role: 'Greeter', needed: 3 }],
        }));

      const eventId = createRes.body.event.id;

      // Sign up once
      await request(app)
        .post(`/api/events/${eventId}/volunteer/Greeter`)
        .set('Authorization', `Bearer ${token}`);

      // Try again
      const res = await request(app)
        .post(`/api/events/${eventId}/volunteer/Greeter`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_SIGNED_UP');
    });
  });

  // ─── DELETE /api/events/:id/volunteer/:role ────────────────

  describe('DELETE /api/events/:id/volunteer/:role', () => {
    it('should withdraw from a volunteer slot', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(buildEvent({
          volunteerSlots: [{ role: 'Greeter', needed: 2 }],
        }));

      const eventId = createRes.body.event.id;

      // Sign up
      await request(app)
        .post(`/api/events/${eventId}/volunteer/Greeter`)
        .set('Authorization', `Bearer ${token}`);

      // Withdraw
      const res = await request(app)
        .delete(`/api/events/${eventId}/volunteer/Greeter`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.event.volunteerSlots[0].filled).toHaveLength(0);
    });
  });

  // ─── Auth Enforcement ─────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should return 401 for GET /api/events without token', async () => {
      const res = await request(app).get('/api/events');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/events without token', async () => {
      const res = await request(app).post('/api/events').send(buildEvent());
      expect(res.status).toBe(401);
    });

    it('should return 401 for PUT /api/events/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).put(`/api/events/${fakeId}`).send({ title: 'Nope' });
      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/events/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/events/${fakeId}`);
      expect(res.status).toBe(401);
    });

    it('should allow GET /api/events/public without token', async () => {
      const res = await request(app).get('/api/events/public');
      expect(res.status).toBe(200);
    });

    it('should allow GET /api/events/public/:id without token (404 for missing)', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/events/public/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });
});

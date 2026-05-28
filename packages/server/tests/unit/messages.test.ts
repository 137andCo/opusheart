import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Message } from '../../src/models/Message.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3030,
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
  cors: { origins: ['http://localhost:3031'] },
  features: {
    giving: false, attendance: false, memberCare: true, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3030' },
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

function sampleMessage(overrides: Record<string, unknown> = {}) {
  return {
    subject: 'Weekly Update',
    body: '<p>Hello church family!</p>',
    bodyPlain: 'Hello church family!',
    channel: 'email',
    audience: { type: 'all' },
    ...overrides,
  };
}

describe('Message API', () => {
  beforeAll(async () => {
    await connectTestDb('messages');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_messages';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── POST /api/messages ──────────────────────────────────────

  describe('POST /api/messages', () => {
    it('should create a draft message (no scheduledFor)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.subject).toBe('Weekly Update');
      expect(res.body.message.status).toBe('draft');
      expect(res.body.message.sentBy).toBe(user._id.toString());
    });

    it('should create a scheduled message (with scheduledFor)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage({ scheduledFor: futureDate }));

      expect(res.status).toBe(201);
      expect(res.body.message.status).toBe('scheduled');
      expect(res.body.message.scheduledFor).toBeDefined();
    });

    it('should reject creation with missing subject', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage({ subject: '' }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /api/messages ───────────────────────────────────────

  describe('GET /api/messages', () => {
    it('should list all messages', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/messages').set('Authorization', `Bearer ${token}`)
        .send(sampleMessage({ subject: 'Message 1' }));
      await request(app).post('/api/messages').set('Authorization', `Bearer ${token}`)
        .send(sampleMessage({ subject: 'Message 2' }));

      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter messages by status', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      await request(app).post('/api/messages').set('Authorization', `Bearer ${token}`)
        .send(sampleMessage({ subject: 'Draft One' }));
      await request(app).post('/api/messages').set('Authorization', `Bearer ${token}`)
        .send(sampleMessage({ subject: 'Scheduled One', scheduledFor: futureDate }));

      const res = await request(app)
        .get('/api/messages?status=draft')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(1);
      expect(res.body.messages[0].subject).toBe('Draft One');
    });

    it('should paginate messages', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/messages').set('Authorization', `Bearer ${token}`)
          .send(sampleMessage({ subject: `Message ${i}` }));
      }

      const res = await request(app)
        .get('/api/messages?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
      expect(res.body.page).toBe(1);
    });
  });

  // ─── GET /api/messages/:id ───────────────────────────────────

  describe('GET /api/messages/:id', () => {
    it('should return a message by ID', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;
      const res = await request(app)
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message.subject).toBe('Weekly Update');
    });

    it('should return 404 for non-existent message', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/messages/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MESSAGE_NOT_FOUND');
    });
  });

  // ─── PUT /api/messages/:id ───────────────────────────────────

  describe('PUT /api/messages/:id', () => {
    it('should update a draft message', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;
      const res = await request(app)
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Updated Subject' });

      expect(res.status).toBe(200);
      expect(res.body.message.subject).toBe('Updated Subject');
    });

    it('should reject update on a sent message (MESSAGE_LOCKED)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;

      // Send the message first
      await request(app)
        .post(`/api/messages/${messageId}/send`)
        .set('Authorization', `Bearer ${token}`);

      // Try to update
      const res = await request(app)
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Nope' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MESSAGE_LOCKED');
    });
  });

  // ─── DELETE /api/messages/:id ────────────────────────────────

  describe('DELETE /api/messages/:id', () => {
    it('should delete a draft message', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;
      const res = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify it's gone
      const check = await Message.findById(messageId);
      expect(check).toBeNull();
    });

    it('should reject delete on a sent message', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;

      // Send it
      await request(app)
        .post(`/api/messages/${messageId}/send`)
        .set('Authorization', `Bearer ${token}`);

      // Try to delete
      const res = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MESSAGE_LOCKED');
    });
  });

  // ─── POST /api/messages/:id/send ─────────────────────────────

  describe('POST /api/messages/:id/send', () => {
    it('should send a draft message (status=sent, sentAt set)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;
      const res = await request(app)
        .post(`/api/messages/${messageId}/send`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message.status).toBe('sent');
      expect(res.body.message.sentAt).toBeDefined();
    });

    it('should reject double send (ALREADY_SENT)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;

      // Send once
      await request(app)
        .post(`/api/messages/${messageId}/send`)
        .set('Authorization', `Bearer ${token}`);

      // Try to send again
      const res = await request(app)
        .post(`/api/messages/${messageId}/send`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_SENT');
    });
  });

  // ─── POST /api/messages/:id/cancel ───────────────────────────

  describe('POST /api/messages/:id/cancel', () => {
    it('should cancel a scheduled message (status=draft, scheduledFor cleared)', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage({ scheduledFor: futureDate }));

      const messageId = createRes.body.message.id;
      expect(createRes.body.message.status).toBe('scheduled');

      const res = await request(app)
        .post(`/api/messages/${messageId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message.status).toBe('draft');
      expect(res.body.message.scheduledFor).toBeUndefined();
    });

    it('should reject cancel on a non-scheduled message', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMessage());

      const messageId = createRes.body.message.id;
      const res = await request(app)
        .post(`/api/messages/${messageId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NOT_SCHEDULED');
    });
  });

  // ─── Auth Enforcement ─────────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should return 401 for GET /api/messages without token', async () => {
      const res = await request(app).get('/api/messages');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/messages without token', async () => {
      const res = await request(app)
        .post('/api/messages')
        .send(sampleMessage());
      expect(res.status).toBe(401);
    });

    it('should return 401 for PUT /api/messages/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/api/messages/${fakeId}`)
        .send({ subject: 'Nope' });
      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/messages/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/messages/${fakeId}`);
      expect(res.status).toBe(401);
    });
  });
});

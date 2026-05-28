import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { PrayerRequest } from '../../src/models/PrayerRequest.js';
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

const samplePrayer = {
  content: 'Please pray for my family during this difficult time.',
  category: 'family',
};

function buildPrayer(overrides: Record<string, unknown> = {}) {
  return { ...samplePrayer, ...overrides };
}

describe('Prayer API', () => {
  beforeAll(async () => {
    await connectTestDb('prayer');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_prayer';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── POST /api/prayer ──────────────────────────────────────

  describe('POST /api/prayer', () => {
    it('should create a prayer request (anonymous defaults to true)', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const res = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      expect(res.status).toBe(201);
      expect(res.body.prayerRequest).toBeDefined();
      expect(res.body.prayerRequest.content).toBe(samplePrayer.content);
      expect(res.body.prayerRequest.anonymous).toBe(true);
      expect(res.body.prayerRequest.category).toBe('family');
    });

    it('should create a non-anonymous prayer request', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const res = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer({ anonymous: false }));

      expect(res.status).toBe(201);
      expect(res.body.prayerRequest.anonymous).toBe(false);
    });

    it('should create a prayer request with specific visibility', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const res = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer({ visibility: 'pastor_only' }));

      expect(res.status).toBe(201);
      expect(res.body.prayerRequest.visibility).toBe('pastor_only');
    });
  });

  // ─── GET /api/prayer/wall ──────────────────────────────────

  describe('GET /api/prayer/wall', () => {
    it('should return only congregation/mesh active requests', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      // Create congregation-visible request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${pastorToken}`)
        .send(buildPrayer({ visibility: 'congregation' }));

      // Create mesh-visible request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${pastorToken}`)
        .send(buildPrayer({ content: 'Mesh prayer', visibility: 'mesh' }));

      // Create pastor_only request (should NOT appear on wall)
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${pastorToken}`)
        .send(buildPrayer({ content: 'Private pastor request', visibility: 'pastor_only' }));

      const res = await request(app).get('/api/prayer/wall');

      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toHaveLength(2);
    });

    it('should strip submittedBy from anonymous requests', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      // Create anonymous request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer({ anonymous: true, visibility: 'congregation' }));

      // Create non-anonymous request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer({ content: 'Non-anon prayer', anonymous: false, visibility: 'congregation' }));

      const res = await request(app).get('/api/prayer/wall');

      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toHaveLength(2);

      const anonRequest = res.body.prayerRequests.find(
        (r: any) => r.content === samplePrayer.content
      );
      const namedRequest = res.body.prayerRequests.find(
        (r: any) => r.content === 'Non-anon prayer'
      );

      expect(anonRequest.submittedBy).toBeUndefined();
      expect(namedRequest.submittedBy).toBeDefined();
    });

    it('should not return answered/archived requests', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      // Mark as answered
      await request(app)
        .put(`/api/prayer/${createRes.body.prayerRequest.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'answered' });

      const res = await request(app).get('/api/prayer/wall');

      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toHaveLength(0);
    });
  });

  // ─── GET /api/prayer (auth'd) ─────────────────────────────

  describe('GET /api/prayer', () => {
    it('should let pastor see all requests including pastor_only', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');
      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      // Member creates pastor_only request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(buildPrayer({ visibility: 'pastor_only' }));

      // Member creates congregation request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(buildPrayer({ content: 'Public prayer', visibility: 'congregation' }));

      const res = await request(app)
        .get('/api/prayer')
        .set('Authorization', `Bearer ${pastorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toHaveLength(2);
    });

    it('should let member see only congregation-visible requests', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');
      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      // Create pastor_only request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${pastorToken}`)
        .send(buildPrayer({ visibility: 'pastor_only' }));

      // Create congregation request
      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${pastorToken}`)
        .send(buildPrayer({ content: 'Public prayer', visibility: 'congregation' }));

      const res = await request(app)
        .get('/api/prayer')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      // Member uses findCongregation which only returns congregation/mesh + active
      expect(res.body.prayerRequests).toHaveLength(1);
      expect(res.body.prayerRequests[0].content).toBe('Public prayer');
    });
  });

  // ─── GET /api/prayer/mine ─────────────────────────────────

  describe('GET /api/prayer/mine', () => {
    it('should return only the current user\'s requests', async () => {
      const user1 = await createUser({ role: 'member' });
      const token1 = makeToken(user1._id.toString(), 'member');
      const user2 = await createUser({ role: 'member' });
      const token2 = makeToken(user2._id.toString(), 'member');

      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token1}`)
        .send(buildPrayer({ content: 'User1 prayer' }));

      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token2}`)
        .send(buildPrayer({ content: 'User2 prayer' }));

      const res = await request(app)
        .get('/api/prayer/mine')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toHaveLength(1);
      expect(res.body.prayerRequests[0].content).toBe('User1 prayer');
    });
  });

  // ─── GET /api/prayer/:id ──────────────────────────────────

  describe('GET /api/prayer/:id', () => {
    it('should return a prayer request by ID', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      const prayerId = createRes.body.prayerRequest.id;
      const res = await request(app)
        .get(`/api/prayer/${prayerId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.prayerRequest.content).toBe(samplePrayer.content);
    });

    it('should return 404 for non-existent prayer request', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/prayer/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRAYER_NOT_FOUND');
    });
  });

  // ─── PUT /api/prayer/:id ──────────────────────────────────

  describe('PUT /api/prayer/:id', () => {
    it('should update status to answered', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      const prayerId = createRes.body.prayerRequest.id;
      const res = await request(app)
        .put(`/api/prayer/${prayerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'answered' });

      expect(res.status).toBe(200);
      expect(res.body.prayerRequest.status).toBe('answered');
    });

    it('should update category', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      const prayerId = createRes.body.prayerRequest.id;
      const res = await request(app)
        .put(`/api/prayer/${prayerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'health' });

      expect(res.status).toBe(200);
      expect(res.body.prayerRequest.category).toBe('health');
    });
  });

  // ─── DELETE /api/prayer/:id ────────────────────────────────

  describe('DELETE /api/prayer/:id', () => {
    it('should delete a prayer request', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      const prayerId = createRes.body.prayerRequest.id;
      const res = await request(app)
        .delete(`/api/prayer/${prayerId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const check = await PrayerRequest.findById(prayerId);
      expect(check).toBeNull();
    });

    it('should return 404 for non-existent prayer request', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .delete(`/api/prayer/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRAYER_NOT_FOUND');
    });
  });

  // ─── POST /api/prayer/:id/pray ────────────────────────────

  describe('POST /api/prayer/:id/pray', () => {
    it('should increment prayerCount and create PrayerResponse', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      const prayerId = createRes.body.prayerRequest.id;

      const res = await request(app)
        .post(`/api/prayer/${prayerId}/pray`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.prayerResponse).toBeDefined();
      expect(res.body.prayerResponse.type).toBe('prayed');

      // Verify prayerCount was incremented
      const updated = await PrayerRequest.findById(prayerId);
      expect(updated!.prayerCount).toBe(1);
    });
  });

  // ─── POST /api/prayer/:id/respond ─────────────────────────

  describe('POST /api/prayer/:id/respond', () => {
    it('should create a message response', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      const prayerId = createRes.body.prayerRequest.id;

      const res = await request(app)
        .post(`/api/prayer/${prayerId}/respond`)
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Praying for you and your family!' });

      expect(res.status).toBe(201);
      expect(res.body.prayerResponse).toBeDefined();
      expect(res.body.prayerResponse.type).toBe('message');
      expect(res.body.prayerResponse.message).toBe('Praying for you and your family!');
    });
  });

  // ─── GET /api/prayer/:id/responses ────────────────────────

  describe('GET /api/prayer/:id/responses', () => {
    it('should list all responses for a prayer request', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer());

      const prayerId = createRes.body.prayerRequest.id;

      // Add a pray response
      await request(app)
        .post(`/api/prayer/${prayerId}/pray`)
        .set('Authorization', `Bearer ${token}`);

      // Add a message response
      await request(app)
        .post(`/api/prayer/${prayerId}/respond`)
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Lifting you up!' });

      const res = await request(app)
        .get(`/api/prayer/${prayerId}/responses`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.responses).toHaveLength(2);
      const types = res.body.responses.map((r: any) => r.type);
      expect(types).toContain('prayed');
      expect(types).toContain('message');
    });
  });

  // ─── Auth Enforcement ─────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should return 401 for GET /api/prayer without token', async () => {
      const res = await request(app).get('/api/prayer');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/prayer without token', async () => {
      const res = await request(app).post('/api/prayer').send(buildPrayer());
      expect(res.status).toBe(401);
    });

    it('should return 401 for GET /api/prayer/mine without token', async () => {
      const res = await request(app).get('/api/prayer/mine');
      expect(res.status).toBe(401);
    });

    it('should return 401 for PUT /api/prayer/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).put(`/api/prayer/${fakeId}`).send({ status: 'answered' });
      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/prayer/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/prayer/${fakeId}`);
      expect(res.status).toBe(401);
    });

    it('should allow GET /api/prayer/wall without auth', async () => {
      const res = await request(app).get('/api/prayer/wall');
      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toBeDefined();
    });
  });

  // ─── Privacy ──────────────────────────────────────────────

  describe('Privacy', () => {
    it('should strip submittedBy from anonymous requests on wall', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer({ anonymous: true }));

      const res = await request(app).get('/api/prayer/wall');

      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toHaveLength(1);
      expect(res.body.prayerRequests[0].submittedBy).toBeUndefined();
      expect(res.body.prayerRequests[0].content).toBe(samplePrayer.content);
    });

    it('should include submittedBy for non-anonymous requests on wall', async () => {
      const user = await createUser({ role: 'member' });
      const token = makeToken(user._id.toString(), 'member');

      await request(app)
        .post('/api/prayer')
        .set('Authorization', `Bearer ${token}`)
        .send(buildPrayer({ anonymous: false }));

      const res = await request(app).get('/api/prayer/wall');

      expect(res.status).toBe(200);
      expect(res.body.prayerRequests).toHaveLength(1);
      expect(res.body.prayerRequests[0].submittedBy).toBeDefined();
    });
  });
});

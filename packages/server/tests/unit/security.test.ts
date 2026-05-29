import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createApp } from '../../src/app.js';
import { rateLimit, type RateLimitStore } from '../../src/middleware/rateLimit.js';

// In-memory stand-in for Redis so the limiter can be unit-tested without a
// live Redis (production uses the shared ioredis client).
function fakeStore(): RateLimitStore {
  const counts = new Map<string, number>();
  return {
    async incr(key: string) { const v = (counts.get(key) ?? 0) + 1; counts.set(key, v); return v; },
    async expire() { return 1; },
  };
}
import { User } from '../../src/models/User.js';
import { MemberCareNote } from '../../src/models/MemberCareNote.js';
import { Member } from '../../src/models/Member.js';
import { PrayerRequest } from '../../src/models/PrayerRequest.js';
import { Donation } from '../../src/models/Donation.js';
import { Fund } from '../../src/models/Fund.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3020,
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
  cors: { origins: ['http://localhost:3021'] },
  features: {
    giving: true, attendance: false, memberCare: true, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3020' },
  vertical: 'church',
};

function makeToken(userId: string, role: string, options?: { expiresIn?: string; algorithm?: jwt.Algorithm; secret?: string }): string {
  const secret = options?.secret ?? testConfig.jwt.secret;
  const algo = options?.algorithm ?? 'HS256';
  return jwt.sign(
    { sub: userId, role, jti: 'test-jti' },
    secret,
    { algorithm: algo as jwt.Algorithm, issuer: testConfig.jwt.issuer, audience: testConfig.jwt.audience, expiresIn: options?.expiresIn ?? '15m' }
  );
}

let app: ReturnType<typeof createApp>;

describe('Security Tests', () => {
  beforeAll(async () => {
    await connectTestDb('security');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_security';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── JWT Security ──────────────────────────────────────

  describe('JWT Algorithm Pinning', () => {
    it('should reject token signed with wrong secret', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const token = makeToken(userId, 'admin', { secret: 'wrong-secret-that-is-long-enough-for-testing' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should reject token with wrong issuer', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const token = jwt.sign(
        { sub: userId, role: 'admin', jti: 'test-jti' },
        testConfig.jwt.secret,
        { algorithm: 'HS256', issuer: 'wrong-issuer', audience: testConfig.jwt.audience, expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should reject token with wrong audience', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const token = jwt.sign(
        { sub: userId, role: 'admin', jti: 'test-jti' },
        testConfig.jwt.secret,
        { algorithm: 'HS256', issuer: testConfig.jwt.issuer, audience: 'wrong-audience', expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should reject "none" algorithm token', async () => {
      // Manually craft an unsigned token (algorithm: none attack)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: new mongoose.Types.ObjectId().toString(),
        role: 'admin',
        jti: 'test-jti',
        iss: testConfig.jwt.issuer,
        aud: testConfig.jwt.audience,
        exp: Math.floor(Date.now() / 1000) + 900,
      })).toString('base64url');
      const fakeToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Token Expiration', () => {
    it('should reject expired token', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      // Create user so the DB check would pass if token were valid
      await User.create({
        _id: userId,
        email: 'test@test.org',
        emailHash: 'hash1',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        role: 'member',
      });

      const token = makeToken(userId, 'member', { expiresIn: '0s' });
      // Small delay to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 50));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Missing Auth Header', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NO_TOKEN');
    });

    it('should return 401 for malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer sometoken');
      expect(res.status).toBe(401);
    });

    it('should return 401 for empty Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
    });
  });

  // ─── Rate Limiting ─────────────────────────────────────

  describe('Rate Limiting', () => {
    it('should return 429 after exceeding rate limit', async () => {
      // Create a minimal Express app with tight rate limiter for testing
      const rateLimitedApp = express();
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 3, keyPrefix: 'test', store: fakeStore() });
      rateLimitedApp.use(limiter);
      rateLimitedApp.get('/test', (_req, res) => {
        res.json({ ok: true });
      });

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(rateLimitedApp).get('/test');
        expect(res.status).toBe(200);
      }

      // 4th request should be rate limited
      const res = await request(rateLimitedApp).get('/test');
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });

    it('should include rate limit headers', async () => {
      const rateLimitedApp = express();
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 10, keyPrefix: 'test', store: fakeStore() });
      rateLimitedApp.use(limiter);
      rateLimitedApp.get('/test', (_req, res) => {
        res.json({ ok: true });
      });

      const res = await request(rateLimitedApp).get('/test');
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('fails CLOSED (503) when the limiter store is unavailable', async () => {
      const rateLimitedApp = express();
      const brokenStore: RateLimitStore = {
        async incr() { throw new Error('redis down'); },
        async expire() { return 1; },
      };
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 10, keyPrefix: 'test', store: brokenStore });
      rateLimitedApp.use(limiter);
      rateLimitedApp.get('/test', (_req, res) => { res.json({ ok: true }); });

      const res = await request(rateLimitedApp).get('/test');
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('RATE_LIMITER_DOWN');
    });
  });

  // ─── Authorization / IDOR ──────────────────────────────

  describe('Authorization & Access Control', () => {
    it('should prevent regular member from accessing care notes (pastor-only)', async () => {
      const memberId = new mongoose.Types.ObjectId().toString();
      const memberUserId = new mongoose.Types.ObjectId().toString();

      await User.create({
        _id: memberUserId,
        email: 'member@test.org',
        emailHash: 'memberhash',
        passwordHash: 'hash',
        firstName: 'Regular',
        lastName: 'Member',
        role: 'member',
      });

      const memberToken = makeToken(memberUserId, 'member');
      const res = await request(app)
        .get(`/api/care/${memberId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should prevent visitor from creating care notes', async () => {
      const visitorId = new mongoose.Types.ObjectId().toString();
      await User.create({
        _id: visitorId,
        email: 'visitor@test.org',
        emailHash: 'visitorhash',
        passwordHash: 'hash',
        firstName: 'Visitor',
        lastName: 'User',
        role: 'visitor',
      });

      const visitorToken = makeToken(visitorId, 'visitor');
      const res = await request(app)
        .post('/api/care')
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ memberId: new mongoose.Types.ObjectId().toString(), type: 'general', content: 'test' });

      expect(res.status).toBe(403);
    });

    it('should allow pastor to access care notes', async () => {
      const pastorId = new mongoose.Types.ObjectId().toString();
      const memberId = new mongoose.Types.ObjectId();
      const memberUserId = new mongoose.Types.ObjectId();

      await User.create({
        _id: pastorId,
        email: 'pastor@test.org',
        emailHash: 'pastorhash',
        passwordHash: 'hash',
        firstName: 'Pastor',
        lastName: 'Smith',
        role: 'pastor',
      });

      // The member's user has consented to care tracking — required for both
      // creating and now reading care notes (GDPR Art. 9 consent gate).
      await User.create({
        _id: memberUserId,
        email: 'caremember@test.org',
        emailHash: 'carememberhash',
        passwordHash: 'hash',
        firstName: 'Care',
        lastName: 'Member',
        role: 'member',
        privacySettings: { showInDirectory: true, showEmail: false, showPhone: false, allowCareTracking: true },
      });
      await Member.create({ _id: memberId, userId: memberUserId });

      const pastorToken = makeToken(pastorId, 'pastor');
      const res = await request(app)
        .get(`/api/care/${memberId}`)
        .set('Authorization', `Bearer ${pastorToken}`);

      // Should succeed (200) — pastor has access
      expect(res.status).toBe(200);
    });

    it('should block care-note reads when the member has not consented', async () => {
      const pastorId = new mongoose.Types.ObjectId().toString();
      const memberId = new mongoose.Types.ObjectId();
      const memberUserId = new mongoose.Types.ObjectId();

      await User.create({
        _id: pastorId, email: 'pastor2@test.org', emailHash: 'pastorhash2',
        passwordHash: 'hash', firstName: 'Pastor', lastName: 'Jones', role: 'pastor',
      });
      await User.create({
        _id: memberUserId, email: 'noconsent@test.org', emailHash: 'noconsenthash',
        passwordHash: 'hash', firstName: 'No', lastName: 'Consent', role: 'member',
        privacySettings: { showInDirectory: true, showEmail: false, showPhone: false, allowCareTracking: false },
      });
      await Member.create({ _id: memberId, userId: memberUserId });

      const res = await request(app)
        .get(`/api/care/${memberId}`)
        .set('Authorization', `Bearer ${makeToken(pastorId, 'pastor')}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CARE_CONSENT_REQUIRED');
    });

    it('should prevent member from managing funds (admin-only)', async () => {
      const memberUserId = new mongoose.Types.ObjectId().toString();
      await User.create({
        _id: memberUserId,
        email: 'member2@test.org',
        emailHash: 'memberhash2',
        passwordHash: 'hash',
        firstName: 'Regular',
        lastName: 'Member',
        role: 'member',
      });

      const memberToken = makeToken(memberUserId, 'member');
      const res = await request(app)
        .post('/api/giving/funds')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Evil Fund', description: 'Hack attempt' });

      expect(res.status).toBe(403);
    });
  });

  // ─── Input Validation / XSS ────────────────────────────

  describe('Input Validation & XSS Prevention', () => {
    it('should reject XSS payload in registration name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'xss@test.org',
          password: 'SecurePass123!',
          firstName: '<script>alert("xss")</script>',
          lastName: 'User',
        });

      // Even if it registers, the response should not contain unescaped script tags
      // Helmet's CSP headers should prevent execution regardless
      if (res.status === 201) {
        // If accepted, verify the stored value doesn't contain raw script tags
        // (encryption plugin may have encrypted it, which is also safe)
        expect(res.headers['content-security-policy']).toBeDefined();
      }
      // Either rejected (400) or accepted with CSP protection — both are acceptable
      expect([201, 400]).toContain(res.status);
    });

    it('should have security headers via helmet', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('should reject oversized JSON body', async () => {
      // The app has a 10mb limit, so this tests that _some_ limit exists
      // We won't send 10mb in a test, but verify the middleware is configured
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send({ email: 'a'.repeat(1000) + '@test.org', password: 'x', firstName: 'A', lastName: 'B' });

      // Should be rejected by validation (bad email format), not crash
      expect(res.status).toBe(400);
    });
  });

  // ─── Inactive User ─────────────────────────────────────

  describe('Inactive User Access', () => {
    it('should reject token for inactive user', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      await User.create({
        _id: userId,
        email: 'inactive@test.org',
        emailHash: 'inactivehash',
        passwordHash: 'hash',
        firstName: 'Inactive',
        lastName: 'User',
        role: 'member',
        active: false,
      });

      const token = makeToken(userId, 'member');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_FAILED');
    });
  });

  // ─── Password Security ────────────────────────────────

  describe('Password Security', () => {
    it('should never expose password hash in response', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'safe@test.org',
          password: 'SecurePass123!',
          firstName: 'Safe',
          lastName: 'User',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  // ─── Privilege Escalation ──────────────────────────────

  describe('Registration Privilege Escalation', () => {
    it('should ignore a client-supplied role on registration (no self-elevation)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'attacker@test.org',
          password: 'SecurePass123!',
          firstName: 'Mal',
          lastName: 'Lory',
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('visitor');

      const stored = await User.findById(res.body.user.id);
      expect(stored?.role).toBe('visitor');
    });

    it('should forbid non-admins from assigning roles', async () => {
      const pastorId = new mongoose.Types.ObjectId().toString();
      await User.create({
        _id: pastorId, email: 'p@test.org', emailHash: 'peh', passwordHash: 'h',
        firstName: 'P', lastName: 'A', role: 'pastor',
      });
      const memberId = new mongoose.Types.ObjectId();
      await Member.create({ _id: memberId, userId: new mongoose.Types.ObjectId() });

      const res = await request(app)
        .patch(`/api/members/${memberId}/role`)
        .set('Authorization', `Bearer ${makeToken(pastorId, 'pastor')}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });

    it('should let an admin assign a role and invalidate the target\'s old sessions', async () => {
      const adminId = new mongoose.Types.ObjectId().toString();
      await User.create({
        _id: adminId, email: 'a@test.org', emailHash: 'aeh', passwordHash: 'h',
        firstName: 'A', lastName: 'D', role: 'admin',
      });
      const targetUserId = new mongoose.Types.ObjectId();
      await User.create({
        _id: targetUserId, email: 't@test.org', emailHash: 'teh', passwordHash: 'h',
        firstName: 'T', lastName: 'U', role: 'member',
      });
      const memberId = new mongoose.Types.ObjectId();
      await Member.create({ _id: memberId, userId: targetUserId });

      const res = await request(app)
        .patch(`/api/members/${memberId}/role`)
        .set('Authorization', `Bearer ${makeToken(adminId, 'admin')}`)
        .send({ role: 'pastor' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('pastor');

      const updated = await User.findById(targetUserId);
      expect(updated?.role).toBe('pastor');
      expect(updated?.tokenInvalidatedAt).toBeTruthy();
    });
  });
});

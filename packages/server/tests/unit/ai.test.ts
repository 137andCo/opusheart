import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3070,
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
  cors: { origins: ['http://localhost:3071'] },
  features: {
    giving: false, attendance: false, memberCare: true, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3070' },
  vertical: 'church',
};

function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, role, jti: 'test-jti' },
    testConfig.jwt.secret,
    { algorithm: 'HS256', issuer: testConfig.jwt.issuer, audience: testConfig.jwt.audience, expiresIn: '15m' },
  );
}

// Default app with ai: false
let app: ReturnType<typeof createApp>;

// App with ai: true
let aiEnabledApp: ReturnType<typeof createApp>;

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

const AI_ENDPOINTS = [
  { path: '/api/ai/summarize-resource', body: { name: 'Food Bank', description: 'Provides food assistance to low-income families' } },
  { path: '/api/ai/draft-content', body: { type: 'newsletter', context: 'Weekly community update for March' } },
  { path: '/api/ai/categorize-prayer', body: { content: 'Please pray for my mother who is in the hospital' } },
  { path: '/api/ai/translate', body: { text: 'Welcome to our community', targetLanguage: 'Spanish' } },
  { path: '/api/ai/sermon-summary', body: { title: 'Finding Peace', description: 'A sermon about inner peace in turbulent times' } },
];

describe('AI API', () => {
  beforeAll(async () => {
    await connectTestDb('ai');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_ai';
    app = createApp(testConfig);

    const aiEnabledConfig = {
      ...testConfig,
      features: { ...testConfig.features, ai: true },
    };
    aiEnabledApp = createApp(aiEnabledConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ── Feature Gate: ai disabled (default) ─────────────────────

  describe('Feature Gate (ai disabled)', () => {
    for (const endpoint of AI_ENDPOINTS) {
      it(`POST ${endpoint.path} should return 404 when ai feature is disabled`, async () => {
        const user = await createUser();
        const token = makeToken(user._id.toString(), 'member');

        const res = await request(app)
          .post(endpoint.path)
          .set('Authorization', `Bearer ${token}`)
          .send(endpoint.body);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      });
    }
  });

  // ── Auth Enforcement ────────────────────────────────────────

  describe('Auth Enforcement', () => {
    for (const endpoint of AI_ENDPOINTS) {
      it(`POST ${endpoint.path} should return 401 without auth`, async () => {
        const res = await request(aiEnabledApp)
          .post(endpoint.path)
          .send(endpoint.body);

        expect(res.status).toBe(401);
      });
    }
  });

  // ── AI enabled but no provider configured ───────────────────

  describe('AI enabled, no provider configured', () => {
    for (const endpoint of AI_ENDPOINTS) {
      it(`POST ${endpoint.path} should return 503 when no provider is configured`, async () => {
        const user = await createUser();
        const token = makeToken(user._id.toString(), 'member');

        const res = await request(aiEnabledApp)
          .post(endpoint.path)
          .set('Authorization', `Bearer ${token}`)
          .send(endpoint.body);

        // aiManager.isEnabled() returns false, so service returns null, route returns 503
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe('AI_UNAVAILABLE');
      });
    }
  });

  // ── Validation ──────────────────────────────────────────────

  describe('Validation', () => {
    it('POST /api/ai/summarize-resource should reject missing name', async () => {
      const user = await createUser();
      const token = makeToken(user._id.toString(), 'member');

      const res = await request(aiEnabledApp)
        .post('/api/ai/summarize-resource')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Some description' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/ai/translate should reject missing targetLanguage', async () => {
      const user = await createUser();
      const token = makeToken(user._id.toString(), 'member');

      const res = await request(aiEnabledApp)
        .post('/api/ai/translate')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/ai/sermon-summary should reject missing title', async () => {
      const user = await createUser();
      const token = makeToken(user._id.toString(), 'member');

      const res = await request(aiEnabledApp)
        .post('/api/ai/sermon-summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'A sermon about peace' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

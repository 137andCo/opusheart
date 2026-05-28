import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Fund } from '../../src/models/Fund.js';
import { Donation } from '../../src/models/Donation.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3060,
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
    cors: { origins: ['http://localhost:3061'] },
    features: {
      giving: true, attendance: false, memberCare: true, sms: false,
      connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
    },
    instance: { name: 'Test Church', url: 'http://localhost:3060' },
    vertical: 'church',
    ...overrides,
  };
}

const testConfig = makeConfig();

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

async function createFundViaApi(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/giving/funds')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Building Fund', description: 'New building project', goal: 50000, active: true, ...overrides });
  return res;
}

describe('Giving API', () => {
  beforeAll(async () => {
    await connectTestDb('giving');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_giving';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── Feature Gate ──────────────────────────────────────────

  describe('Feature Gate', () => {
    it('should return 404 when giving feature is disabled', async () => {
      const disabledConfig = makeConfig({
        features: { ...testConfig.features, giving: false },
      });
      const disabledApp = createApp(disabledConfig);

      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const res = await request(disabledApp)
        .get('/api/giving/funds')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── Fund CRUD ─────────────────────────────────────────────

  describe('Fund CRUD', () => {
    it('should create a fund', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const res = await createFundViaApi(token);

      expect(res.status).toBe(201);
      expect(res.body.fund).toBeDefined();
      expect(res.body.fund.name).toBe('Building Fund');
      expect(res.body.fund.goal).toBe(50000);
      expect(res.body.fund.raised).toBe(0);
      expect(res.body.fund.active).toBe(true);
    });

    it('should list all funds', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      await createFundViaApi(token, { name: 'Fund A' });
      await createFundViaApi(token, { name: 'Fund B' });

      const res = await request(app)
        .get('/api/giving/funds')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.funds).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should update a fund', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const createRes = await createFundViaApi(token);
      const fundId = createRes.body.fund.id;

      const res = await request(app)
        .put(`/api/giving/funds/${fundId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Fund', goal: 100000 });

      expect(res.status).toBe(200);
      expect(res.body.fund.name).toBe('Updated Fund');
      expect(res.body.fund.goal).toBe(100000);
    });

    it('should delete a fund', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const createRes = await createFundViaApi(token);
      const fundId = createRes.body.fund.id;

      const res = await request(app)
        .delete(`/api/giving/funds/${fundId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const check = await Fund.findById(fundId);
      expect(check).toBeNull();
    });

    it('should return 404 for non-existent fund update', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .put(`/api/giving/funds/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nope' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FUND_NOT_FOUND');
    });
  });

  // ─── Public Funds ──────────────────────────────────────────

  describe('GET /api/giving/funds/public', () => {
    it('should return only active funds without auth', async () => {
      // Create funds directly in DB (public route, no feature gate)
      await Fund.create({ name: 'Active Fund', description: 'Open', active: true });
      await Fund.create({ name: 'Inactive Fund', description: 'Closed', active: false });

      const res = await request(app).get('/api/giving/funds/public');

      expect(res.status).toBe(200);
      expect(res.body.funds).toHaveLength(1);
      expect(res.body.funds[0].name).toBe('Active Fund');
    });

    it('should work without authentication', async () => {
      const res = await request(app).get('/api/giving/funds/public');

      expect(res.status).toBe(200);
      expect(res.body.funds).toBeDefined();
    });
  });

  // ─── Record Donation ───────────────────────────────────────

  describe('POST /api/giving/donations', () => {
    it('should record a donation and increment fund.raised', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      // Create fund first
      const fundRes = await createFundViaApi(pastorToken);
      const fundId = fundRes.body.fund.id;

      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ amount: 100, fund: fundId, method: 'online' });

      expect(res.status).toBe(201);
      expect(res.body.donation).toBeDefined();
      expect(res.body.donation.amount).toBe(100);
      expect(res.body.donation.status).toBe('completed');

      // Verify fund.raised was incremented
      const updatedFund = await Fund.findById(fundId);
      expect(updatedFund!.raised).toBe(100);
    });

    it('should return 404 for donation to non-existent fund', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 50, fund: fakeId, method: 'cash' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FUND_NOT_FOUND');
    });
  });

  // ─── Donation Listing ──────────────────────────────────────

  describe('GET /api/giving/donations', () => {
    it('should allow admin to list all donations', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');

      // Create fund and donation
      const fundRes = await createFundViaApi(adminToken);
      const fundId = fundRes.body.fund.id;

      await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 200, fund: fundId, method: 'check' });

      const res = await request(app)
        .get('/api/giving/donations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.donations).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should deny member access to all donations', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .get('/api/giving/donations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── My Donations ──────────────────────────────────────────

  describe('GET /api/giving/donations/mine', () => {
    it('should return only the current member\'s donations', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const fundRes = await createFundViaApi(pastorToken);
      const fundId = fundRes.body.fund.id;

      const member1 = await createUser({ role: 'member' });
      const token1 = makeToken(member1._id.toString(), 'member');
      const member2 = await createUser({ role: 'member' });
      const token2 = makeToken(member2._id.toString(), 'member');

      // Member 1 donates
      await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${token1}`)
        .send({ amount: 50, fund: fundId, method: 'online' });

      // Member 2 donates
      await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${token2}`)
        .send({ amount: 75, fund: fundId, method: 'cash' });

      const res = await request(app)
        .get('/api/giving/donations/mine')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.donations).toHaveLength(1);
      expect(res.body.donations[0].amount).toBe(50);
    });
  });

  // ─── Refund ────────────────────────────────────────────────

  describe('POST /api/giving/donations/:id/refund', () => {
    it('should refund a donation and decrement fund.raised', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const fundRes = await createFundViaApi(pastorToken);
      const fundId = fundRes.body.fund.id;

      // Record a donation
      const donationRes = await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${pastorToken}`)
        .send({ amount: 250, fund: fundId, method: 'online' });

      const donationId = donationRes.body.donation.id;

      // Verify fund.raised before refund
      let fund = await Fund.findById(fundId);
      expect(fund!.raised).toBe(250);

      // Refund
      const res = await request(app)
        .post(`/api/giving/donations/${donationId}/refund`)
        .set('Authorization', `Bearer ${pastorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.donation.status).toBe('refunded');

      // Verify fund.raised was decremented
      fund = await Fund.findById(fundId);
      expect(fund!.raised).toBe(0);
    });

    it('should return 400 when refunding already refunded donation', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const fundRes = await createFundViaApi(pastorToken);
      const fundId = fundRes.body.fund.id;

      const donationRes = await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${pastorToken}`)
        .send({ amount: 100, fund: fundId, method: 'online' });

      const donationId = donationRes.body.donation.id;

      // First refund
      await request(app)
        .post(`/api/giving/donations/${donationId}/refund`)
        .set('Authorization', `Bearer ${pastorToken}`);

      // Second refund attempt
      const res = await request(app)
        .post(`/api/giving/donations/${donationId}/refund`)
        .set('Authorization', `Bearer ${pastorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_REFUNDED');
    });

    it('should deny member access to refund', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/giving/donations/${fakeId}/refund`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── Statement Generation ─────────────────────────────────

  describe('GET /api/giving/statements/:year', () => {
    it('should aggregate completed donations for the year', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const fundRes = await createFundViaApi(pastorToken);
      const fundId = fundRes.body.fund.id;

      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      // Record two donations
      await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ amount: 100, fund: fundId, method: 'online' });

      await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ amount: 200, fund: fundId, method: 'cash' });

      const currentYear = new Date().getFullYear();
      const res = await request(app)
        .get(`/api/giving/statements/${currentYear}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.statement).toBeDefined();
      expect(res.body.statement.year).toBe(currentYear);
      expect(res.body.statement.totalAmount).toBe(300);
      expect(res.body.statement.donations).toHaveLength(2);
    });

    it('should return empty statement for year with no donations', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .get('/api/giving/statements/2020')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.statement.totalAmount).toBe(0);
      expect(res.body.statement.donations).toHaveLength(0);
    });
  });

  // ─── Recurring Validation ─────────────────────────────────

  describe('Recurring Validation', () => {
    it('should reject recurring donation without schedule', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const fundRes = await createFundViaApi(pastorToken);
      const fundId = fundRes.body.fund.id;

      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 50, fund: fundId, method: 'online', recurring: true });

      expect(res.status).toBe(400);
    });

    it('should accept recurring donation with schedule', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const fundRes = await createFundViaApi(pastorToken);
      const fundId = fundRes.body.fund.id;

      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .post('/api/giving/donations')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 50, fund: fundId, method: 'online', recurring: true, recurringSchedule: 'monthly' });

      expect(res.status).toBe(201);
      expect(res.body.donation.recurring).toBe(true);
      expect(res.body.donation.recurringSchedule).toBe('monthly');
    });
  });

  // ─── Auth Enforcement ──────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should return 401 for GET /api/giving/funds without token', async () => {
      const res = await request(app).get('/api/giving/funds');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/giving/donations without token', async () => {
      const res = await request(app)
        .post('/api/giving/donations')
        .send({ amount: 50, fund: 'somefund', method: 'online' });
      expect(res.status).toBe(401);
    });

    it('should allow GET /api/giving/funds/public without auth', async () => {
      const res = await request(app).get('/api/giving/funds/public');
      expect(res.status).toBe(200);
      expect(res.body.funds).toBeDefined();
    });
  });
});

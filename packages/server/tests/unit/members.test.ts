import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Member } from '../../src/models/Member.js';
import { Household } from '../../src/models/Household.js';
import { MemberCareNote } from '../../src/models/MemberCareNote.js';
import { FeatureConfig } from '../../src/models/FeatureConfig.js';
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
    giving: false, attendance: false, memberCare: true, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3020' },
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

describe('Member Management', () => {
  beforeAll(async () => {
    await connectTestDb('members');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_members';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // Helper to create a user directly in the DB (bypassing auth registration)
  async function createUser(overrides: Record<string, unknown> = {}) {
    return User.create({
      email: `user-${Date.now()}@church.org`,
      emailHash: `hash-${Date.now()}`,
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

  describe('Member CRUD', () => {
    it('should create a member (pastor)', async () => {
      const pastor = await createUser({ role: 'pastor', firstName: 'Pastor', lastName: 'Jim' });
      const user = await createUser({ firstName: 'Jane', lastName: 'Doe' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const res = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString(), membershipStatus: 'active' });

      expect(res.status).toBe(201);
      expect(res.body.member).toBeDefined();
      expect(res.body.member.membershipStatus).toBe('active');
    });

    it('should reject member creation by regular member', async () => {
      const regularUser = await createUser({ role: 'member' });
      const user = await createUser();
      const token = makeToken(regularUser._id.toString(), 'member');

      const res = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject duplicate member for same user', async () => {
      const admin = await createUser({ role: 'admin' });
      const user = await createUser();
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString() });

      const res = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString() });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MEMBER_EXISTS');
    });

    it('should get a member by ID', async () => {
      const admin = await createUser({ role: 'admin' });
      const user = await createUser({ firstName: 'GetMe', lastName: 'Now' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString(), membershipStatus: 'active' });

      const memberId = createRes.body.member.id;
      const res = await request(app)
        .get(`/api/members/${memberId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.member).toBeDefined();
    });

    it('should update a member', async () => {
      const admin = await createUser({ role: 'admin' });
      const user = await createUser();
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString(), membershipStatus: 'visitor' });

      const memberId = createRes.body.member.id;
      const res = await request(app)
        .put(`/api/members/${memberId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipStatus: 'active', attendanceOptIn: true });

      expect(res.status).toBe(200);
      expect(res.body.member.membershipStatus).toBe('active');
      expect(res.body.member.attendanceOptIn).toBe(true);
    });

    it('should archive (soft delete) a member — admin only', async () => {
      const admin = await createUser({ role: 'admin' });
      const user = await createUser();
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString(), membershipStatus: 'active' });

      const memberId = createRes.body.member.id;
      const res = await request(app)
        .delete(`/api/members/${memberId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member archived');

      // Verify archived
      const check = await Member.findById(memberId);
      expect(check?.membershipStatus).toBe('archived');
    });

    it('should reject delete by pastor (admin only)', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const user = await createUser();
      const adminUser = await createUser({ role: 'admin' });
      const adminToken = makeToken(adminUser._id.toString(), 'admin');
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: user._id.toString() });

      const memberId = createRes.body.member.id;
      const res = await request(app)
        .delete(`/api/members/${memberId}`)
        .set('Authorization', `Bearer ${pastorToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Member List + Pagination', () => {
    it('should list members with pagination', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      // Create 3 members
      for (let i = 0; i < 3; i++) {
        const u = await createUser({ firstName: `Member${i}`, lastName: 'Test' });
        await request(app)
          .post('/api/members')
          .set('Authorization', `Bearer ${token}`)
          .send({ userId: u._id.toString(), membershipStatus: 'active' });
      }

      const res = await request(app)
        .get('/api/members?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(3);
      expect(res.body.totalPages).toBe(2);
    });

    it('should filter members by status', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const u1 = await createUser({ firstName: 'Active', lastName: 'One' });
      const u2 = await createUser({ firstName: 'Visitor', lastName: 'Two' });

      await request(app).post('/api/members').set('Authorization', `Bearer ${token}`)
        .send({ userId: u1._id.toString(), membershipStatus: 'active' });
      await request(app).post('/api/members').set('Authorization', `Bearer ${token}`)
        .send({ userId: u2._id.toString(), membershipStatus: 'visitor' });

      const res = await request(app)
        .get('/api/members?status=active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('Privacy Filtering', () => {
    it('should hide email/phone for non-pastor users when privacy settings are off', async () => {
      const admin = await createUser({ role: 'admin' });
      const memberUser = await createUser({
        role: 'member',
        firstName: 'Private',
        lastName: 'Person',
        phone: '555-1234',
        privacySettings: {
          showInDirectory: true,
          showEmail: false,
          showPhone: false,
          allowCareTracking: false,
        },
      });
      const viewerUser = await createUser({ role: 'member', firstName: 'Viewer', lastName: 'Guy' });

      const adminToken = makeToken(admin._id.toString(), 'admin');
      const viewerToken = makeToken(viewerUser._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUser._id.toString(), membershipStatus: 'active' });

      const memberId = createRes.body.member.id;

      // Viewer (regular member) should NOT see email/phone
      const res = await request(app)
        .get(`/api/members/${memberId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const user = res.body.member.userId;
      expect(user.email).toBeUndefined();
      expect(user.phone).toBeUndefined();
    });

    it('should show all fields for pastor/admin', async () => {
      const admin = await createUser({ role: 'admin' });
      const memberUser = await createUser({
        firstName: 'Full',
        lastName: 'Visible',
        phone: '555-9999',
        privacySettings: {
          showInDirectory: true,
          showEmail: false,
          showPhone: false,
          allowCareTracking: false,
        },
      });

      const adminToken = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUser._id.toString(), membershipStatus: 'active' });

      const memberId = createRes.body.member.id;

      // Admin should see all fields regardless of privacy settings
      const res = await request(app)
        .get(`/api/members/${memberId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const user = res.body.member.userId;
      // Admin sees everything — privacy filter not applied
      expect(user.firstName).toBeDefined();
      expect(user.lastName).toBeDefined();
    });
  });

  describe('Household Management', () => {
    it('should create a household', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/households')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'The Smiths',
          address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
        });

      expect(res.status).toBe(201);
      expect(res.body.household.name).toBe('The Smiths');
    });

    it('should add and remove a member from household', async () => {
      const admin = await createUser({ role: 'admin' });
      const user = await createUser({ firstName: 'Family', lastName: 'Member' });
      const token = makeToken(admin._id.toString(), 'admin');

      // Create member
      const memberRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString(), membershipStatus: 'active' });
      const memberId = memberRes.body.member.id;

      // Create household
      const hhRes = await request(app)
        .post('/api/households')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'The Does' });
      const householdId = hhRes.body.household.id;

      // Add member to household
      const addRes = await request(app)
        .post(`/api/households/${householdId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ memberId });

      expect(addRes.status).toBe(200);

      // Verify member's householdId was updated
      const memberCheck = await Member.findById(memberId);
      expect(memberCheck?.householdId?.toString()).toBe(householdId);

      // Remove member from household
      const removeRes = await request(app)
        .delete(`/api/households/${householdId}/members/${memberId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(removeRes.status).toBe(200);

      // Verify member's householdId was cleared
      const memberAfter = await Member.findById(memberId);
      expect(memberAfter?.householdId).toBeUndefined();
    });

    it('should list households with pagination', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app).post('/api/households').set('Authorization', `Bearer ${token}`)
        .send({ name: 'Household A' });
      await request(app).post('/api/households').set('Authorization', `Bearer ${token}`)
        .send({ name: 'Household B' });

      const res = await request(app)
        .get('/api/households?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(2);
    });
  });

  describe('Care Notes (Feature-Gated)', () => {
    it('should create a care note (pastor)', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const user = await createUser({ privacySettings: { showInDirectory: true, showEmail: true, showPhone: true, allowCareTracking: true } });
      const token = makeToken(pastor._id.toString(), 'pastor');

      // Create member first
      const memberRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString(), membershipStatus: 'active' });
      const memberId = memberRes.body.member.id;

      const res = await request(app)
        .post('/api/care')
        .set('Authorization', `Bearer ${token}`)
        .send({
          memberId,
          type: 'hospital',
          content: 'Admitted for surgery, please pray.',
        });

      expect(res.status).toBe(201);
      expect(res.body.careNote.type).toBe('hospital');
      expect(res.body.careNote.resolved).toBe(false);
    });

    it('should reject care note creation by regular member', async () => {
      const regularUser = await createUser({ role: 'member' });
      const token = makeToken(regularUser._id.toString(), 'member');

      const res = await request(app)
        .post('/api/care')
        .set('Authorization', `Bearer ${token}`)
        .send({
          memberId: new mongoose.Types.ObjectId().toString(),
          type: 'general',
          content: 'Some note',
        });

      expect(res.status).toBe(403);
    });

    it('should list care notes for a member', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const user = await createUser({ privacySettings: { showInDirectory: true, showEmail: true, showPhone: true, allowCareTracking: true } });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const memberRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString() });
      const memberId = memberRes.body.member.id;

      // Create two notes
      await request(app).post('/api/care').set('Authorization', `Bearer ${token}`)
        .send({ memberId, type: 'visit', content: 'Home visit completed' });
      await request(app).post('/api/care').set('Authorization', `Bearer ${token}`)
        .send({ memberId, type: 'follow_up', content: 'Need to follow up next week' });

      const res = await request(app)
        .get(`/api/care/${memberId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(2);
    });

    it('should resolve a care note', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const user = await createUser({ privacySettings: { showInDirectory: true, showEmail: true, showPhone: true, allowCareTracking: true } });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const memberRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString() });
      const memberId = memberRes.body.member.id;

      const createRes = await request(app)
        .post('/api/care')
        .set('Authorization', `Bearer ${token}`)
        .send({ memberId, type: 'meal_train', content: 'Meals delivered' });

      const noteId = createRes.body.careNote.id;

      const res = await request(app)
        .patch(`/api/care/${noteId}/resolve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.careNote.resolved).toBe(true);
    });

    it('should reject care note creation without member consent', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const user = await createUser({ privacySettings: { showInDirectory: true, showEmail: true, showPhone: true, allowCareTracking: false } });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const memberRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user._id.toString() });
      const memberId = memberRes.body.member.id;

      const res = await request(app)
        .post('/api/care')
        .set('Authorization', `Bearer ${token}`)
        .send({ memberId, type: 'general', content: 'no consent given' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CARE_CONSENT_REQUIRED');
    });

    it('should forbid a non-author pastor from resolving another pastor\'s note', async () => {
      const authorPastor = await createUser({ role: 'pastor' });
      const otherPastor = await createUser({ role: 'pastor' });
      const user = await createUser({ privacySettings: { showInDirectory: true, showEmail: true, showPhone: true, allowCareTracking: true } });
      const authorToken = makeToken(authorPastor._id.toString(), 'pastor');
      const otherToken = makeToken(otherPastor._id.toString(), 'pastor');

      const memberRes = await request(app)
        .post('/api/members')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ userId: user._id.toString() });
      const memberId = memberRes.body.member.id;

      const createRes = await request(app)
        .post('/api/care')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ memberId, type: 'visit', content: 'visited' });
      const noteId = createRes.body.careNote.id;

      const res = await request(app)
        .patch(`/api/care/${noteId}/resolve`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 when memberCare feature is disabled', async () => {
      // Create a separate app with memberCare disabled
      const disabledConfig = {
        ...testConfig,
        features: { ...testConfig.features, memberCare: false },
      };
      const disabledApp = createApp(disabledConfig);

      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const res = await request(disabledApp)
        .post('/api/care')
        .set('Authorization', `Bearer ${token}`)
        .send({
          memberId: new mongoose.Types.ObjectId().toString(),
          type: 'general',
          content: 'Test note',
        });

      // Feature disabled = 404 (not 403)
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});

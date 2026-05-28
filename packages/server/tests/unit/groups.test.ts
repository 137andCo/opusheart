import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Group } from '../../src/models/Group.js';
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

const sampleGroup = {
  name: 'Youth Bible Study',
  description: 'Weekly study for ages 13-18',
  type: 'bible_study',
  visibility: 'public',
};

function buildGroup(overrides: Record<string, unknown> = {}) {
  return { ...sampleGroup, ...overrides };
}

describe('Group API', () => {
  beforeAll(async () => {
    await connectTestDb('groups');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_groups';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── POST /api/groups ──────────────────────────────────────

  describe('POST /api/groups', () => {
    it('should create a group with creator as leader', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup());

      expect(res.status).toBe(201);
      expect(res.body.group).toBeDefined();
      expect(res.body.group.name).toBe('Youth Bible Study');
      expect(res.body.group.createdBy).toBe(user._id.toString());
      expect(res.body.group.members).toHaveLength(1);
      expect(res.body.group.members[0].role).toBe('leader');
      expect(res.body.group.members[0].userId).toBe(user._id.toString());
    });

    it('should reject a group with invalid name', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', description: 'Some group', type: 'bible_study' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /api/groups/public ────────────────────────────────

  describe('GET /api/groups/public', () => {
    it('should return only public active groups', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Public Group', visibility: 'public' }));
      await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Members Only', visibility: 'members' }));
      await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Invite Only', visibility: 'invite_only' }));

      const res = await request(app).get('/api/groups/public');

      expect(res.status).toBe(200);
      expect(res.body.groups).toHaveLength(1);
      expect(res.body.groups[0].name).toBe('Public Group');
    });

    it('should not return inactive public groups', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      // Create a public group then deactivate it
      const createRes = await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Deactivated', visibility: 'public' }));
      const groupId = createRes.body.group.id;

      await request(app).put(`/api/groups/${groupId}`).set('Authorization', `Bearer ${token}`)
        .send({ active: false });

      const res = await request(app).get('/api/groups/public');

      expect(res.status).toBe(200);
      expect(res.body.groups).toHaveLength(0);
    });
  });

  // ─── GET /api/groups (auth'd) ─────────────────────────────

  describe('GET /api/groups', () => {
    it('should list all groups', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Group A' }));
      await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Group B', visibility: 'members' }));

      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.groups).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter by type', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Bible Study', type: 'bible_study' }));
      await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ name: 'Committee', type: 'committee' }));

      const res = await request(app)
        .get('/api/groups?type=committee')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.groups).toHaveLength(1);
      expect(res.body.groups[0].name).toBe('Committee');
    });
  });

  // ─── GET /api/groups/mine ─────────────────────────────────

  describe('GET /api/groups/mine', () => {
    it('should return only groups the user belongs to', async () => {
      const user1 = await createUser({ role: 'admin' });
      const token1 = makeToken(user1._id.toString(), 'admin');
      const user2 = await createUser({ role: 'member' });
      const token2 = makeToken(user2._id.toString(), 'member');

      // User1 creates two groups (auto-joined as leader)
      await request(app).post('/api/groups').set('Authorization', `Bearer ${token1}`)
        .send(buildGroup({ name: 'User1 Group' }));
      // User2 creates one group
      await request(app).post('/api/groups').set('Authorization', `Bearer ${token2}`)
        .send(buildGroup({ name: 'User2 Group' }));

      const res = await request(app)
        .get('/api/groups/mine')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.groups).toHaveLength(1);
      expect(res.body.groups[0].name).toBe('User2 Group');
    });
  });

  // ─── GET /api/groups/:id ──────────────────────────────────

  describe('GET /api/groups/:id', () => {
    it('should return a group by ID', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup());

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.group.name).toBe('Youth Bible Study');
    });

    it('should return 404 for non-existent group', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/groups/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('GROUP_NOT_FOUND');
    });
  });

  // ─── PUT /api/groups/:id ──────────────────────────────────

  describe('PUT /api/groups/:id', () => {
    it('should update group name', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup());

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Study Group' });

      expect(res.status).toBe(200);
      expect(res.body.group.name).toBe('Updated Study Group');
    });

    it('should do a partial update without affecting other fields', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup({ location: 'Room 101' }));

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ location: 'Room 202' });

      expect(res.status).toBe(200);
      expect(res.body.group.location).toBe('Room 202');
      expect(res.body.group.name).toBe('Youth Bible Study');
    });
  });

  // ─── DELETE /api/groups/:id ───────────────────────────────

  describe('DELETE /api/groups/:id', () => {
    it('should delete a group', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup());

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const check = await Group.findById(groupId);
      expect(check).toBeNull();
    });

    it('should return 404 for non-existent group', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .delete(`/api/groups/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('GROUP_NOT_FOUND');
    });
  });

  // ─── POST /api/groups/:id/join ────────────────────────────

  describe('POST /api/groups/:id/join', () => {
    it('should join a public group', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup({ visibility: 'public' }));

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .post(`/api/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.group.members).toHaveLength(2);
      expect(res.body.group.members[1].userId).toBe(member._id.toString());
    });

    it('should reject joining an invite_only group (403)', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup({ visibility: 'invite_only' }));

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .post(`/api/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INVITE_ONLY');
    });

    it('should reject duplicate join (ALREADY_MEMBER)', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup({ visibility: 'public' }));

      const groupId = createRes.body.group.id;
      // Admin is already a member (creator)
      const res = await request(app)
        .post(`/api/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_MEMBER');
    });

    it('should reject join when group is full (GROUP_FULL)', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const member1 = await createUser({ role: 'member' });
      const member1Token = makeToken(member1._id.toString(), 'member');
      const member2 = await createUser({ role: 'member' });
      const member2Token = makeToken(member2._id.toString(), 'member');

      // maxMembers=2, creator fills one slot
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup({ visibility: 'public', maxMembers: 2 }));

      const groupId = createRes.body.group.id;

      // member1 joins, filling the group to capacity
      await request(app)
        .post(`/api/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${member1Token}`);

      // member2 should be rejected
      const res = await request(app)
        .post(`/api/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${member2Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('GROUP_FULL');
    });
  });

  // ─── POST /api/groups/:id/leave ───────────────────────────

  describe('POST /api/groups/:id/leave', () => {
    it('should leave a group', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup({ visibility: 'public' }));

      const groupId = createRes.body.group.id;

      // Member joins then leaves
      await request(app)
        .post(`/api/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${memberToken}`);

      const res = await request(app)
        .post(`/api/groups/${groupId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.group.members).toHaveLength(1); // only admin remains
    });

    it('should reject leave for non-member (NOT_MEMBER)', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const member = await createUser({ role: 'member' });
      const memberToken = makeToken(member._id.toString(), 'member');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup());

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .post(`/api/groups/${groupId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_MEMBER');
    });
  });

  // ─── POST /api/groups/:id/invite/:userId ──────────────────

  describe('POST /api/groups/:id/invite/:userId', () => {
    it('should add a user to the group', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const invitee = await createUser({ role: 'member' });

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup({ visibility: 'invite_only' }));

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite/${invitee._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.group.members).toHaveLength(2);
      expect(res.body.group.members[1].userId).toBe(invitee._id.toString());
    });
  });

  // ─── PATCH /api/groups/:id/promote/:userId ────────────────

  describe('PATCH /api/groups/:id/promote/:userId', () => {
    it('should promote a member to leader', async () => {
      const admin = await createUser({ role: 'admin' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const member = await createUser({ role: 'member' });

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildGroup({ visibility: 'public' }));

      const groupId = createRes.body.group.id;

      // Invite user first
      await request(app)
        .post(`/api/groups/${groupId}/invite/${member._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/groups/${groupId}/promote/${member._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const promoted = res.body.group.members.find((m: any) => m.userId === member._id.toString());
      expect(promoted.role).toBe('leader');
    });
  });

  // ─── POST /api/groups/:id/materials ───────────────────────

  describe('POST /api/groups/:id/materials', () => {
    it('should add a material with valid URL', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup());

      const groupId = createRes.body.group.id;
      const res = await request(app)
        .post(`/api/groups/${groupId}/materials`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Study Guide',
          type: 'document',
          url: 'https://example.com/guide.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.group.materials).toHaveLength(1);
      expect(res.body.group.materials[0].title).toBe('Study Guide');
      expect(res.body.group.materials[0].url).toBe('https://example.com/guide.pdf');
    });
  });

  // ─── DELETE /api/groups/:id/materials/:materialId ─────────

  describe('DELETE /api/groups/:id/materials/:materialId', () => {
    it('should remove a material', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup());

      const groupId = createRes.body.group.id;

      // Add material
      const matRes = await request(app)
        .post(`/api/groups/${groupId}/materials`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Study Guide',
          type: 'link',
          url: 'https://example.com/guide',
        });

      const materialId = matRes.body.group.materials[0].id || matRes.body.group.materials[0]._id;

      const res = await request(app)
        .delete(`/api/groups/${groupId}/materials/${materialId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.group.materials).toHaveLength(0);
    });

    it('should return 404 for non-existent material', async () => {
      const user = await createUser({ role: 'admin' });
      const token = makeToken(user._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(buildGroup());

      const groupId = createRes.body.group.id;
      const fakeMaterialId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .delete(`/api/groups/${groupId}/materials/${fakeMaterialId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MATERIAL_NOT_FOUND');
    });
  });

  // ─── Auth Enforcement ─────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should return 401 for GET /api/groups without token', async () => {
      const res = await request(app).get('/api/groups');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/groups without token', async () => {
      const res = await request(app).post('/api/groups').send(buildGroup());
      expect(res.status).toBe(401);
    });

    it('should return 401 for PUT /api/groups/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).put(`/api/groups/${fakeId}`).send({ name: 'Nope' });
      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/groups/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/groups/${fakeId}`);
      expect(res.status).toBe(401);
    });

    it('should return 401 for GET /api/groups/mine without token', async () => {
      const res = await request(app).get('/api/groups/mine');
      expect(res.status).toBe(401);
    });

    it('should allow GET /api/groups/public without token', async () => {
      const res = await request(app).get('/api/groups/public');
      expect(res.status).toBe(200);
    });
  });
});

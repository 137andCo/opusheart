import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Resource } from '../../src/models/Resource.js';
import { ResourceSubmission } from '../../src/models/ResourceSubmission.js';
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

function sampleResource(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Food Bank',
    description: 'Free food for families in need',
    category: 'food',
    provider: 'Hope Ministries',
    eligibility: 'Open to all',
    hours: 'Mon-Fri 9-5',
    phone: '555-1234',
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      country: 'US',
    },
    languages: ['en'],
    tags: ['food', 'free'],
    ...overrides,
  };
}

describe('Community Resource Hub', () => {
  beforeAll(async () => {
    await connectTestDb('resources');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_resources';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    // Re-create indexes after dropping collections (required for $text and $near queries)
    await Resource.syncIndexes();
    await ResourceSubmission.syncIndexes();
  });

  // ─── Resource CRUD (Admin) ──────────────────────────────────────

  describe('Resource CRUD', () => {
    it('should create a resource (admin, auto-approved)', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource());

      expect(res.status).toBe(201);
      expect(res.body.resource).toBeDefined();
      expect(res.body.resource.name).toBe('Test Food Bank');
      expect(res.body.resource.approved).toBe(true);
      expect(res.body.resource.submittedBy).toBe(admin._id.toString());
    });

    it('should create a resource (pastor)', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const res = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Pastor Resource' }));

      expect(res.status).toBe(201);
      expect(res.body.resource.name).toBe('Pastor Resource');
      expect(res.body.resource.approved).toBe(true);
    });

    it('should get a resource by ID (admin)', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource());

      const resourceId = createRes.body.resource.id;
      const res = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.resource.name).toBe('Test Food Bank');
    });

    it('should update a resource', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource());

      const resourceId = createRes.body.resource.id;
      const res = await request(app)
        .put(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Food Bank' });

      expect(res.status).toBe(200);
      expect(res.body.resource.name).toBe('Updated Food Bank');
    });

    it('should delete a resource (admin only)', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource());

      const resourceId = createRes.body.resource.id;
      const res = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Resource deleted');

      // Verify it's actually gone
      const check = await Resource.findById(resourceId);
      expect(check).toBeNull();
    });

    it('should reject delete by pastor (admin only)', async () => {
      const admin = await createUser({ role: 'admin' });
      const pastor = await createUser({ role: 'pastor' });
      const adminToken = makeToken(admin._id.toString(), 'admin');
      const pastorToken = makeToken(pastor._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sampleResource());

      const resourceId = createRes.body.resource.id;
      const res = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${pastorToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── Public Endpoints ─────────────────────────────────────────

  describe('Public Endpoints', () => {
    it('should list only approved resources on public endpoint', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      // Create an approved resource
      await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Approved Resource' }));

      // Create an unapproved resource directly in DB
      await Resource.create({
        ...sampleResource({ name: 'Unapproved Resource' }),
        approved: false,
        submittedBy: admin._id,
      });

      // Public endpoint should only return approved
      const res = await request(app).get('/api/resources/public');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Approved Resource');
    });

    it('should get approved resource by ID on public endpoint', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource());

      const resourceId = createRes.body.resource.id;

      // No auth required
      const res = await request(app).get(`/api/resources/public/${resourceId}`);

      expect(res.status).toBe(200);
      expect(res.body.resource.name).toBe('Test Food Bank');
    });

    it('should return 404 for unapproved resource on public endpoint', async () => {
      const admin = await createUser({ role: 'admin' });
      const resource = await Resource.create({
        ...sampleResource(),
        approved: false,
        submittedBy: admin._id,
      });

      const res = await request(app).get(`/api/resources/public/${resource._id}`);

      expect(res.status).toBe(404);
    });

    it('should not require auth for public endpoints', async () => {
      const res = await request(app).get('/api/resources/public');
      expect(res.status).toBe(200);
    });
  });

  // ─── Community Submission Flow ──────────────────────────────────

  describe('Community Submission Flow', () => {
    it('should submit a resource without auth (public submission)', async () => {
      const res = await request(app)
        .post('/api/resources/public/submit')
        .send({
          ...sampleResource(),
          submitterName: 'Jane Community',
          submitterEmail: 'jane@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.submission).toBeDefined();
      expect(res.body.submission.status).toBe('pending');
      expect(res.body.submission.submitterName).toBe('Jane Community');
    });

    it('should approve a submission and create a resource', async () => {
      // Submit
      const submitRes = await request(app)
        .post('/api/resources/public/submit')
        .send({
          ...sampleResource({ name: 'Community Submitted Resource' }),
          submitterName: 'Bob Helper',
          submitterEmail: 'bob@example.com',
        });

      const submissionId = submitRes.body.submission.id;

      // Approve (admin)
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const approveRes = await request(app)
        .patch(`/api/submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.submission.status).toBe('approved');

      // Verify resource was created
      const resources = await Resource.find({ name: 'Community Submitted Resource' });
      expect(resources.length).toBe(1);
      expect(resources[0]!.approved).toBe(true);
    });

    it('should reject a submission with notes', async () => {
      const submitRes = await request(app)
        .post('/api/resources/public/submit')
        .send({
          ...sampleResource({ name: 'Sketchy Resource' }),
          submitterName: 'Spammer',
          submitterEmail: 'spam@example.com',
        });

      const submissionId = submitRes.body.submission.id;

      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const rejectRes = await request(app)
        .patch(`/api/submissions/${submissionId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'This resource does not appear to be legitimate.' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.submission.status).toBe('rejected');
      expect(rejectRes.body.submission.reviewNotes).toBe('This resource does not appear to be legitimate.');

      // Verify no resource was created
      const resources = await Resource.find({ name: 'Sketchy Resource' });
      expect(resources.length).toBe(0);
    });

    it('should not allow double-review of a submission', async () => {
      const submitRes = await request(app)
        .post('/api/resources/public/submit')
        .send({
          ...sampleResource(),
          submitterName: 'Test',
          submitterEmail: 'test@example.com',
        });

      const submissionId = submitRes.body.submission.id;
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      // Approve first
      await request(app)
        .patch(`/api/submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      // Try to reject — should fail
      const rejectRes = await request(app)
        .patch(`/api/submissions/${submissionId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Too late' });

      expect(rejectRes.status).toBe(400);
      expect(rejectRes.body.error.code).toBe('ALREADY_REVIEWED');
    });
  });

  // ─── Category Filtering ──────────────────────────────────────

  describe('Category Filtering', () => {
    it('should filter resources by category', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Food Place', category: 'food' }));
      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Housing Help', category: 'housing' }));

      const res = await request(app).get('/api/resources/public?category=food');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Food Place');
    });
  });

  // ─── Text Search ─────────────────────────────────────────────

  describe('Text Search', () => {
    it('should search resources by text', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Emergency Shelter', description: 'Overnight shelter for homeless individuals' }));
      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Food Pantry', description: 'Free groceries weekly' }));

      const res = await request(app).get('/api/resources/public?search=shelter');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Emergency Shelter');
    });
  });

  // ─── Stale Resource Detection ─────────────────────────────────

  describe('Stale Resource Detection', () => {
    it('should identify stale resources', async () => {
      const admin = await createUser({ role: 'admin' });

      // Create resource verified 90 days ago
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 90);

      await Resource.create({
        ...sampleResource({ name: 'Stale Resource' }),
        approved: true,
        submittedBy: admin._id,
        verifiedBy: admin._id,
        lastVerified: staleDate,
      });

      // Create fresh resource
      await Resource.create({
        ...sampleResource({ name: 'Fresh Resource' }),
        approved: true,
        submittedBy: admin._id,
        verifiedBy: admin._id,
        lastVerified: new Date(),
      });

      // Import the service directly to test findStale
      const { ResourceService } = await import('../../src/services/resource.service.js');
      const service = new ResourceService();
      const stale = await service.findStale(30);

      expect(stale.length).toBe(1);
      expect(stale[0]!.name).toBe('Stale Resource');
    });
  });

  // ─── Featured Resources ───────────────────────────────────────

  describe('Featured Resources', () => {
    it('should return featured resources', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Featured One', featured: true }));
      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Not Featured', featured: false }));
      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({ name: 'Featured Two', featured: true }));

      const res = await request(app).get('/api/resources/public/featured');

      expect(res.status).toBe(200);
      expect(res.body.resources.length).toBe(2);
      const names = res.body.resources.map((r: any) => r.name);
      expect(names).toContain('Featured One');
      expect(names).toContain('Featured Two');
    });
  });

  // ─── Nearby Resources (Geo Query) ─────────────────────────────

  describe('Nearby Resources', () => {
    it('should find nearby resources within radius', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      // Create resource with location (Springfield, IL)
      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({
          name: 'Nearby Resource',
          location: { lat: 39.7817, lng: -89.6501 },
        }));

      // Create resource far away (New York)
      await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
        .send(sampleResource({
          name: 'Far Away Resource',
          location: { lat: 40.7128, lng: -74.0060 },
        }));

      // Search near Springfield
      const res = await request(app).get('/api/resources/public/nearby?lat=39.78&lng=-89.65&maxKm=10');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Nearby Resource');
    });
  });

  // ─── Resource Verification ────────────────────────────────────

  describe('Resource Verification', () => {
    it('should update lastVerified timestamp', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource());

      const resourceId = createRes.body.resource.id;
      const originalVerified = createRes.body.resource.lastVerified;

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const res = await request(app)
        .patch(`/api/resources/${resourceId}/verify`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.resource.lastVerified).toBeDefined();
      expect(new Date(res.body.resource.lastVerified).getTime())
        .toBeGreaterThanOrEqual(new Date(originalVerified).getTime());
    });
  });

  // ─── Submission Listing ───────────────────────────────────────

  describe('Submission Listing', () => {
    it('should list submissions with status filter', async () => {
      // Create some submissions
      await request(app).post('/api/resources/public/submit').send({
        ...sampleResource({ name: 'Pending 1' }),
        submitterName: 'A', submitterEmail: 'a@test.com',
      });
      await request(app).post('/api/resources/public/submit').send({
        ...sampleResource({ name: 'Pending 2' }),
        submitterName: 'B', submitterEmail: 'b@test.com',
      });

      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      // Approve one
      const submissions = await ResourceSubmission.find();
      await request(app)
        .patch(`/api/submissions/${submissions[0]!._id}/approve`)
        .set('Authorization', `Bearer ${token}`);

      // List only pending
      const res = await request(app)
        .get('/api/submissions?status=pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  // ─── Auth Enforcement ─────────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should require auth for admin resource listing', async () => {
      const res = await request(app).get('/api/resources');
      expect(res.status).toBe(401);
    });

    it('should require auth for resource creation', async () => {
      const res = await request(app)
        .post('/api/resources')
        .send(sampleResource());
      expect(res.status).toBe(401);
    });

    it('should reject resource creation by regular member', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleResource());

      expect(res.status).toBe(403);
    });

    it('should require auth for submissions listing', async () => {
      const res = await request(app).get('/api/submissions');
      expect(res.status).toBe(401);
    });

    it('should reject submissions listing by regular member', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .get('/api/submissions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── Pagination ───────────────────────────────────────────────

  describe('Pagination', () => {
    it('should paginate public resource listing', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/resources').set('Authorization', `Bearer ${token}`)
          .send(sampleResource({ name: `Resource ${i}` }));
      }

      const res = await request(app).get('/api/resources/public?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
      expect(res.body.page).toBe(1);
    });
  });

  // ─── Validation ───────────────────────────────────────────────

  describe('Validation', () => {
    it('should reject submission with missing required fields', async () => {
      const res = await request(app)
        .post('/api/resources/public/submit')
        .send({ name: 'Incomplete' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject rejection without notes', async () => {
      const submitRes = await request(app)
        .post('/api/resources/public/submit')
        .send({
          ...sampleResource(),
          submitterName: 'Test',
          submitterEmail: 'test@example.com',
        });

      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const res = await request(app)
        .patch(`/api/submissions/${submitRes.body.submission.id}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({}); // No notes

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

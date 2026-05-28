import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Sermon } from '../../src/models/Sermon.js';
import { SermonSeries } from '../../src/models/SermonSeries.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
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
    giving: false, attendance: false, memberCare: true, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3060' },
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

const sampleSermon = {
  title: 'Finding Peace in the Storm',
  speaker: 'Pastor Smith',
  date: new Date('2026-03-01'),
  description: 'A message about finding peace during difficult times.',
  scriptureReferences: ['Philippians 4:6-7', 'Psalm 46:10'],
  published: true,
  podcastInclude: true,
  audioUrl: 'https://example.com/sermon-audio.mp3',
};

function buildSermon(overrides: Record<string, unknown> = {}) {
  return { ...sampleSermon, ...overrides };
}

const sampleSeries = {
  title: 'Peace in the Storm',
  description: 'A series on finding peace.',
  startDate: new Date('2026-02-01'),
};

function buildSeries(overrides: Record<string, unknown> = {}) {
  return { ...sampleSeries, ...overrides };
}

describe('Sermons API', () => {
  beforeAll(async () => {
    await connectTestDb('sermons');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_sermons';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // ─── POST /api/sermons ──────────────────────────────────────

  describe('POST /api/sermons', () => {
    it('should create a sermon', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const res = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon());

      expect(res.status).toBe(201);
      expect(res.body.sermon).toBeDefined();
      expect(res.body.sermon.title).toBe(sampleSermon.title);
      expect(res.body.sermon.speaker).toBe(sampleSermon.speaker);
      expect(res.body.sermon.published).toBe(true);
      expect(res.body.sermon.scriptureReferences).toEqual(sampleSermon.scriptureReferences);
    });

    it('should create a sermon with series reference', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      // Create series first
      const seriesRes = await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries());

      const seriesId = seriesRes.body.series.id;

      const res = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ series: seriesId, seriesOrder: 1 }));

      expect(res.status).toBe(201);
      expect(res.body.sermon.series).toBeDefined();
      expect(res.body.sermon.seriesOrder).toBe(1);
    });

    it('should reject sermon without required title', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const res = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: '' }));

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/sermons/public ────────────────────────────────

  describe('GET /api/sermons/public', () => {
    it('should return only published sermons', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      // Create published sermon
      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ published: true }));

      // Create unpublished sermon
      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'Draft Sermon', published: false }));

      const res = await request(app).get('/api/sermons/public');

      expect(res.status).toBe(200);
      expect(res.body.sermons).toHaveLength(1);
      expect(res.body.sermons[0].title).toBe(sampleSermon.title);
    });

    it('should filter by speaker', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ speaker: 'Pastor Smith' }));

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'Other Sermon', speaker: 'Pastor Jones' }));

      const res = await request(app).get('/api/sermons/public?speaker=Pastor Smith');

      expect(res.status).toBe(200);
      expect(res.body.sermons).toHaveLength(1);
      expect(res.body.sermons[0].speaker).toBe('Pastor Smith');
    });

    it('should filter by series', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const seriesRes = await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries());

      const seriesId = seriesRes.body.series.id;

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ series: seriesId }));

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'No Series Sermon' }));

      const res = await request(app).get(`/api/sermons/public?series=${seriesId}`);

      expect(res.status).toBe(200);
      expect(res.body.sermons).toHaveLength(1);
    });

    it('should support pagination', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      // Create 3 sermons
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/sermons')
          .set('Authorization', `Bearer ${token}`)
          .send(buildSermon({ title: `Sermon ${i}` }));
      }

      const res = await request(app).get('/api/sermons/public?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.sermons).toHaveLength(2);
      expect(res.body.total).toBe(3);
      expect(res.body.totalPages).toBe(2);
      expect(res.body.page).toBe(1);
    });
  });

  // ─── GET /api/sermons/public/:id ────────────────────────────

  describe('GET /api/sermons/public/:id', () => {
    it('should return a published sermon', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ published: true }));

      const sermonId = createRes.body.sermon.id;

      const res = await request(app).get(`/api/sermons/public/${sermonId}`);

      expect(res.status).toBe(200);
      expect(res.body.sermon.title).toBe(sampleSermon.title);
    });

    it('should return 404 for unpublished sermon', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ published: false }));

      const sermonId = createRes.body.sermon.id;

      const res = await request(app).get(`/api/sermons/public/${sermonId}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SERMON_NOT_FOUND');
    });
  });

  // ─── GET /api/sermons/public/series ─────────────────────────

  describe('GET /api/sermons/public/series', () => {
    it('should list all series', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries());

      await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries({ title: 'Another Series', startDate: new Date('2026-01-01') }));

      const res = await request(app).get('/api/sermons/public/series');

      expect(res.status).toBe(200);
      expect(res.body.series).toHaveLength(2);
    });
  });

  // ─── GET /api/sermons/podcast.xml ───────────────────────────

  describe('GET /api/sermons/podcast.xml', () => {
    it('should return application/xml content type', async () => {
      const res = await request(app).get('/api/sermons/podcast.xml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
    });

    it('should contain <rss> root element', async () => {
      const res = await request(app).get('/api/sermons/podcast.xml');

      expect(res.text).toContain('<rss');
    });

    it('should only include sermons with podcastInclude and audioUrl', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      // Sermon with podcast + audio (should appear)
      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'Podcast Sermon', podcastInclude: true, audioUrl: 'https://example.com/audio.mp3' }));

      // Sermon without audio (should NOT appear)
      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'No Audio', podcastInclude: true, audioUrl: undefined }));

      // Sermon with podcastInclude false (should NOT appear)
      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'Excluded', podcastInclude: false, audioUrl: 'https://example.com/other.mp3' }));

      const res = await request(app).get('/api/sermons/podcast.xml');

      expect(res.text).toContain('Podcast Sermon');
      expect(res.text).not.toContain('No Audio');
      expect(res.text).not.toContain('Excluded');
    });

    it('should exclude unpublished sermons', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'Published Sermon', published: true }));

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'Draft Sermon', published: false }));

      const res = await request(app).get('/api/sermons/podcast.xml');

      expect(res.text).toContain('Published Sermon');
      expect(res.text).not.toContain('Draft Sermon');
    });
  });

  // ─── Sermon CRUD (auth'd) ──────────────────────────────────

  describe('Sermon CRUD (auth)', () => {
    it('GET / should list all sermons (published and unpublished)', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ published: true }));

      await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon({ title: 'Draft', published: false }));

      const res = await request(app)
        .get('/api/sermons')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.sermons).toHaveLength(2);
    });

    it('GET /:id should return a sermon by ID', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon());

      const sermonId = createRes.body.sermon.id;

      const res = await request(app)
        .get(`/api/sermons/${sermonId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.sermon.title).toBe(sampleSermon.title);
    });

    it('PUT /:id should update a sermon', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon());

      const sermonId = createRes.body.sermon.id;

      const res = await request(app)
        .put(`/api/sermons/${sermonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.sermon.title).toBe('Updated Title');
    });

    it('DELETE /:id should delete a sermon', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/sermons')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSermon());

      const sermonId = createRes.body.sermon.id;

      const res = await request(app)
        .delete(`/api/sermons/${sermonId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const check = await Sermon.findById(sermonId);
      expect(check).toBeNull();
    });
  });

  // ─── Series CRUD ────────────────────────────────────────────

  describe('Series CRUD', () => {
    it('POST /series should create a series', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const res = await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries());

      expect(res.status).toBe(201);
      expect(res.body.series).toBeDefined();
      expect(res.body.series.title).toBe(sampleSeries.title);
    });

    it('GET /series should list all series', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries());

      const res = await request(app)
        .get('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.series).toHaveLength(1);
    });

    it('PUT /series/:id should update a series', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries());

      const seriesId = createRes.body.series.id;

      const res = await request(app)
        .put(`/api/sermons/series/${seriesId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Series' });

      expect(res.status).toBe(200);
      expect(res.body.series.title).toBe('Updated Series');
    });

    it('DELETE /series/:id should delete a series', async () => {
      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/sermons/series')
        .set('Authorization', `Bearer ${token}`)
        .send(buildSeries());

      const seriesId = createRes.body.series.id;

      const res = await request(app)
        .delete(`/api/sermons/series/${seriesId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const check = await SermonSeries.findById(seriesId);
      expect(check).toBeNull();
    });
  });

  // ─── Feature Gate ───────────────────────────────────────────

  describe('Feature Gate', () => {
    it('should return 404 when sermons feature is disabled', async () => {
      const disabledConfig = { ...testConfig, features: { ...testConfig.features, sermons: false } };
      const disabledApp = createApp(disabledConfig);

      const user = await createUser({ role: 'pastor' });
      const token = makeToken(user._id.toString(), 'pastor');

      const res = await request(disabledApp)
        .get('/api/sermons')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── Auth Enforcement ──────────────────────────────────────

  describe('Auth Enforcement', () => {
    it('should return 401 for GET /api/sermons without token', async () => {
      const res = await request(app).get('/api/sermons');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/sermons without token', async () => {
      const res = await request(app).post('/api/sermons').send(buildSermon());
      expect(res.status).toBe(401);
    });

    it('should return 401 for PUT /api/sermons/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).put(`/api/sermons/${fakeId}`).send({ title: 'Updated' });
      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/sermons/:id without token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/sermons/${fakeId}`);
      expect(res.status).toBe(401);
    });

    it('should allow GET /api/sermons/public without auth', async () => {
      const res = await request(app).get('/api/sermons/public');
      expect(res.status).toBe(200);
      expect(res.body.sermons).toBeDefined();
    });

    it('should allow GET /api/sermons/podcast.xml without auth', async () => {
      const res = await request(app).get('/api/sermons/podcast.xml');
      expect(res.status).toBe(200);
    });
  });
});

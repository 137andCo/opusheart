import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Page } from '../../src/models/Page.js';
import { PageTemplate } from '../../src/models/PageTemplate.js';
import { Theme } from '../../src/models/Theme.js';
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

describe('Website Builder Engine', () => {
  beforeAll(async () => {
    await connectTestDb('pages');
    testConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_pages';
    app = createApp(testConfig);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  describe('Page CRUD', () => {
    it('should create a page (admin)', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Welcome',
          slug: 'welcome',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
        });

      expect(res.status).toBe(201);
      expect(res.body.page).toBeDefined();
      expect(res.body.page.title).toBe('Welcome');
      expect(res.body.page.slug).toBe('welcome');
      expect(res.body.page.status).toBe('draft');
    });

    it('should create a page (pastor)', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const res = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'About Us', slug: 'about-us' });

      expect(res.status).toBe(201);
      expect(res.body.page.slug).toBe('about-us');
    });

    it('should reject page creation by regular member', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nope', slug: 'nope' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should get a page by ID', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Get Me', slug: 'get-me' });

      const pageId = createRes.body.page.id;
      const res = await request(app)
        .get(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.page.title).toBe('Get Me');
    });

    it('should update a page', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Original', slug: 'original' });

      const pageId = createRes.body.page.id;
      const res = await request(app)
        .put(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.page.title).toBe('Updated Title');
    });

    it('should archive (soft delete) a page', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Delete Me', slug: 'delete-me' });

      const pageId = createRes.body.page.id;
      const res = await request(app)
        .delete(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Page archived');

      const check = await Page.findById(pageId);
      expect(check?.status).toBe('archived');
    });
  });

  describe('Slug Uniqueness', () => {
    it('should enforce unique slugs', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'First', slug: 'unique-slug' });

      const res = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Second', slug: 'unique-slug' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLUG_EXISTS');
    });
  });

  describe('Publishing Workflow', () => {
    it('should publish a page and set publishedAt', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const createRes = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Publish Me', slug: 'publish-me' });

      const pageId = createRes.body.page.id;
      expect(createRes.body.page.status).toBe('draft');
      expect(createRes.body.page.publishedAt).toBeUndefined();

      const res = await request(app)
        .post(`/api/pages/${pageId}/publish`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.page.status).toBe('published');
      expect(res.body.page.publishedAt).toBeDefined();
      expect(res.body.page.publishedBy).toBe(pastor._id.toString());
    });

    it('should set publishedAt when status changes to published via update', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Update Publish', slug: 'update-publish' });

      const pageId = createRes.body.page.id;

      const res = await request(app)
        .put(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.page.status).toBe('published');
      expect(res.body.page.publishedAt).toBeDefined();
    });
  });

  describe('Duplicate Page', () => {
    it('should duplicate a page with new slug', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Original Page',
          slug: 'original-page',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content here' }] }],
        });

      const original = await Page.findOne({ slug: 'original-page' });
      const res = await request(app)
        .post(`/api/pages/${original!._id}/duplicate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.page.slug).toBe('original-page-copy');
      expect(res.body.page.title).toBe('Original Page (Copy)');
      expect(res.body.page.status).toBe('draft');
    });
  });

  describe('Page Query/Search/Pagination', () => {
    it('should list pages with pagination', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/pages')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: `Page ${i}`, slug: `page-${i}` });
      }

      const res = await request(app)
        .get('/api/pages?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(3);
      expect(res.body.totalPages).toBe(2);
    });

    it('should filter pages by status', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app).post('/api/pages').set('Authorization', `Bearer ${token}`)
        .send({ title: 'Draft Page', slug: 'draft-page' });

      const pubRes = await request(app).post('/api/pages').set('Authorization', `Bearer ${token}`)
        .send({ title: 'Published Page', slug: 'published-page' });
      await request(app).post(`/api/pages/${pubRes.body.page.id}/publish`).set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .get('/api/pages?status=published')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('published');
    });

    it('should search pages by text', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app).post('/api/pages').set('Authorization', `Bearer ${token}`)
        .send({ title: 'Sermons Archive', slug: 'sermons-archive' });
      await request(app).post('/api/pages').set('Authorization', `Bearer ${token}`)
        .send({ title: 'Contact Us', slug: 'contact-us' });

      const res = await request(app)
        .get('/api/pages?search=sermons')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Sermons Archive');
    });
  });

  describe('Public Slug Endpoint', () => {
    it('should get published page by slug without auth', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const createRes = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Public Page', slug: 'public-page' });

      await request(app)
        .post(`/api/pages/${createRes.body.page.id}/publish`)
        .set('Authorization', `Bearer ${token}`);

      // No auth header
      const res = await request(app).get('/api/pages/slug/public-page');

      expect(res.status).toBe(200);
      expect(res.body.page.title).toBe('Public Page');
      expect(res.body.page.status).toBe('published');
    });

    it('should return 404 for unpublished page via slug', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Draft Only', slug: 'draft-only' });

      const res = await request(app).get('/api/pages/slug/draft-only');
      expect(res.status).toBe(404);
    });
  });

  describe('Template Management', () => {
    it('should create a template (admin only)', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Template',
          description: 'A test template',
          vertical: 'church',
          category: 'landing',
          content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Template' }] }],
        });

      expect(res.status).toBe(201);
      expect(res.body.template.name).toBe('Test Template');
    });

    it('should reject template creation by pastor', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nope',
          description: 'Should fail',
          vertical: 'church',
          category: 'landing',
          content: [],
        });

      expect(res.status).toBe(403);
    });

    it('should list templates', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await PageTemplate.create({ name: 'T1', description: 'D1', vertical: 'church', category: 'landing', content: [] });
      await PageTemplate.create({ name: 'T2', description: 'D2', vertical: 'church', category: 'about', content: [] });

      const res = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.templates.length).toBe(2);
    });

    it('should instantiate a page from template', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const template = await PageTemplate.create({
        name: 'Homepage Template',
        description: 'A homepage',
        vertical: 'church',
        category: 'landing',
        content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome' }] }],
      });

      const res = await request(app)
        .post(`/api/templates/${template._id}/instantiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'My Homepage', slug: 'my-homepage' });

      expect(res.status).toBe(201);
      expect(res.body.page.title).toBe('My Homepage');
      expect(res.body.page.slug).toBe('my-homepage');
      expect(res.body.page.template).toBe('Homepage Template');
      expect(res.body.page.content).toEqual(template.content);
    });
  });

  describe('Theme Management', () => {
    it('should get default theme (public, no auth)', async () => {
      const res = await request(app).get('/api/theme');

      expect(res.status).toBe(200);
      expect(res.body.theme).toBeDefined();
      expect(res.body.theme.primaryColor).toBe('#1e40af');
      expect(res.body.theme.fontFamily).toBe('Inter, sans-serif');
    });

    it('should update theme (admin only)', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      const res = await request(app)
        .put('/api/theme')
        .set('Authorization', `Bearer ${token}`)
        .send({
          primaryColor: '#ff0000',
          fontFamily: 'Roboto, sans-serif',
        });

      expect(res.status).toBe(200);
      expect(res.body.theme.primaryColor).toBe('#ff0000');
      expect(res.body.theme.fontFamily).toBe('Roboto, sans-serif');
    });

    it('should reject theme update by non-admin', async () => {
      const pastor = await createUser({ role: 'pastor' });
      const token = makeToken(pastor._id.toString(), 'pastor');

      const res = await request(app)
        .put('/api/theme')
        .set('Authorization', `Bearer ${token}`)
        .send({ primaryColor: '#00ff00' });

      expect(res.status).toBe(403);
    });

    it('should persist theme updates across reads', async () => {
      const admin = await createUser({ role: 'admin' });
      const token = makeToken(admin._id.toString(), 'admin');

      await request(app)
        .put('/api/theme')
        .set('Authorization', `Bearer ${token}`)
        .send({ primaryColor: '#abcdef', secondaryColor: '#123456' });

      const res = await request(app).get('/api/theme');

      expect(res.status).toBe(200);
      expect(res.body.theme.primaryColor).toBe('#abcdef');
      expect(res.body.theme.secondaryColor).toBe('#123456');
    });
  });

  describe('Auth Enforcement', () => {
    it('should require auth for page listing', async () => {
      const res = await request(app).get('/api/pages');
      expect(res.status).toBe(401);
    });

    it('should require auth for page creation', async () => {
      const res = await request(app)
        .post('/api/pages')
        .send({ title: 'No Auth', slug: 'no-auth' });
      expect(res.status).toBe(401);
    });

    it('should require leader+ role for listing pages', async () => {
      const member = await createUser({ role: 'member' });
      const token = makeToken(member._id.toString(), 'member');

      const res = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});

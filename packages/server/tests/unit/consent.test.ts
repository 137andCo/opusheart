import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { ConsentRecord } from '../../src/models/ConsentRecord.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3020, nodeEnv: 'test',
  mongo: { uri: '' }, redis: { url: 'redis://localhost:6379' },
  jwt: {
    secret: 'test-jwt-secret-that-is-long-enough-for-testing-purposes-here-64!!',
    issuer: 'opusheart-test', audience: 'opusheart-test',
    accessExpiresIn: '15m', refreshSecret: 'test-refresh-secret-long-enough-for-testing-purposes-64chars!!',
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

let app: ReturnType<typeof createApp>;

function tokenFor(userId: string, role = 'member'): string {
  return jwt.sign({ sub: userId, role, jti: 'jti' }, testConfig.jwt.secret,
    { algorithm: 'HS256', issuer: testConfig.jwt.issuer, audience: testConfig.jwt.audience, expiresIn: '15m' });
}

describe('Consent records', () => {
  beforeAll(async () => { await connectTestDb('consent'); app = createApp(testConfig); });
  afterAll(async () => { await disconnectTestDb(); });
  beforeEach(async () => { await cleanTestDb(); });

  async function makeUser() {
    return User.create({
      email: 'c@church.org', emailHash: 'ch', passwordHash: 'h',
      firstName: 'C', lastName: 'R', role: 'member', active: true,
    });
  }

  it('records a consent history entry when privacy settings change via PUT /me', async () => {
    const user = await makeUser();
    const res = await request(app).put('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user._id.toString())}`)
      .send({ privacySettings: { allowCareTracking: true, showInDirectory: true, showEmail: false, showPhone: false } });

    expect(res.status).toBe(200);
    const records = await ConsentRecord.find({ userId: user._id });
    const byType = Object.fromEntries(records.map(r => [r.type, r.granted]));
    expect(byType['care_tracking']).toBe(true);
    expect(byType['directory']).toBe(true);
    expect(byType['show_email']).toBe(false);
  });

  it('GET /api/consent returns the caller\'s history, newest first', async () => {
    const user = await makeUser();
    const token = tokenFor(user._id.toString());
    await request(app).post('/api/consent').set('Authorization', `Bearer ${token}`)
      .send({ type: 'care_tracking', granted: true });
    await request(app).post('/api/consent').set('Authorization', `Bearer ${token}`)
      .send({ type: 'care_tracking', granted: false });

    const res = await request(app).get('/api/consent').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBe(2);
    // newest first
    expect(res.body.records[0].granted).toBe(false);
  });

  it('rejects an invalid consent type', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/consent')
      .set('Authorization', `Bearer ${tokenFor(user._id.toString())}`)
      .send({ type: 'not_a_type', granted: true });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/consent');
    expect(res.status).toBe(401);
  });

  it('only returns the caller\'s own records (no cross-user leak)', async () => {
    const a = await makeUser();
    const b = await User.create({ email: 'b@church.org', emailHash: 'bh', passwordHash: 'h', firstName: 'B', lastName: 'B', role: 'member', active: true });
    await request(app).post('/api/consent').set('Authorization', `Bearer ${tokenFor(a._id.toString())}`)
      .send({ type: 'directory', granted: true });

    const res = await request(app).get('/api/consent').set('Authorization', `Bearer ${tokenFor(b._id.toString())}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBe(0);
  });
});

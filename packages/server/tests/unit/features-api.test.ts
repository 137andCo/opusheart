import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { FeatureConfig } from '../../src/models/FeatureConfig.js';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3020, nodeEnv: 'test',
  mongo: { uri: '' }, redis: { url: '' },
  jwt: {
    secret: 'test-secret-that-is-long-enough-for-testing-purposes-64chars!!',
    issuer: 'test', audience: 'test', accessExpiresIn: '15m',
    refreshSecret: 'test-refresh-secret-long-enough-for-testing-purposes-64chars!!',
    refreshExpiresIn: '7d',
  },
  encryption: { key: '0'.repeat(64) },
  cors: { origins: [] },
  features: {
    giving: false, attendance: false, memberCare: false, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test', url: 'http://localhost' },
  vertical: 'church',
};

let app: ReturnType<typeof createApp>;

describe('GET /api/features', () => {
  beforeAll(async () => {
    await connectTestDb('features-api');
    app = createApp(testConfig);
  });

  afterEach(() => cleanTestDb());
  afterAll(() => disconnectTestDb());

  it('returns feature toggles from config defaults', async () => {
    const res = await request(app).get('/api/features');
    expect(res.status).toBe(200);
    expect(res.body.features).toBeDefined();
    expect(res.body.features.sermons).toBe(true);
    expect(res.body.features.giving).toBe(false);
  });

  it('returns DB overrides merged with defaults (fresh app)', async () => {
    // Use a fresh app instance so the FeatureService cache is cold
    await FeatureConfig.create({ key: 'giving', enabled: true });
    const freshApp = createApp(testConfig);
    const res = await request(freshApp).get('/api/features');
    expect(res.status).toBe(200);
    expect(res.body.features.giving).toBe(true);
    expect(res.body.features.sermons).toBe(true); // still from config
  });

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/features');
    expect(res.status).toBe(200);
  });
});

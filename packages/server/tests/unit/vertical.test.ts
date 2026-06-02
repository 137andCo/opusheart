import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const baseConfig: AppConfig = {
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
  trustProxy: false,
  features: {
    giving: false, attendance: false, memberCare: false, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test', url: 'http://localhost' },
  vertical: 'church',
};

// The vertical endpoint is pure config (no DB/Redis), so these run standalone.
describe('GET /api/vertical', () => {
  it('returns the active vertical preset (church) with terminology and labels', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get('/api/vertical');
    expect(res.status).toBe(200);
    expect(res.body.vertical.name).toBe('church');
    expect(res.body.vertical.label).toBe('Church');
    expect(res.body.vertical.terminology.members).toBe('Congregation');
    expect(res.body.vertical.roleLabels.pastor).toBe('Pastor');
    expect(res.body.vertical.blocks).toContain('hero');
    expect(res.body.vertical.defaultFeatures.sermons).toBe(true);
    expect(res.body.available).toContain('church');
  });

  it('does not require authentication', async () => {
    const res = await request(createApp(baseConfig)).get('/api/vertical');
    expect(res.status).toBe(200);
  });

  it('falls back to the church preset for an unknown vertical', async () => {
    const app = createApp({ ...baseConfig, vertical: 'does-not-exist' });
    const res = await request(app).get('/api/vertical');
    expect(res.status).toBe(200);
    expect(res.body.vertical.name).toBe('church');
  });
});

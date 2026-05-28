import { describe, it, expect, beforeAll } from '@jest/globals';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config/index.js';
import request from 'supertest';

// Minimal config for testing
const testConfig: AppConfig = {
  port: 3020,
  nodeEnv: 'test',
  mongo: { uri: 'mongodb://localhost:27017/test' },
  redis: { url: 'redis://localhost:6379' },
  jwt: {
    secret: 'test-secret-that-is-long-enough-for-testing-purposes-64chars!!',
    issuer: 'opusheart-test',
    audience: 'opusheart-test',
    accessExpiresIn: '15m',
    refreshSecret: 'test-refresh-secret-long-enough-for-testing-purposes-64chars!!',
    refreshExpiresIn: '7d',
  },
  encryption: { key: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
  cors: { origins: ['http://localhost:3021'] },
  features: {
    giving: false, attendance: false, memberCare: false, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test Church', url: 'http://localhost:3020' },
  vertical: 'church',
};

describe('Express App', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(testConfig);
  });

  it('should respond to health check', async () => {
    const res = await request(app).get('/health');
    // Without a live MongoDB connection, health returns 503 (degraded)
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.mongo).toBe('disconnected');
    expect(res.body.timestamp).toBeDefined();
    expect(typeof res.body.uptime).toBe('number');
  });

  it('should respond to readiness check', async () => {
    const res = await request(app).get('/ready');
    // Without a live MongoDB connection, readiness returns 503
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.mongo).toBe(false);
  });

  it('should set security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('should parse JSON body', async () => {
    // 404 is fine -- we just want to verify JSON parsing doesn't crash
    const res = await request(app)
      .post('/nonexistent')
      .send({ test: 'data' })
      .set('Content-Type', 'application/json');
    // Should not be 400 (parsing error)
    expect(res.status).not.toBe(400);
  });

  it('should store config on app', () => {
    expect(app.get('config')).toBe(testConfig);
  });
});

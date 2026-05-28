import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import { FeatureService } from '../../src/services/features.service.js';
import { FeatureConfig } from '../../src/models/FeatureConfig.js';
import type { AppConfig } from '../../src/config/index.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const testConfig: AppConfig = {
  port: 3020, nodeEnv: 'test',
  mongo: { uri: '' }, redis: { url: '' },
  jwt: { secret: 'x'.repeat(64), issuer: 'test', audience: 'test', accessExpiresIn: '15m', refreshSecret: 'y'.repeat(64), refreshExpiresIn: '7d' },
  encryption: { key: '0'.repeat(64) },
  cors: { origins: [] },
  features: {
    giving: false, attendance: false, memberCare: false, sms: false,
    connect: false, ai: false, sermons: true, groups: true, resourceHub: true, communication: true, events: true,
  },
  instance: { name: 'Test', url: 'http://localhost' },
  vertical: 'church',
};

describe('FeatureService', () => {
  let service: FeatureService;

  beforeAll(async () => {
    await connectTestDb('features');
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    service = new FeatureService(testConfig);
  });

  it('should return env config defaults', async () => {
    expect(await service.isEnabled('sermons')).toBe(true);
    expect(await service.isEnabled('giving')).toBe(false);
  });

  it('should allow DB override of env config', async () => {
    await service.setFeature('giving', true, 'admin');
    service.clearCache(); // Force re-read
    expect(await service.isEnabled('giving')).toBe(true);
  });

  it('should return all features merged', async () => {
    await service.setFeature('ai', true);
    service.clearCache();
    const all = await service.getAllFeatures();
    expect(all.sermons).toBe(true);   // from env
    expect(all.ai).toBe(true);        // from DB override
    expect(all.giving).toBe(false);   // from env, no override
  });

  it('should persist feature changes to DB', async () => {
    await service.setFeature('connect', true, 'pastor-123');
    const doc = await FeatureConfig.findOne({ key: 'connect' }).lean();
    expect(doc?.enabled).toBe(true);
    expect(doc?.updatedBy).toBe('pastor-123');
  });

  it('should use cache within TTL', async () => {
    await service.isEnabled('giving'); // Loads cache
    // Change DB directly (bypassing service)
    await FeatureConfig.create({ key: 'giving', enabled: true });
    // Should still return cached value (false) within TTL
    expect(await service.isEnabled('giving')).toBe(false);
    // After clearing cache, should pick up DB value
    service.clearCache();
    expect(await service.isEnabled('giving')).toBe(true);
  });
});

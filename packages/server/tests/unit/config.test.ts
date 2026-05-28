import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadConfig } from '../../src/config/index.js';

const VALID_ENC = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const VALID_JWT = 'a'.repeat(40);

describe('loadConfig', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env = { ...saved };
    process.env['ENCRYPTION_KEY'] = VALID_ENC;
    process.env['JWT_SECRET'] = VALID_JWT;
    process.env['MONGO_URI'] = 'mongodb://localhost:27017/oh';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    delete process.env['CORS_ORIGINS'];
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('loads a valid config', () => {
    const cfg = loadConfig();
    expect(cfg.jwt.secret).toBe(VALID_JWT);
    expect(cfg.encryption.key).toBe(VALID_ENC);
  });

  it('rejects a short JWT secret', () => {
    process.env['JWT_SECRET'] = 'tooshort';
    expect(() => loadConfig()).toThrow(/JWT_SECRET must be at least/);
  });

  it('rejects a malformed encryption key', () => {
    process.env['ENCRYPTION_KEY'] = 'nothex';
    expect(() => loadConfig()).toThrow(/ENCRYPTION_KEY/);
  });

  it('rejects a missing required secret', () => {
    delete process.env['MONGO_URI'];
    expect(() => loadConfig()).toThrow(/MONGO_URI/);
  });

  it('rejects wildcard CORS while credentials are enabled', () => {
    process.env['CORS_ORIGINS'] = '*';
    expect(() => loadConfig()).toThrow(/CORS_ORIGINS cannot be/);
  });

  it('refuses placeholder secrets in production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['MONGO_URI'] = 'mongodb://opusheart:CHANGE_ME@mongo:27017/oh';
    expect(() => loadConfig()).toThrow(/placeholder/);
  });
});

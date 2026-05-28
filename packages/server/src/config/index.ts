import { readFileSync, existsSync } from 'node:fs';
import { FeatureToggles } from '@opusheart/shared';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongo: { uri: string };
  redis: { url: string };
  jwt: {
    secret: string;
    issuer: string;
    audience: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  encryption: { key: string };
  cors: { origins: string[] };
  features: FeatureToggles;
  instance: { name: string; url: string };
  vertical: string;
}

/**
 * Read a required secret from (in order): the env var, a `<KEY>_FILE` path, or
 * the Docker/Swarm secret mount at `/run/secrets/<key>`. This lets the same
 * image boot from a plain .env in dev and from mounted secrets in production
 * (docker-stack.yml), instead of crash-looping on a missing env var.
 */
function readSecret(key: string): string | undefined {
  const direct = process.env[key];
  if (direct) return direct;
  const fileVar = process.env[`${key}_FILE`];
  if (fileVar && existsSync(fileVar)) return readFileSync(fileVar, 'utf8').trim();
  const swarmPath = `/run/secrets/${key.toLowerCase()}`;
  if (existsSync(swarmPath)) return readFileSync(swarmPath, 'utf8').trim();
  return undefined;
}

export function loadConfig(): AppConfig {
  const required = (key: string): string => {
    const val = readSecret(key);
    if (!val) {
      throw new Error(`Missing required config: ${key} (set env ${key}, ${key}_FILE, or /run/secrets/${key.toLowerCase()})`);
    }
    return val;
  };

  const nodeEnv = process.env['NODE_ENV'] || 'development';

  // Encryption key — must be 32 bytes (64 hex chars)
  const encKey = required('ENCRYPTION_KEY');
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32');
  }

  // JWT secret — reject weak/short secrets (HS256 brute-force / forgery risk)
  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters. Generate with: openssl rand -hex 32');
  }

  const mongoUri = required('MONGO_URI');
  const redisUrl = required('REDIS_URL');

  // Refuse to boot in production with placeholder/default secrets
  if (nodeEnv === 'production') {
    const placeholders = ['CHANGE_ME', 'devpassword'];
    const checks: Array<[string, string]> = [
      ['MONGO_URI', mongoUri], ['REDIS_URL', redisUrl],
      ['JWT_SECRET', jwtSecret], ['ENCRYPTION_KEY', encKey],
    ];
    for (const [label, val] of checks) {
      if (placeholders.some(p => val.includes(p))) {
        throw new Error(`${label} still contains a placeholder/default value — set a real secret before running in production.`);
      }
    }
  }

  // CORS — credentials (cookies) are enabled, so a wildcard origin is unsafe
  const corsOrigins = (process.env['CORS_ORIGINS'] || 'http://localhost:3021,http://localhost:3022')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS cannot be "*" while credentials are enabled. List explicit origins.');
  }

  return {
    port: parseInt(process.env['PORT'] || '3020', 10),
    nodeEnv,
    mongo: { uri: mongoUri },
    redis: { url: redisUrl },
    jwt: {
      secret: jwtSecret,
      issuer: process.env['JWT_ISSUER'] || 'opusheart',
      audience: process.env['JWT_AUDIENCE'] || 'opusheart',
      accessExpiresIn: process.env['JWT_ACCESS_EXPIRES'] || '15m',
      refreshSecret: process.env['REFRESH_TOKEN_SECRET'] || '', // Reserved for future JWT-signed refresh tokens
      refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES'] || '7d',
    },
    encryption: { key: encKey },
    cors: {
      origins: corsOrigins,
    },
    features: {
      giving: process.env['FEATURE_GIVING'] === 'true',
      attendance: process.env['FEATURE_ATTENDANCE'] === 'true',
      memberCare: process.env['FEATURE_MEMBER_CARE'] === 'true',
      sms: process.env['FEATURE_SMS'] === 'true',
      connect: process.env['FEATURE_CONNECT'] === 'true',
      ai: process.env['ENABLE_AI'] === 'true',
      sermons: process.env['FEATURE_SERMONS'] !== 'false',
      groups: process.env['FEATURE_GROUPS'] !== 'false',
      resourceHub: process.env['FEATURE_RESOURCE_HUB'] !== 'false',
      communication: process.env['FEATURE_COMMUNICATION'] !== 'false',
      events: process.env['FEATURE_EVENTS'] !== 'false',
    },
    instance: {
      name: process.env['INSTANCE_NAME'] || 'OpusHeart',
      url: process.env['INSTANCE_URL'] || 'http://localhost:3020',
    },
    vertical: process.env['VERTICAL'] || 'church',
  };
}

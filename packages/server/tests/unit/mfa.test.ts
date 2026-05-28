import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as OTPAuth from 'otpauth';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
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
    giving: false, attendance: false, memberCare: false, sms: false,
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

// Derive a valid current TOTP code from the otpauth URL the server returns.
function codeFromUrl(otpauthUrl: string): string {
  const totp = OTPAuth.URI.parse(otpauthUrl) as OTPAuth.TOTP;
  return totp.generate();
}

describe('MFA (TOTP)', () => {
  beforeAll(async () => { await connectTestDb('mfa'); app = createApp(testConfig); });
  afterAll(async () => { await disconnectTestDb(); });
  beforeEach(async () => { await cleanTestDb(); });

  async function makeUser() {
    const user = await User.create({
      email: 'mfa@church.org', emailHash: 'mfah', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fake',
      firstName: 'M', lastName: 'A', role: 'admin', active: true,
    });
    return user;
  }

  it('enroll returns an otpauth URL and stores an (encrypted) secret', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/auth/mfa/enroll')
      .set('Authorization', `Bearer ${tokenFor(user._id.toString())}`);

    expect(res.status).toBe(200);
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(res.body.secret).toMatch(/^[A-Z2-7]+$/); // base32

    // mfa not enabled until confirmed; secret stored encrypted (not plaintext)
    const raw = await User.collection.findOne({ _id: user._id });
    expect(raw?.mfaEnabled).toBe(false);
    expect(raw?.mfaSecret).not.toBe(res.body.secret);
  });

  it('confirm with a valid code enables MFA; wrong code is rejected', async () => {
    const user = await makeUser();
    const token = tokenFor(user._id.toString());
    const enroll = await request(app).post('/api/auth/mfa/enroll').set('Authorization', `Bearer ${token}`);

    const bad = await request(app).post('/api/auth/mfa/confirm')
      .set('Authorization', `Bearer ${token}`).send({ code: '000000' });
    expect(bad.status).toBe(400);

    const good = await request(app).post('/api/auth/mfa/confirm')
      .set('Authorization', `Bearer ${token}`).send({ code: codeFromUrl(enroll.body.otpauthUrl) });
    expect(good.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated?.mfaEnabled).toBe(true);
  });

  it('login requires a valid TOTP code once MFA is enabled', async () => {
    // Enroll + confirm via API, then exercise the service login path directly.
    const argon2 = (await import('argon2')).default;
    const realHash = await argon2.hash('SecurePass123', { type: argon2.argon2id });
    const user = await makeUser();
    user.passwordHash = realHash;
    await user.save();

    const token = tokenFor(user._id.toString());
    const enroll = await request(app).post('/api/auth/mfa/enroll').set('Authorization', `Bearer ${token}`);
    await request(app).post('/api/auth/mfa/confirm')
      .set('Authorization', `Bearer ${token}`).send({ code: codeFromUrl(enroll.body.otpauthUrl) });

    // Missing code -> MFA_REQUIRED
    const noCode = await request(app).post('/api/auth/login')
      .send({ email: 'mfa@church.org', password: 'SecurePass123' });
    expect(noCode.status).toBe(401);
    expect(noCode.body.error.code).toBe('MFA_REQUIRED');

    // Wrong code -> INVALID_MFA_CODE
    const wrong = await request(app).post('/api/auth/login')
      .send({ email: 'mfa@church.org', password: 'SecurePass123', mfaCode: '111111' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_MFA_CODE');

    // Correct code -> success
    const ok = await request(app).post('/api/auth/login')
      .send({ email: 'mfa@church.org', password: 'SecurePass123', mfaCode: codeFromUrl(enroll.body.otpauthUrl) });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeDefined();
  });

  it('disable requires a valid code and clears the secret', async () => {
    const user = await makeUser();
    const token = tokenFor(user._id.toString());
    const enroll = await request(app).post('/api/auth/mfa/enroll').set('Authorization', `Bearer ${token}`);
    await request(app).post('/api/auth/mfa/confirm')
      .set('Authorization', `Bearer ${token}`).send({ code: codeFromUrl(enroll.body.otpauthUrl) });

    const res = await request(app).post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${token}`).send({ code: codeFromUrl(enroll.body.otpauthUrl) });
    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated?.mfaEnabled).toBe(false);
    expect(updated?.mfaSecret).toBeUndefined();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/auth/mfa/enroll');
    expect(res.status).toBe(401);
  });
});

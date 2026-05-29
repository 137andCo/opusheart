import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import { sha256 } from '@opusheart/shared';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { audienceService } from '../../src/services/audience.service.js';
import { AuthService } from '../../src/services/auth.service.js';
import { User } from '../../src/models/User.js';
import { Member } from '../../src/models/Member.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { PasswordResetToken } from '../../src/models/PasswordResetToken.js';
import type { AppConfig } from '../../src/config/index.js';

const config = {
  port: 3020, nodeEnv: 'test',
  mongo: { uri: '' }, redis: { url: 'redis://localhost:6379' },
  jwt: { secret: 'x'.repeat(40), issuer: 'opusheart', audience: 'opusheart', accessExpiresIn: '15m', refreshSecret: '', refreshExpiresIn: '7d' },
  encryption: { key: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
  cors: { origins: [] }, trustProxy: 1,
  features: {} as never, instance: { name: 'Test', url: 'http://localhost:3020' }, vertical: 'church',
} as unknown as AppConfig;

const auth = new AuthService(config);

async function makeMember(email: string) {
  const user = await auth.register({ email, password: 'SecurePass123', firstName: 'A', lastName: 'B' });
  const member = await Member.create({ userId: user._id, membershipStatus: 'active' });
  return { user, member };
}

describe('Communications', () => {
  beforeAll(async () => { await connectTestDb('comms'); });
  afterAll(async () => { await disconnectTestDb(); });
  beforeEach(async () => { await cleanTestDb(); });

  describe('audienceService.resolveEmails', () => {
    it('returns DECRYPTED emails (regression: was leaking ciphertext via .lean())', async () => {
      await makeMember('alice@church.org');
      await makeMember('bob@church.org');

      const emails = await audienceService.resolveEmails({ type: 'all' });

      expect(emails.sort()).toEqual(['alice@church.org', 'bob@church.org']);
      // none should look like base64 ciphertext
      expect(emails.every(e => e.includes('@'))).toBe(true);
    });

    it('resolves a role audience to decrypted emails', async () => {
      const { user } = await makeMember('pastor@church.org');
      user.role = 'pastor';
      await user.save();

      const emails = await audienceService.resolveEmails({ type: 'role', roles: ['pastor'] });
      expect(emails).toContain('pastor@church.org');
    });
  });

  describe('password reset', () => {
    it('creates a reset token for a known email and none for an unknown one', async () => {
      await makeMember('known@church.org');

      await auth.requestPasswordReset('known@church.org');
      await auth.requestPasswordReset('nobody@church.org');

      expect(await PasswordResetToken.countDocuments()).toBe(1);
    });

    it('resets the password with a valid token and invalidates sessions', async () => {
      const { user } = await makeMember('reset@church.org');
      await RefreshToken.create({ userId: user._id, tokenHash: 'rt', jti: 'j', expiresAt: new Date(Date.now() + 1e6) });
      const oldHash = user.passwordHash;

      const token = 'a'.repeat(40);
      await PasswordResetToken.create({ userId: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 1e6) });

      await auth.resetPassword(token, 'BrandNewPass1');

      const updated = await User.findById(user._id);
      expect(updated?.passwordHash).not.toBe(oldHash);
      expect(updated?.tokenInvalidatedAt).toBeDefined();
      expect(await RefreshToken.countDocuments({ userId: user._id, invalidated: true })).toBe(1);
      const usedToken = await PasswordResetToken.findOne({ tokenHash: sha256(token) });
      expect(usedToken?.usedAt).toBeDefined();
    });

    it('rejects an expired token', async () => {
      const { user } = await makeMember('expired@church.org');
      const token = 'b'.repeat(40);
      await PasswordResetToken.create({ userId: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() - 1000) });

      await expect(auth.resetPassword(token, 'BrandNewPass1')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    });
  });
});

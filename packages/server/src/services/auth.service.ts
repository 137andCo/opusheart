import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { sha256, decrypt } from '@opusheart/shared';
import { blindIndex } from '../utils/blindIndex.js';
import { User, type IUserDocument } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import type { AppConfig } from '../config/index.js';
import { AppError } from '../utils/errors.js';

// ── Account lockout & MFA enrollment policy ──────────────────────────────────
const MAX_FAILED_LOGINS = 5;          // consecutive failures before lockout
const LOCKOUT_MS = 15 * 60 * 1000;    // 15-minute lockout window
const MFA_ENROLL_TTL_MS = 10 * 60 * 1000; // pending enrollment must confirm within 10 min
const TOTP_PERIOD = 30;               // seconds per TOTP step

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// Precomputed dummy hash for the "user not found" branch so login latency does
// not reveal whether an email is registered (account-enumeration timing oracle).
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash('opusheart-nonexistent-account', ARGON2_OPTS);
  }
  return dummyHashPromise;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  role: string;
  jti: string;
  iss: string;
  aud: string;
  iat?: number;
}

export class AuthService {
  constructor(private config: AppConfig) {}

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<IUserDocument> {
    const emailHash = blindIndex(input.email);
    const existing = await User.findOne({ emailHash });
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTS);

    const user = await User.create({
      email: input.email,
      emailHash,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      phoneHash: input.phone ? blindIndex(input.phone) : undefined,
      // SECURITY: never honor a client-supplied role. Self-registered accounts
      // are always 'visitor'; elevation happens only via the admin role endpoint.
      role: 'visitor',
    });

    return user;
  }

  async updateProfile(userId: string, data: Record<string, unknown>): Promise<IUserDocument> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    // Only fields permitted by updateUserSchema reach here (never role, email,
    // or passwordHash), so a direct assign is safe. Lets users manage their own
    // profile and privacy settings, including care-tracking consent.
    Object.assign(user, data);
    await user.save();
    return user;
  }

  // ── MFA / TOTP ───────────────────────────────────────────
  // Standard RFC 6238 TOTP. The otpauth:// URL returned by enroll is scanned as a
  // QR code by any authenticator app (Google Authenticator, Authy, 1Password…).

  private buildTotp(secretBase32: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: this.config.instance.name || 'OpusHeart',
      label: 'OpusHeart',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
  }

  /**
   * The encryption plugin only decrypts on toJSON/toObject, so a secret read off
   * a freshly-fetched document is still ciphertext. Decrypt it to the plaintext
   * base32. FAIL CLOSED: a decrypt failure means tampering / key mismatch, so we
   * throw rather than fall back to the raw (ciphertext) value — verifying a TOTP
   * against ciphertext would just always fail anyway, and silently treating
   * ciphertext as a secret is exactly the leak we want to avoid.
   */
  private resolveSecret(stored: string): string {
    return decrypt(stored, this.config.encryption.key);
  }

  /**
   * Validate a TOTP code and return the absolute timestep it matched, or null.
   * The step lets the caller reject in-window replay (window:1 accepts 3 codes;
   * without consumption tracking the same code works for ~90s).
   */
  private totpStep(storedSecret: string, code: string): number | null {
    const totp = this.buildTotp(this.resolveSecret(storedSecret));
    // window:1 tolerates ±1 step (30s) of clock drift; delta===null means no match.
    const delta = totp.validate({ token: code.trim(), window: 1 });
    if (delta === null) return null;
    return Math.floor(Date.now() / 1000 / TOTP_PERIOD) + delta;
  }

  /**
   * Verify a TOTP code AND consume its timestep on the user document (caller must
   * save). Rejects a code whose step was already used — closes the replay window.
   */
  private consumeTotp(user: IUserDocument, code: string): boolean {
    if (!user.mfaSecret) return false;
    const step = this.totpStep(user.mfaSecret, code);
    if (step === null) return false;
    if (user.mfaLastUsedStep != null && step <= user.mfaLastUsedStep) return false;
    user.mfaLastUsedStep = step;
    return true;
  }

  /**
   * Begin MFA enrollment: generate a secret, store it (encrypted at rest), and
   * return the otpauth URL + base32 secret for the user's authenticator app.
   * mfaEnabled stays false until the user confirms a code via confirmMfa().
   */
  async beginMfaEnrollment(userId: string): Promise<{ otpauthUrl: string; secret: string }> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (user.mfaEnabled) throw new AppError('MFA is already enabled', 409, 'MFA_ALREADY_ENABLED');

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = this.buildTotp(secret.base32);

    user.mfaSecret = secret.base32; // encrypted by the model plugin on save
    user.mfaEnabled = false;
    user.mfaEnrollStartedAt = new Date();
    user.mfaLastUsedStep = undefined;
    await user.save();

    return { otpauthUrl: totp.toString(), secret: secret.base32 };
  }

  /** Confirm enrollment by validating a code against the pending secret. */
  async confirmMfa(userId: string, code: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (!user.mfaSecret) throw new AppError('MFA enrollment not started', 400, 'MFA_NOT_ENROLLING');
    // Pending enrollment expires — a stale secret left unconfirmed must be re-enrolled.
    if (
      !user.mfaEnabled &&
      (!user.mfaEnrollStartedAt || Date.now() - user.mfaEnrollStartedAt.getTime() > MFA_ENROLL_TTL_MS)
    ) {
      user.mfaSecret = undefined;
      user.mfaEnrollStartedAt = undefined;
      await user.save();
      throw new AppError('MFA enrollment expired — start again', 400, 'MFA_ENROLL_EXPIRED');
    }
    // Validate without consuming the step — the user legitimately logs in moments
    // later with the current code; the login path is where replay is blocked.
    if (this.totpStep(user.mfaSecret, code) === null) {
      throw new AppError('Invalid MFA code', 400, 'INVALID_MFA_CODE');
    }
    user.mfaEnabled = true;
    user.mfaEnrollStartedAt = undefined;
    await user.save();
  }

  /** Disable MFA — requires a valid current code to prevent lockout abuse. */
  async disableMfa(userId: string, code: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (!user.mfaEnabled || !user.mfaSecret) throw new AppError('MFA is not enabled', 400, 'MFA_NOT_ENABLED');
    if (this.totpStep(user.mfaSecret, code) === null) {
      throw new AppError('Invalid MFA code', 400, 'INVALID_MFA_CODE');
    }
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaLastUsedStep = undefined;
    await user.save();
  }

  async login(
    email: string,
    password: string,
    mfaCode?: string,
  ): Promise<{ user: IUserDocument; tokens: TokenPair }> {
    const emailHash = blindIndex(email);
    const user = await User.findOne({ emailHash });
    if (!user || !user.active) {
      // Burn an equivalent argon2 verify so response time doesn't reveal whether
      // the account exists (enumeration timing oracle).
      await argon2.verify(await dummyHash(), password).catch(() => false);
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Per-account lockout — independent of the IP rate limiter, so a distributed
    // password/MFA brute force against one account is still capped.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account temporarily locked. Try again later.', 423, 'ACCOUNT_LOCKED');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await this.registerLoginFailure(user);
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // MFA check — TOTP (RFC 6238), compatible with any authenticator app.
    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new AppError('MFA code required', 401, 'MFA_REQUIRED');
      }
      // consumeTotp both validates and records the timestep (blocks in-window replay).
      if (!this.consumeTotp(user, mfaCode)) {
        await this.registerLoginFailure(user);
        throw new AppError('Invalid MFA code', 401, 'INVALID_MFA_CODE');
      }
    }

    // Success — clear any failure/lock state.
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await this.generateTokens(user);
    return { user, tokens };
  }

  /** Increment the failure counter and lock the account once the threshold is hit. */
  private async registerLoginFailure(user: IUserDocument): Promise<void> {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
  }

  /**
   * Change the caller's password after verifying the current one. Invalidates all
   * existing sessions (refresh tokens + outstanding access tokens via
   * tokenInvalidatedAt) so a compromised session cannot survive the change.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');

    user.passwordHash = await argon2.hash(newPassword, ARGON2_OPTS);
    user.tokenInvalidatedAt = new Date();
    await user.save();
    await RefreshToken.updateMany({ userId: user._id }, { invalidated: true });
  }

  async refreshTokens(refreshTokenValue: string): Promise<TokenPair> {
    const tokenHash = sha256(refreshTokenValue);
    const storedToken = await RefreshToken.findOne({
      tokenHash,
      invalidated: false,
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Potential replay attack if token was already used
      if (storedToken?.invalidated) {
        // Invalidate ALL tokens for this user (token family rotation)
        await RefreshToken.updateMany(
          { userId: storedToken.userId },
          { invalidated: true },
        );
      }
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    // Check user status BEFORE invalidating the old token (prevents race condition
    // where token is destroyed but new one isn't issued if user became inactive)
    const user = await User.findById(storedToken.userId);
    if (!user || !user.active) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
    }

    // Invalidate old token (rotation) — only after all checks pass
    storedToken.invalidated = true;
    await storedToken.save();

    return this.generateTokens(user);
  }

  async logout(refreshTokenValue: string): Promise<void> {
    const tokenHash = sha256(refreshTokenValue);
    await RefreshToken.updateOne({ tokenHash }, { invalidated: true });
  }

  async generateTokens(user: IUserDocument): Promise<TokenPair> {
    // Cap active refresh tokens per user (max 10 sessions)
    const MAX_REFRESH_TOKENS_PER_USER = 10;
    const activeCount = await RefreshToken.countDocuments({
      userId: user._id,
      invalidated: false,
      expiresAt: { $gt: new Date() },
    });
    if (activeCount >= MAX_REFRESH_TOKENS_PER_USER) {
      // Invalidate oldest tokens beyond the limit
      const oldest = await RefreshToken.find({
        userId: user._id,
        invalidated: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: 1 }).limit(activeCount - MAX_REFRESH_TOKENS_PER_USER + 1);
      const oldIds = oldest.map(t => t._id);
      await RefreshToken.updateMany({ _id: { $in: oldIds } }, { invalidated: true });
    }

    const jti = randomUUID();

    const accessToken = jwt.sign(
      {
        sub: user._id.toString(),
        role: user.role,
        jti,
      },
      this.config.jwt.secret,
      {
        algorithm: 'HS256',
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
        expiresIn: this.config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
      },
    );

    const refreshTokenValue = randomUUID();
    const refreshTokenHash = sha256(refreshTokenValue);
    const refreshJti = randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId: user._id,
      tokenHash: refreshTokenHash,
      jti: refreshJti,
      expiresAt,
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.config.jwt.secret, {
        algorithms: ['HS256'],
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      }) as JwtPayload;
    } catch {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }
  }
}

// Re-export AppError for backward compatibility
export { AppError };

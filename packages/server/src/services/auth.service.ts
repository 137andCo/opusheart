import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { sha256, decrypt } from '@opusheart/shared';
import { User, type IUserDocument } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import type { AppConfig } from '../config/index.js';
import { AppError } from '../utils/errors.js';

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
    const emailHash = sha256(input.email);
    const existing = await User.findOne({ emailHash });
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await User.create({
      email: input.email,
      emailHash,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      phoneHash: input.phone ? sha256(input.phone) : undefined,
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
   * a freshly-fetched document is still ciphertext. Resolve it to the plaintext
   * base32 either way: try to decrypt, and fall back to the raw value if it was
   * never encrypted (defensive — should always be encrypted at rest).
   */
  private resolveSecret(stored: string): string {
    try {
      return decrypt(stored, this.config.encryption.key);
    } catch {
      return stored;
    }
  }

  private verifyTotp(storedSecret: string, code: string): boolean {
    const totp = this.buildTotp(this.resolveSecret(storedSecret));
    // window:1 tolerates ±1 step (30s) of clock drift; delta===null means no match.
    return totp.validate({ token: code.trim(), window: 1 }) !== null;
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
    await user.save();

    return { otpauthUrl: totp.toString(), secret: secret.base32 };
  }

  /** Confirm enrollment by validating a code against the pending secret. */
  async confirmMfa(userId: string, code: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (!user.mfaSecret) throw new AppError('MFA enrollment not started', 400, 'MFA_NOT_ENROLLING');
    if (!this.verifyTotp(user.mfaSecret, code)) {
      throw new AppError('Invalid MFA code', 400, 'INVALID_MFA_CODE');
    }
    user.mfaEnabled = true;
    await user.save();
  }

  /** Disable MFA — requires a valid current code to prevent lockout abuse. */
  async disableMfa(userId: string, code: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (!user.mfaEnabled || !user.mfaSecret) throw new AppError('MFA is not enabled', 400, 'MFA_NOT_ENABLED');
    if (!this.verifyTotp(user.mfaSecret, code)) {
      throw new AppError('Invalid MFA code', 400, 'INVALID_MFA_CODE');
    }
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    await user.save();
  }

  async login(
    email: string,
    password: string,
    mfaCode?: string,
  ): Promise<{ user: IUserDocument; tokens: TokenPair }> {
    const emailHash = sha256(email);
    const user = await User.findOne({ emailHash });
    if (!user || !user.active) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // MFA check — TOTP (RFC 6238), compatible with any authenticator app.
    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new AppError('MFA code required', 401, 'MFA_REQUIRED');
      }
      if (!user.mfaSecret || !this.verifyTotp(user.mfaSecret, mfaCode)) {
        throw new AppError('Invalid MFA code', 401, 'INVALID_MFA_CODE');
      }
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await this.generateTokens(user);
    return { user, tokens };
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

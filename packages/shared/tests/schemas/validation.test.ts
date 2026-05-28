import { describe, it, expect } from '@jest/globals';
import {
  createUserSchema, loginSchema,
  createResourceSchema, resourceQuerySchema,
  createEventSchema, rsvpSchema,
  createPrayerSchema,
  createGroupSchema,
  createPageSchema,
  createSermonSchema,
  createMessageSchema,
  createDonationSchema, createFundSchema,
  federationRequestSchema, emergencyBroadcastSchema,
} from '../../src/schemas/index.js';

describe('Zod Schemas', () => {
  describe('user schemas', () => {
    it('should validate a valid user creation', () => {
      const result = createUserSchema.safeParse({
        email: 'pastor@church.org',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Smith',
      });
      expect(result.success).toBe(true);
    });

    it('should apply defaults for optional fields', () => {
      const result = createUserSchema.parse({
        email: 'test@test.com',
        password: 'SecurePass123',
        firstName: 'Test',
        lastName: 'User',
      });
      // SECURITY: role is intentionally not part of createUserSchema — public
      // registration must never set its own privilege level.
      expect('role' in result).toBe(false);
      expect(result.locale).toBe('en');
      expect(result.privacySettings.showInDirectory).toBe(false);
    });

    it('should strip a client-supplied role on registration', () => {
      const result = createUserSchema.parse({
        email: 'test@test.com',
        password: 'SecurePass123',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
      } as Record<string, unknown>);
      expect('role' in result).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = createUserSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = createUserSchema.safeParse({
        email: 'test@test.com',
        password: 'short',
        firstName: 'Test',
        lastName: 'User',
      });
      expect(result.success).toBe(false);
    });

    it('should validate login with MFA', () => {
      const result = loginSchema.safeParse({
        email: 'test@test.com',
        password: 'password123',
        mfaCode: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric MFA code', () => {
      const result = loginSchema.safeParse({
        email: 'test@test.com',
        password: 'password123',
        mfaCode: 'abcdef',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('resource schemas', () => {
    const validResource = {
      name: 'Community Food Bank',
      description: 'Free food distribution every Saturday',
      category: 'food' as const,
      provider: 'Local Church Alliance',
      eligibility: 'Any community member in need',
      hours: 'Saturdays 9am-12pm',
      address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
    };

    it('should validate a valid resource', () => {
      expect(createResourceSchema.safeParse(validResource).success).toBe(true);
    });

    it('should reject invalid category', () => {
      expect(createResourceSchema.safeParse({ ...validResource, category: 'invalid' }).success).toBe(false);
    });

    it('should validate query with defaults', () => {
      const result = resourceQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('event schemas', () => {
    it('should reject end date before start date', () => {
      const result = createEventSchema.safeParse({
        title: 'Test Event',
        startDate: '2026-06-15T10:00:00Z',
        endDate: '2026-06-14T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('should validate a valid event', () => {
      const result = createEventSchema.safeParse({
        title: 'Sunday Service',
        startDate: '2026-06-15T10:00:00Z',
        endDate: '2026-06-15T12:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate RSVP', () => {
      expect(rsvpSchema.safeParse({ status: 'yes', headcount: 3 }).success).toBe(true);
      expect(rsvpSchema.safeParse({ status: 'invalid' }).success).toBe(false);
    });
  });

  describe('prayer schemas', () => {
    it('should validate with defaults', () => {
      const result = createPrayerSchema.parse({ content: 'Please pray for healing' });
      expect(result.anonymous).toBe(true);
      expect(result.visibility).toBe('congregation');
      expect(result.meshEnabled).toBe(false);
    });

    it('should reject empty content', () => {
      expect(createPrayerSchema.safeParse({ content: '' }).success).toBe(false);
    });
  });

  describe('group schemas', () => {
    it('should validate a valid group', () => {
      const result = createGroupSchema.safeParse({
        name: 'Wednesday Night Bible Study',
      });
      expect(result.success).toBe(true);
    });

    it('should apply default type', () => {
      const result = createGroupSchema.parse({ name: 'Test Group' });
      expect(result.type).toBe('small_group');
    });
  });

  describe('page schemas', () => {
    it('should validate a valid page', () => {
      const result = createPageSchema.safeParse({
        title: 'About Us',
        slug: 'about-us',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid slug format', () => {
      expect(createPageSchema.safeParse({ title: 'Test', slug: 'Invalid Slug!' }).success).toBe(false);
    });
  });

  describe('sermon schemas', () => {
    it('should validate a valid sermon', () => {
      const result = createSermonSchema.safeParse({
        title: 'Walking in Faith',
        speaker: 'Pastor John',
        date: '2026-03-02',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('communication schemas', () => {
    it('should validate message with audience', () => {
      const result = createMessageSchema.safeParse({
        subject: 'Sunday Update',
        body: '<p>Hello church family!</p>',
        channel: 'email',
        audience: { type: 'all' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject group audience without groupIds', () => {
      const result = createMessageSchema.safeParse({
        subject: 'Test',
        body: 'Test',
        channel: 'email',
        audience: { type: 'group' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('giving schemas', () => {
    it('should validate a one-time donation', () => {
      const result = createDonationSchema.safeParse({
        amount: 50,
        fund: 'General',
      });
      expect(result.success).toBe(true);
    });

    it('should reject recurring without schedule', () => {
      const result = createDonationSchema.safeParse({
        amount: 50,
        fund: 'General',
        recurring: true,
      });
      expect(result.success).toBe(false);
    });

    it('should validate recurring with schedule', () => {
      const result = createDonationSchema.safeParse({
        amount: 50,
        fund: 'General',
        recurring: true,
        recurringSchedule: 'monthly',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('connect schemas', () => {
    it('should validate federation request', () => {
      const result = federationRequestSchema.safeParse({
        instanceUrl: 'https://church.example.com',
        instanceName: 'First Baptist',
        publicKey: 'ed25519-public-key-here',
      });
      expect(result.success).toBe(true);
    });

    it('should validate emergency broadcast', () => {
      const result = emergencyBroadcastSchema.safeParse({
        severity: 'disaster',
        title: 'Flooding in River Valley',
        description: 'Severe flooding has displaced 200 families',
        needs: [{ type: 'blankets', description: '200 blankets needed' }],
        location: { city: 'River Valley', state: 'KY' },
        contactMethod: 'Call 555-0100',
        expiresAt: '2026-04-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one need in broadcast', () => {
      const result = emergencyBroadcastSchema.safeParse({
        severity: 'need',
        title: 'Test',
        description: 'Test',
        needs: [],
        location: { city: 'Test', state: 'KY' },
        contactMethod: 'Test',
        expiresAt: '2026-04-01',
      });
      expect(result.success).toBe(false);
    });
  });
});

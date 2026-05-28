import { z } from 'zod';

export const privacySettingsSchema = z.object({
  showInDirectory: z.boolean().default(false),
  showEmail: z.boolean().default(false),
  showPhone: z.boolean().default(false),
  allowCareTracking: z.boolean().default(false),
});

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(10).max(128)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  // SECURITY: role is intentionally NOT accepted on self-registration. Public
  // sign-up must never set its own privilege level. Roles are assigned only via
  // the admin-only PATCH /api/members/:id/role endpoint (assignRoleSchema).
  locale: z.string().min(2).max(10).default('en'),
  timezone: z.string().max(50).default('America/New_York'),
  privacySettings: privacySettingsSchema.default(() => ({
    showInDirectory: false,
    showEmail: false,
    showPhone: false,
    allowCareTracking: false,
  })),
});

export const userRoleSchema = z.enum(['admin', 'pastor', 'leader', 'member', 'visitor']);

// Admin-only: assign a role to an existing user's account.
export const assignRoleSchema = z.object({
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional().nullable(),
  locale: z.string().min(2).max(10),
  timezone: z.string().max(50),
  privacySettings: privacySettingsSchema,
}).partial();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  mfaCode: z.string().length(6).regex(/^\d{6}$/).optional(),
});

export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'MFA code must be 6 digits'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(128)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;

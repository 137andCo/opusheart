import { z } from 'zod';

export const federationRequestSchema = z.object({
  instanceUrl: z.string().url(),
  instanceName: z.string().min(1).max(200).trim(),
  publicKey: z.string().min(1),
  participationLevel: z.enum(['isolated', 'prayer_only', 'mutual_aid', 'full_mesh', 'custom']).default('prayer_only'),
});

export const emergencyBroadcastSchema = z.object({
  severity: z.enum(['need', 'urgent', 'disaster']),
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  needs: z.array(z.object({
    type: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    quantity: z.number().positive().optional(),
    unit: z.string().max(50).optional(),
  })).min(1),
  location: z.object({
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    country: z.string().min(1).max(100).default('US'),
  }),
  contactMethod: z.string().min(1).max(200).trim(),
  maxHops: z.number().int().min(1).max(10).default(3),
  expiresAt: z.coerce.date(),
});

export const pledgeSchema = z.object({
  needIndex: z.number().int().min(0),
  quantity: z.number().positive(),
  unit: z.string().max(50).optional(),
});

export type FederationRequestInput = z.infer<typeof federationRequestSchema>;
export type EmergencyBroadcastInput = z.infer<typeof emergencyBroadcastSchema>;
export type PledgeInput = z.infer<typeof pledgeSchema>;

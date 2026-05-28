import { z } from 'zod';

const prayerCategories = [
  'health', 'family', 'provision', 'gratitude',
  'grief', 'community', 'guidance', 'other',
] as const;

export const createPrayerSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  category: z.enum(prayerCategories).default('other'),
  anonymous: z.boolean().default(true),
  visibility: z.enum(['pastor_only', 'congregation', 'mesh']).default('congregation'),
  meshEnabled: z.boolean().default(false),
});

export const updatePrayerSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  category: z.enum(prayerCategories),
  visibility: z.enum(['pastor_only', 'congregation', 'mesh']),
  meshEnabled: z.boolean(),
  status: z.enum(['active', 'answered', 'archived']),
}).partial();

export const prayerQuerySchema = z.object({
  category: z.enum(prayerCategories).optional(),
  status: z.enum(['active', 'answered', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePrayerInput = z.infer<typeof createPrayerSchema>;
export type UpdatePrayerInput = z.infer<typeof updatePrayerSchema>;

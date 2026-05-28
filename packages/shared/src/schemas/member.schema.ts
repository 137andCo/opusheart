import { z } from 'zod';

export const createMemberSchema = z.object({
  userId: z.string().min(1),
  householdId: z.string().optional(),
  membershipStatus: z.enum(['active', 'inactive', 'visitor', 'archived']).default('visitor'),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  attendanceOptIn: z.boolean().default(false),
});

export const updateMemberSchema = createMemberSchema.omit({ userId: true }).partial();

export const memberQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'visitor', 'archived']).optional(),
  householdId: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  address: z.object({
    street: z.string().min(1).max(200).trim(),
    city: z.string().min(1).max(100).trim(),
    state: z.string().min(1).max(100).trim(),
    zip: z.string().min(1).max(20).trim(),
    country: z.string().min(1).max(100).trim().default('US'),
  }).optional(),
});

export const updateHouseholdSchema = createHouseholdSchema.partial();

export const householdQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCareNoteSchema = z.object({
  memberId: z.string().min(1),
  type: z.enum(['visit', 'hospital', 'bereavement', 'meal_train', 'follow_up', 'general']),
  content: z.string().min(1).max(5000).trim(),
  followUpDate: z.coerce.date().optional(),
});

export const updateCareNoteSchema = createCareNoteSchema.omit({ memberId: true }).partial();

export const careNoteQuerySchema = z.object({
  type: z.enum(['visit', 'hospital', 'bereavement', 'meal_train', 'follow_up', 'general']).optional(),
  resolved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

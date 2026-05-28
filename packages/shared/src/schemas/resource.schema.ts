import { z } from 'zod';

const resourceAddressSchema = z.object({
  street: z.string().min(1).max(200).trim(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().min(1).max(100).trim(),
  zip: z.string().min(1).max(20).trim(),
  country: z.string().min(1).max(100).trim().default('US'),
});

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const resourceCategories = [
  'food', 'housing', 'utilities', 'medical', 'mental_health',
  'employment', 'education', 'legal', 'transportation', 'clothing',
  'financial', 'childcare', 'senior_services', 'disability',
  'substance_abuse', 'domestic_violence', 'veterans', 'other',
] as const;

export const createResourceSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(2000).trim(),
  category: z.enum(resourceCategories),
  subcategory: z.string().max(100).trim().optional(),
  provider: z.string().min(1).max(200).trim(),
  eligibility: z.string().min(1).max(1000).trim(),
  hours: z.string().min(1).max(500).trim(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  address: resourceAddressSchema,
  location: geoPointSchema.optional(),
  languages: z.array(z.string().max(50)).default(['en']),
  tags: z.array(z.string().max(50)).default([]),
  featured: z.boolean().default(false),
});

export const updateResourceSchema = createResourceSchema.partial();

export const resourceQuerySchema = z.object({
  category: z.enum(resourceCategories).optional(),
  search: z.string().max(200).optional(),
  language: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const submitResourceSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(2000).trim(),
  category: z.enum(resourceCategories),
  subcategory: z.string().max(100).trim().optional(),
  provider: z.string().min(1).max(200).trim(),
  eligibility: z.string().min(1).max(1000).trim(),
  hours: z.string().min(1).max(500).trim(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  address: resourceAddressSchema,
  location: geoPointSchema.optional(),
  languages: z.array(z.string().max(50)).default(['en']),
  tags: z.array(z.string().max(50)).default([]),
  // Submitter info (for non-authenticated submissions)
  submitterName: z.string().min(1).max(200).trim(),
  submitterEmail: z.string().email(),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  maxKm: z.coerce.number().min(1).max(200).default(25),
  category: z.enum(resourceCategories).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const submissionQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const rejectSubmissionSchema = z.object({
  notes: z.string().min(1).max(1000).trim(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type ResourceQuery = z.infer<typeof resourceQuerySchema>;
export type SubmitResourceInput = z.infer<typeof submitResourceSchema>;
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;
export type SubmissionQuery = z.infer<typeof submissionQuerySchema>;
export type RejectSubmissionInput = z.infer<typeof rejectSubmissionSchema>;

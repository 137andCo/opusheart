import { z } from 'zod';

export const createSermonSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  speaker: z.string().min(1).max(100).trim(),
  date: z.coerce.date(),
  series: z.string().max(200).trim().optional(),
  seriesOrder: z.number().int().min(0).optional(),
  description: z.string().max(5000).trim().default(''),
  scriptureReferences: z.array(z.string().max(100)).default([]),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  notes: z.string().optional(),
  outline: z.string().optional(),
  tags: z.array(z.string().max(50)).default([]),
  published: z.boolean().default(false),
  podcastInclude: z.boolean().default(true),
});

export const updateSermonSchema = createSermonSchema.partial();

export const sermonQuerySchema = z.object({
  series: z.string().optional(),
  speaker: z.string().optional(),
  search: z.string().max(200).optional(),
  published: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSermonInput = z.infer<typeof createSermonSchema>;
export type UpdateSermonInput = z.infer<typeof updateSermonSchema>;

export const createSeriesSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().default(''),
  imageUrl: z.string().url().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const updateSeriesSchema = createSeriesSchema.partial();

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;

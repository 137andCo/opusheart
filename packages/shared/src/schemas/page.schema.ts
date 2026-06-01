import { z } from 'zod';

const pageBlockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(pageBlockSchema).optional(),
    text: z.string().optional(),
    marks: z.array(z.object({
      type: z.string(),
      attrs: z.record(z.string(), z.unknown()).optional(),
    })).optional(),
  })
);

const pageSeoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(160).optional(),
  ogImage: z.string().url().optional(),
  noIndex: z.boolean().default(false),
});

export const createPageSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  content: z.array(pageBlockSchema as z.ZodType).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  template: z.string().optional(),
  seo: pageSeoSchema.default(() => ({ noIndex: false })),
  locale: z.string().min(2).max(10).default('en'),
});

export const updatePageSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content: z.array(pageBlockSchema as z.ZodType),
  status: z.enum(['draft', 'published', 'archived']),
  template: z.string().optional().nullable(),
  seo: pageSeoSchema,
  locale: z.string().min(2).max(10),
}).partial();

export const pageQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().max(200).optional(),
  locale: z.string().max(10).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.string().max(200).optional(),
  // Opt-in "bolder" levers: a distinctive heading typeface and a tasteful
  // entrance animation. Both default off so the shipped look stays calm.
  headingFont: z.string().max(200).optional(),
  enableMotion: z.boolean().optional(),
  logoUrl: z.string().url().optional().nullable(),
  faviconUrl: z.string().url().optional().nullable(),
  customCss: z.string().max(50000).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;

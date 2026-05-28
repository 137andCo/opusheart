import { z } from 'zod';

const volunteerSlotSchema = z.object({
  role: z.string().min(1).max(100).trim(),
  needed: z.number().int().min(1).max(500),
});

const recurrenceRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(365).default(1),
  dayOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  endDate: z.coerce.date().optional(),
  exceptions: z.array(z.coerce.date()).default([]),
});

export const createEventSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().default(''),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  allDay: z.boolean().default(false),
  location: z.string().max(300).trim().default(''),
  recurring: recurrenceRuleSchema.optional(),
  visibility: z.enum(['public', 'members', 'leaders']).default('public'),
  volunteerSlots: z.array(volunteerSlotSchema).default([]),
  maxAttendees: z.number().int().min(1).optional(),
  registrationRequired: z.boolean().default(false),
}).refine(data => data.endDate >= data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  allDay: z.boolean(),
  location: z.string().max(300).trim(),
  recurring: recurrenceRuleSchema.optional().nullable(),
  visibility: z.enum(['public', 'members', 'leaders']),
  volunteerSlots: z.array(volunteerSlotSchema),
  maxAttendees: z.number().int().min(1).optional().nullable(),
  registrationRequired: z.boolean(),
}).partial();

export const rsvpSchema = z.object({
  status: z.enum(['yes', 'no', 'maybe']),
  headcount: z.number().int().min(1).max(20).default(1),
});

export const eventQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  visibility: z.enum(['public', 'members', 'leaders']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;

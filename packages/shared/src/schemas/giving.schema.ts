import { z } from 'zod';

export const createDonationSchema = z.object({
  amount: z.number().positive().max(1000000),
  currency: z.string().length(3).default('USD'),
  fund: z.string().min(1).max(100).trim(),
  method: z.enum(['online', 'cash', 'check', 'other']).default('online'),
  recurring: z.boolean().default(false),
  recurringSchedule: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  notes: z.string().max(500).trim().optional(),
}).refine(data => {
  if (data.recurring && !data.recurringSchedule) return false;
  return true;
}, { message: 'Recurring donations must specify a schedule' });

export const createFundSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(1000).trim().default(''),
  goal: z.number().positive().optional(),
  active: z.boolean().default(true),
});

export const updateFundSchema = createFundSchema.partial();

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
export type CreateFundInput = z.infer<typeof createFundSchema>;

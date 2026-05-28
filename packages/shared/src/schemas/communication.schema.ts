import { z } from 'zod';

const audienceSchema = z.object({
  type: z.enum(['all', 'group', 'role', 'custom']),
  groupIds: z.array(z.string()).optional(),
  roles: z.array(z.enum(['admin', 'pastor', 'leader', 'member', 'visitor'])).optional(),
  memberIds: z.array(z.string()).optional(),
}).refine(data => {
  if (data.type === 'group' && (!data.groupIds || data.groupIds.length === 0)) return false;
  if (data.type === 'role' && (!data.roles || data.roles.length === 0)) return false;
  if (data.type === 'custom' && (!data.memberIds || data.memberIds.length === 0)) return false;
  return true;
}, { message: 'Audience must include relevant IDs for the selected type' });

export const createMessageSchema = z.object({
  subject: z.string().min(1).max(200).trim(),
  body: z.string().min(1).max(50000),
  bodyPlain: z.string().max(50000).default(''),
  channel: z.enum(['email', 'push', 'sms', 'announcement']),
  audience: audienceSchema,
  scheduledFor: z.coerce.date().optional(),
});

export const updateMessageSchema = z.object({
  subject: z.string().min(1).max(200).trim(),
  body: z.string().min(1).max(50000),
  bodyPlain: z.string().max(50000),
  scheduledFor: z.coerce.date().optional().nullable(),
}).partial();

export const messageQuerySchema = z.object({
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

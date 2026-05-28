import { z } from 'zod';

const groupTypes = [
  'small_group', 'bible_study', 'committee',
  'ministry', 'team', 'class', 'custom',
] as const;

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(2000).trim().default(''),
  type: z.enum(groupTypes).default('small_group'),
  visibility: z.enum(['public', 'members', 'invite_only']).default('members'),
  meetingSchedule: z.string().max(200).trim().optional(),
  location: z.string().max(200).trim().optional(),
  maxMembers: z.number().int().min(2).optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(2000).trim(),
  type: z.enum(groupTypes),
  visibility: z.enum(['public', 'members', 'invite_only']),
  meetingSchedule: z.string().max(200).trim(),
  location: z.string().max(200).trim(),
  maxMembers: z.number().int().min(2),
  active: z.boolean(),
}).partial();

export const groupQuerySchema = z.object({
  type: z.enum(groupTypes).optional(),
  visibility: z.enum(['public', 'members', 'invite_only']).optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const addMaterialSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  type: z.enum(['document', 'link', 'video', 'file']),
  url: z.string().url().max(2000).refine(
    (val) => /^https?:\/\//i.test(val),
    { message: 'URL must use http or https protocol' },
  ),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type AddMaterialInput = z.infer<typeof addMaterialSchema>;

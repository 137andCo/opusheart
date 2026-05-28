import type { UserRole } from './user.js';

export type MessageChannel = 'email' | 'push' | 'sms' | 'announcement';
export type MessageStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  subject: string;
  body: string;
  bodyPlain: string;
  channel: MessageChannel;
  audience: MessageAudience;
  sentBy: string;
  scheduledFor?: Date;
  sentAt?: Date;
  status: MessageStatus;
  deliveryStats?: DeliveryStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAudience {
  type: 'all' | 'group' | 'role' | 'custom';
  groupIds?: string[];
  roles?: UserRole[];
  memberIds?: string[];
}

export interface DeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  opened: number;
}

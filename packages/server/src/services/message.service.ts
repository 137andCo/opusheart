import { Message, type IMessageDocument } from '../models/Message.js';
import { AppError } from '../utils/errors.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import { audienceService } from './audience.service.js';
import { emailService } from './email.service.js';
import { pushService } from './push.service.js';
import type { CreateMessageInput } from '@opusheart/shared/schemas/communication.schema.js';

/** Strip tags for a plain-text fallback (push body / email text part). */
function toPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export class MessageService {
  async create(data: CreateMessageInput, sentBy: string): Promise<IMessageDocument> {
    const status = data.scheduledFor ? 'scheduled' : 'draft';
    const sanitizedData = { ...data, body: sanitizeHtml(data.body) };
    const message = await Message.create({ ...sanitizedData, sentBy, status });
    return message;
  }

  async findById(id: string): Promise<IMessageDocument> {
    const message = await Message.findById(id);
    if (!message) throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    return message;
  }

  async findAll(query: { status?: string; page?: number; limit?: number }): Promise<{
    messages: IMessageDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};
    if (query.status) filter['status'] = query.status;

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Message.countDocuments(filter),
    ]);

    return { messages, total, page, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, data: Partial<CreateMessageInput>): Promise<IMessageDocument> {
    const message = await Message.findById(id);
    if (!message) throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    if (message.status === 'sent' || message.status === 'sending') {
      throw new AppError('Cannot edit a sent or sending message', 400, 'MESSAGE_LOCKED');
    }
    const sanitizedData = data.body ? { ...data, body: sanitizeHtml(data.body) } : data;
    Object.assign(message, sanitizedData);
    if (data.scheduledFor && message.status === 'draft') {
      message.status = 'scheduled';
    }
    await message.save();
    return message;
  }

  async delete(id: string): Promise<void> {
    const message = await Message.findById(id);
    if (!message) throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    if (message.status === 'sent' || message.status === 'sending') {
      throw new AppError('Cannot delete a sent or sending message', 400, 'MESSAGE_LOCKED');
    }
    await message.deleteOne();
  }

  async send(id: string): Promise<IMessageDocument> {
    const message = await Message.findById(id);
    if (!message) throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    if (message.status === 'sent') {
      throw new AppError('Message already sent', 400, 'ALREADY_SENT');
    }
    message.status = 'sending';
    await message.save();

    try {
      const stats = await this.deliver(message);
      message.deliveryStats = { total: stats.total, delivered: stats.delivered, failed: stats.failed, opened: 0 };
      message.status = 'sent';
      message.sentAt = new Date();
      await message.save();
      return message;
    } catch (err) {
      message.status = 'failed';
      await message.save();
      throw err;
    }
  }

  /** Fan a message out over its channel to the resolved audience. */
  private async deliver(message: IMessageDocument): Promise<{ total: number; delivered: number; failed: number }> {
    switch (message.channel) {
      case 'announcement':
        // In-app announcement — surfaced in the UI, no external delivery.
        return { total: 0, delivered: 0, failed: 0 };
      case 'email': {
        const emails = await audienceService.resolveEmails(message.audience);
        if (!emails.length) return { total: 0, delivered: 0, failed: 0 };
        const text = message.bodyPlain || toPlainText(message.body);
        const { sent, failed } = await emailService.sendBulk(emails, message.subject, message.body, text);
        return { total: emails.length, delivered: sent, failed };
      }
      case 'push': {
        const userIds = await audienceService.resolveUserIds(message.audience);
        if (!userIds.length) return { total: 0, delivered: 0, failed: 0 };
        const body = message.bodyPlain || toPlainText(message.body);
        const { sent, failed } = await pushService.sendBulk(userIds, { title: message.subject, body });
        return { total: userIds.length, delivered: sent, failed };
      }
      case 'sms':
        // SMS is a documented future (bring-your-own-provider) feature.
        throw new AppError('SMS delivery is not yet available', 400, 'SMS_NOT_AVAILABLE');
      default:
        return { total: 0, delivered: 0, failed: 0 };
    }
  }

  async cancelScheduled(id: string): Promise<IMessageDocument> {
    const message = await Message.findById(id);
    if (!message) throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    if (message.status !== 'scheduled') {
      throw new AppError('Only scheduled messages can be cancelled', 400, 'NOT_SCHEDULED');
    }
    message.status = 'draft';
    message.scheduledFor = undefined;
    await message.save();
    return message;
  }
}

export const messageService = new MessageService();

import { Message, type IMessageDocument } from '../models/Message.js';
import { AppError } from '../utils/errors.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import type { CreateMessageInput } from '@opusheart/shared/schemas/communication.schema.js';

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
    // Actual delivery delegated to email/push/sms services
    message.status = 'sent';
    message.sentAt = new Date();
    await message.save();
    return message;
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

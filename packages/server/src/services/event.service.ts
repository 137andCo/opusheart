import { Event, type IEventDocument } from '../models/Event.js';
import { AppError } from '../utils/errors.js';
import type { CreateEventInput, RsvpInput } from '@opusheart/shared/schemas/event.schema.js';

export class EventService {
  async create(data: CreateEventInput, createdBy: string): Promise<IEventDocument> {
    const event = await Event.create({ ...data, createdBy });
    return event;
  }

  async findById(id: string): Promise<IEventDocument> {
    const event = await Event.findById(id);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    return event;
  }

  async findAll(query: {
    from?: Date;
    to?: Date;
    visibility?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    events: IEventDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};

    if (query.from) filter['startDate'] = { ...((filter['startDate'] as object) || {}), $gte: query.from };
    if (query.to) filter['startDate'] = { ...((filter['startDate'] as object) || {}), $lte: query.to };
    if (query.visibility) filter['visibility'] = query.visibility;

    const [events, total] = await Promise.all([
      Event.find(filter).sort({ startDate: 1 }).skip((page - 1) * limit).limit(limit),
      Event.countDocuments(filter),
    ]);

    return { events, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findPublic(query: {
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    events: IEventDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.findAll({ ...query, visibility: 'public' });
  }

  async update(id: string, data: Partial<CreateEventInput>): Promise<IEventDocument> {
    const event = await Event.findById(id);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    Object.assign(event, data);
    await event.save();
    return event;
  }

  async delete(id: string): Promise<void> {
    const event = await Event.findById(id);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    await event.deleteOne();
  }

  async rsvp(eventId: string, userId: string, data: RsvpInput): Promise<IEventDocument> {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');

    if (data.status === 'yes' && event.maxAttendees) {
      const currentYes = event.rsvps
        .filter(r => r.userId.toString() !== userId && r.status === 'yes')
        .reduce((sum, r) => sum + r.headcount, 0);
      if (currentYes + data.headcount > event.maxAttendees) {
        throw new AppError('Event is full', 409, 'EVENT_FULL');
      }
    }

    const existing = event.rsvps.find(r => r.userId.toString() === userId);
    if (existing) {
      existing.status = data.status;
      existing.headcount = data.headcount;
      existing.respondedAt = new Date();
    } else {
      // Cap embedded RSVPs array to prevent unbounded document growth
      if (event.rsvps.length >= 5000) {
        throw new AppError('RSVP limit reached for this event', 409, 'RSVP_LIMIT');
      }
      event.rsvps.push({
        userId: userId as any,
        status: data.status,
        headcount: data.headcount,
        respondedAt: new Date(),
      });
    }

    await event.save();
    return event;
  }

  async volunteerSignup(eventId: string, userId: string, role: string): Promise<IEventDocument> {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');

    const slot = event.volunteerSlots.find(s => s.role === role);
    if (!slot) throw new AppError('Volunteer slot not found', 404, 'SLOT_NOT_FOUND');
    if (slot.filled.length >= slot.needed || slot.filled.length >= 500) {
      throw new AppError('Volunteer slot is full', 409, 'SLOT_FULL');
    }
    if (slot.filled.some(id => id.toString() === userId)) {
      throw new AppError('Already signed up for this slot', 409, 'ALREADY_SIGNED_UP');
    }

    slot.filled.push(userId as any);
    await event.save();
    return event;
  }

  async volunteerWithdraw(eventId: string, userId: string, role: string): Promise<IEventDocument> {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');

    const slot = event.volunteerSlots.find(s => s.role === role);
    if (!slot) throw new AppError('Volunteer slot not found', 404, 'SLOT_NOT_FOUND');

    slot.filled = slot.filled.filter(id => id.toString() !== userId) as any;
    await event.save();
    return event;
  }
}

export const eventService = new EventService();

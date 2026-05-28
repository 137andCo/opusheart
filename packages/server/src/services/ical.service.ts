import ical, { ICalCalendarMethod } from 'ical-generator';
import { Event } from '../models/Event.js';

export class ICalService {
  async generateCalendar(query?: { from?: Date; to?: Date; visibility?: string }): Promise<string> {
    const filter: Record<string, unknown> = {};
    if (query?.visibility) filter['visibility'] = query.visibility;
    if (query?.from || query?.to) {
      filter['startDate'] = {};
      if (query?.from) (filter['startDate'] as any).$gte = query.from;
      if (query?.to) (filter['startDate'] as any).$lte = query.to;
    }
    const events = await Event.find(filter).sort({ startDate: 1 }).limit(500);
    const cal = ical({ name: 'OpusHeart Events', method: ICalCalendarMethod.PUBLISH });
    for (const event of events) {
      cal.createEvent({
        start: event.startDate,
        end: event.endDate,
        summary: event.title,
        description: event.description,
        location: event.location,
        allDay: event.allDay,
      });
    }
    return cal.toString();
  }
}

export const icalService = new ICalService();

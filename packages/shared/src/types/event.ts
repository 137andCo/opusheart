export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location: string;
  recurring?: RecurrenceRule;
  visibility: EventVisibility;
  volunteerSlots: VolunteerSlot[];
  rsvps: Rsvp[];
  bookedResources: string[];
  maxAttendees?: number;
  registrationRequired: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EventVisibility = 'public' | 'members' | 'leaders';

export interface VolunteerSlot {
  role: string;
  needed: number;
  filled: string[];
}

export interface Rsvp {
  userId: string;
  status: 'yes' | 'no' | 'maybe';
  headcount: number;
  respondedAt: Date;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  interval: number;
  dayOfWeek?: number[];
  endDate?: Date;
  exceptions: Date[];
}

export interface BookableResource {
  id: string;
  name: string;
  type: 'room' | 'vehicle' | 'equipment' | 'other';
  description?: string;
  capacity?: number;
  active: boolean;
}

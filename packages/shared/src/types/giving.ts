export type DonationMethod = 'online' | 'cash' | 'check' | 'other';
export type DonationStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type RecurringSchedule = 'weekly' | 'biweekly' | 'monthly';

export interface Donation {
  id: string;
  memberId: string;
  amount: number;
  currency: string;
  fund: string;
  method: DonationMethod;
  recurring: boolean;
  recurringSchedule?: RecurringSchedule;
  processorId?: string;
  status: DonationStatus;
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Fund {
  id: string;
  name: string;
  description: string;
  goal?: number;
  raised: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GivingStatement {
  id: string;
  memberId: string;
  year: number;
  totalAmount: number;
  donations: string[];
  generatedAt: Date;
  pdfUrl?: string;
}

import { Fund, type IFundDocument } from '../models/Fund.js';
import { Donation, type IDonationDocument } from '../models/Donation.js';
import { AppError } from '../utils/errors.js';
import type { CreateFundInput, CreateDonationInput } from '@opusheart/shared/schemas/giving.schema.js';

export class GivingService {
  // ─── Fund CRUD ─────────────────────────────────────────────

  async createFund(data: CreateFundInput): Promise<IFundDocument> {
    return Fund.create(data);
  }

  async findFundById(id: string): Promise<IFundDocument> {
    const fund = await Fund.findById(id);
    if (!fund) throw new AppError('Fund not found', 404, 'FUND_NOT_FOUND');
    return fund;
  }

  async findAllFunds(query: {
    page?: number;
    limit?: number;
  } = {}): Promise<{
    funds: IFundDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const [funds, total] = await Promise.all([
      Fund.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Fund.countDocuments(),
    ]);

    return { funds, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findActiveFunds(): Promise<IFundDocument[]> {
    return Fund.find({ active: true }).sort({ createdAt: -1 }).limit(100);
  }

  async updateFund(id: string, data: Partial<CreateFundInput>): Promise<IFundDocument> {
    const fund = await Fund.findById(id);
    if (!fund) throw new AppError('Fund not found', 404, 'FUND_NOT_FOUND');
    Object.assign(fund, data);
    await fund.save();
    return fund;
  }

  async deleteFund(id: string): Promise<void> {
    const fund = await Fund.findById(id);
    if (!fund) throw new AppError('Fund not found', 404, 'FUND_NOT_FOUND');
    await fund.deleteOne();
  }

  // ─── Donations ─────────────────────────────────────────────

  async recordDonation(data: CreateDonationInput, memberId: string): Promise<IDonationDocument> {
    // Verify fund exists
    const fund = await Fund.findById(data.fund);
    if (!fund) throw new AppError('Fund not found', 404, 'FUND_NOT_FOUND');

    const donation = await Donation.create({
      ...data,
      memberId,
      status: 'completed',
      date: new Date(),
    });

    // Atomically increment fund.raised
    await Fund.findByIdAndUpdate(data.fund, { $inc: { raised: data.amount } });

    return donation;
  }

  async findDonations(query: {
    fund?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    donations: IDonationDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};

    if (query.fund) filter['fund'] = query.fund;
    if (query.status) filter['status'] = query.status;
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (query.startDate) dateFilter['$gte'] = new Date(query.startDate);
      if (query.endDate) dateFilter['$lte'] = new Date(query.endDate);
      filter['date'] = dateFilter;
    }

    const [donations, total] = await Promise.all([
      Donation.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
      Donation.countDocuments(filter),
    ]);

    return { donations, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findByMember(memberId: string, query: {
    page?: number;
    limit?: number;
  } = {}): Promise<{
    donations: IDonationDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter = { memberId };

    const [donations, total] = await Promise.all([
      Donation.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
      Donation.countDocuments(filter),
    ]);

    return { donations, total, page, totalPages: Math.ceil(total / limit) };
  }

  async refundDonation(id: string): Promise<IDonationDocument> {
    const donation = await Donation.findById(id);
    if (!donation) throw new AppError('Donation not found', 404, 'DONATION_NOT_FOUND');
    if (donation.status === 'refunded') throw new AppError('Donation already refunded', 400, 'ALREADY_REFUNDED');

    donation.status = 'refunded';
    await donation.save();

    // Atomically decrement fund.raised
    await Fund.findByIdAndUpdate(donation.fund, { $inc: { raised: -donation.amount } });

    return donation;
  }

  async generateStatement(memberId: string, year: number): Promise<{
    year: number;
    totalAmount: number;
    donations: IDonationDocument[];
  }> {
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const donations = await Donation.find({
      memberId,
      status: 'completed',
      date: { $gte: startDate, $lt: endDate },
    }).sort({ date: -1 }).limit(1000);

    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);

    return { year, totalAmount, donations };
  }
}

export const givingService = new GivingService();

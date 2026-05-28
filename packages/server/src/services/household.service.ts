import { Household, type IHouseholdDocument } from '../models/Household.js';
import { Member } from '../models/Member.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

interface HouseholdQuery {
  search?: string;
  page: number;
  limit: number;
}

interface PaginatedResult {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class HouseholdService {
  constructor(private config: AppConfig) {}

  async create(data: {
    name: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country?: string;
    };
  }): Promise<IHouseholdDocument> {
    const household = await Household.create({
      name: data.name,
      members: [],
      address: data.address ? {
        street: data.address.street,
        city: data.address.city,
        state: data.address.state,
        zip: data.address.zip,
        country: data.address.country || 'US',
      } : undefined,
    });

    return household;
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    const household = await Household.findById(id)
      .populate({
        path: 'members',
        populate: {
          path: 'userId',
          select: 'firstName lastName email phone role avatar',
        },
      });

    if (!household) {
      throw new AppError('Household not found', 404, 'HOUSEHOLD_NOT_FOUND');
    }

    return household.toJSON() as unknown as Record<string, unknown>;
  }

  async findAll(query: HouseholdQuery): Promise<PaginatedResult> {
    const filter: Record<string, unknown> = {};

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['name'] = { $regex: escaped, $options: 'i' };
    }

    const [households, total] = await Promise.all([
      Household.find(filter)
        .populate({
          path: 'members',
          populate: {
            path: 'userId',
            select: 'firstName lastName role avatar',
          },
        })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .sort({ name: 1 })
        .exec(),
      Household.countDocuments(filter),
    ]);

    return {
      data: households.map(h => h.toJSON() as unknown as Record<string, unknown>),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async addMember(householdId: string, memberId: string): Promise<IHouseholdDocument> {
    const household = await Household.findById(householdId);
    if (!household) {
      throw new AppError('Household not found', 404, 'HOUSEHOLD_NOT_FOUND');
    }

    const member = await Member.findById(memberId);
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    // Check if already in this household
    const alreadyMember = household.members.some(m => m.toString() === memberId);
    if (alreadyMember) {
      throw new AppError('Member already in this household', 409, 'ALREADY_IN_HOUSEHOLD');
    }

    // Remove from previous household if any
    if (member.householdId) {
      await Household.findByIdAndUpdate(member.householdId, {
        $pull: { members: member._id },
      });
    }

    // Add to new household
    household.members.push(member._id as any);
    await household.save();

    // Update member's householdId
    member.householdId = household._id as any;
    await member.save();

    return household;
  }

  async removeMember(householdId: string, memberId: string): Promise<IHouseholdDocument> {
    const household = await Household.findById(householdId);
    if (!household) {
      throw new AppError('Household not found', 404, 'HOUSEHOLD_NOT_FOUND');
    }

    const member = await Member.findById(memberId);
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    household.members = household.members.filter(m => m.toString() !== memberId);
    await household.save();

    member.householdId = undefined;
    await member.save();

    return household;
  }
}

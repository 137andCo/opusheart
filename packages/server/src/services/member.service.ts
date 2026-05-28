import { Member, type IMemberDocument } from '../models/Member.js';
import { User, type IUser } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

interface MemberQuery {
  status?: string;
  householdId?: string;
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

export class MemberService {
  constructor(private config: AppConfig) {}

  async create(data: {
    userId: string;
    householdId?: string;
    membershipStatus?: string;
    customFields?: Record<string, string | number | boolean>;
    attendanceOptIn?: boolean;
  }): Promise<IMemberDocument> {
    // Verify user exists
    const user = await User.findById(data.userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check for existing member record
    const existing = await Member.findOne({ userId: data.userId });
    if (existing) {
      throw new AppError('Member record already exists for this user', 409, 'MEMBER_EXISTS');
    }

    const member = await Member.create({
      userId: data.userId,
      householdId: data.householdId || undefined,
      membershipStatus: data.membershipStatus || 'visitor',
      customFields: data.customFields || {},
      attendanceOptIn: data.attendanceOptIn || false,
    });

    return member;
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    const member = await Member.findById(id)
      .populate('userId', 'firstName lastName email phone role avatar privacySettings')
      .populate('householdId', 'name');

    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    return member.toJSON() as unknown as Record<string, unknown>;
  }

  async findAll(query: MemberQuery, requestingUserRole: string): Promise<PaginatedResult> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter['membershipStatus'] = query.status;
    }
    if (query.householdId) {
      filter['householdId'] = query.householdId;
    }

    const isPastorOrAdmin = requestingUserRole === 'pastor' || requestingUserRole === 'admin';

    const memberQuery = Member.find(filter)
      .populate('userId', 'firstName lastName email phone role avatar privacySettings')
      .populate('householdId', 'name')
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .sort({ createdAt: -1 });

    const [members, total] = await Promise.all([
      memberQuery.exec(),
      Member.countDocuments(filter),
    ]);

    let results: Record<string, unknown>[] = members.map(m => m.toJSON() as unknown as Record<string, unknown>);

    // Search by user name (post-populate filter since names are encrypted)
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter(m => {
        const user = m['userId'] as Record<string, unknown> | null;
        if (!user) return false;
        const firstName = (user['firstName'] as string || '').toLowerCase();
        const lastName = (user['lastName'] as string || '').toLowerCase();
        return firstName.includes(searchLower) || lastName.includes(searchLower);
      });
    }

    // Privacy filtering for non-pastor/admin users
    if (!isPastorOrAdmin) {
      results = results.filter(m => {
        const user = m['userId'] as Record<string, unknown> | null;
        if (!user) return false;
        const privacy = user['privacySettings'] as Record<string, boolean> | undefined;
        return privacy?.['showInDirectory'] !== false;
      }).map(m => this.applyPrivacyFilter(m));
    }

    return {
      data: results,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async update(id: string, data: Record<string, unknown>): Promise<IMemberDocument> {
    const member = await Member.findById(id);
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    // Don't allow changing userId
    delete data['userId'];

    Object.assign(member, data);
    await member.save();
    return member;
  }

  async delete(id: string): Promise<void> {
    const member = await Member.findById(id);
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    member.membershipStatus = 'archived';
    await member.save();
  }

  /**
   * Assign a role to the User account behind a member record (admin only).
   * Bumps tokenInvalidatedAt so any outstanding access tokens carrying the old
   * role are rejected immediately and the new privilege level takes effect.
   */
  async setRole(memberId: string, role: string): Promise<{ memberId: string; userId: string; role: string }> {
    const member = await Member.findById(memberId);
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    const user = await User.findById(member.userId);
    if (!user) {
      throw new AppError('User account not found for this member', 404, 'USER_NOT_FOUND');
    }

    user.role = role as IUser['role'];
    user.tokenInvalidatedAt = new Date();
    await user.save();

    return { memberId, userId: user._id.toString(), role: user.role };
  }

  private applyPrivacyFilter(memberJson: Record<string, unknown>): Record<string, unknown> {
    const user = memberJson['userId'] as Record<string, unknown> | null;
    if (!user) return memberJson;

    const privacy = user['privacySettings'] as Record<string, boolean> | undefined;

    if (!privacy?.['showEmail']) {
      delete user['email'];
    }
    if (!privacy?.['showPhone']) {
      delete user['phone'];
    }

    return memberJson;
  }
}

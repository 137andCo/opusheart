import { MemberCareNote, type IMemberCareNoteDocument } from '../models/MemberCareNote.js';
import { Member } from '../models/Member.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import type { AppConfig } from '../config/index.js';

interface CareNoteQuery {
  type?: string;
  resolved?: boolean;
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

export class CareService {
  constructor(private config: AppConfig) {}

  async create(data: {
    memberId: string;
    type: string;
    content: string;
    followUpDate?: Date;
  }, authorId: string): Promise<IMemberCareNoteDocument> {
    // Verify member exists
    const member = await Member.findById(data.memberId);
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    // CONSENT (GDPR Art. 9): pastoral care notes are health-adjacent special-
    // category data. Only record them if the member has opted into care tracking.
    const user = await User.findById(member.userId).select('privacySettings').lean();
    if (!user?.privacySettings?.allowCareTracking) {
      throw new AppError('This member has not consented to care tracking', 403, 'CARE_CONSENT_REQUIRED');
    }

    const note = await MemberCareNote.create({
      memberId: data.memberId,
      authorId,
      type: data.type,
      content: data.content,
      followUpDate: data.followUpDate,
    });

    return note;
  }

  async findByMember(memberId: string, query: CareNoteQuery): Promise<PaginatedResult> {
    // CONSENT (GDPR Art. 9): gate READS on current consent too, not just writes.
    // If the member has withdrawn care-tracking consent, staff can no longer
    // read these special-category notes (erasure removes them entirely; this
    // stops ongoing processing the moment consent lapses).
    const member = await Member.findById(memberId).select('userId').lean();
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }
    const user = await User.findById(member.userId).select('privacySettings').lean();
    if (!user?.privacySettings?.allowCareTracking) {
      throw new AppError('This member has not consented to care tracking', 403, 'CARE_CONSENT_REQUIRED');
    }

    const filter: Record<string, unknown> = { memberId };

    if (query.type) {
      filter['type'] = query.type;
    }
    if (query.resolved !== undefined) {
      filter['resolved'] = query.resolved;
    }

    const [notes, total] = await Promise.all([
      MemberCareNote.find(filter)
        .populate('authorId', 'firstName lastName')
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .sort({ createdAt: -1 })
        .exec(),
      MemberCareNote.countDocuments(filter),
    ]);

    return {
      data: notes.map(n => n.toJSON() as unknown),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async update(id: string, data: Record<string, unknown>, requestingUserId: string, requestingUserRole: string): Promise<IMemberCareNoteDocument> {
    const note = await MemberCareNote.findById(id);
    if (!note) {
      throw new AppError('Care note not found', 404, 'CARE_NOTE_NOT_FOUND');
    }

    // Only author or admin can update
    const isAuthor = note.authorId.toString() === requestingUserId;
    const isAdmin = requestingUserRole === 'admin';
    if (!isAuthor && !isAdmin) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    // Don't allow changing memberId
    delete data['memberId'];

    Object.assign(note, data);
    await note.save();
    return note;
  }

  async resolve(id: string, requestingUserId: string, requestingUserRole: string): Promise<IMemberCareNoteDocument> {
    const note = await MemberCareNote.findById(id);
    if (!note) {
      throw new AppError('Care note not found', 404, 'CARE_NOTE_NOT_FOUND');
    }

    // Only the author or an admin can resolve (matches update()).
    const isAuthor = note.authorId.toString() === requestingUserId;
    const isAdmin = requestingUserRole === 'admin';
    if (!isAuthor && !isAdmin) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    note.resolved = true;
    await note.save();
    return note;
  }
}

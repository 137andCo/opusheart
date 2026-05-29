import { Member } from '../models/Member.js';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import type { IMessageAudience } from '../models/Message.js';

/**
 * Resolve a message audience to concrete recipients.
 *
 * IMPORTANT: emails are encrypted at rest and only decrypt through the model's
 * toJSON/toObject transform — `.lean()` or raw `doc.email` access yields
 * CIPHERTEXT. Every path that returns emails therefore reads via toJSON().
 */
export class AudienceService {
  /** Resolve the set of Member ids targeted by an audience. */
  private async resolveMemberIds(audience: IMessageAudience): Promise<string[]> {
    switch (audience.type) {
      case 'all': {
        const members = await Member.find({ membershipStatus: 'active' }).select('_id').limit(10_000).lean();
        return members.map(m => m._id.toString());
      }
      case 'group': {
        if (!audience.groupIds?.length) return [];
        const groups = await Group.find({ _id: { $in: audience.groupIds } }).select('members.userId').lean();
        const ids = new Set<string>();
        for (const g of groups) {
          for (const m of ((g.members ?? []) as Array<{ userId?: { toString(): string } }>)) {
            if (m?.userId) ids.add(m.userId.toString()); // Group.members.userId is a Member id
          }
        }
        return [...ids];
      }
      case 'custom':
        return (audience.memberIds ?? []).map(id => id.toString());
      default:
        return [];
    }
  }

  /** Resolve recipient User ids (for push). Role audiences map straight to users. */
  async resolveUserIds(audience: IMessageAudience): Promise<string[]> {
    if (audience.type === 'role') {
      const users = await User.find({ role: { $in: audience.roles ?? [] } }).select('_id').lean();
      return users.map(u => u._id.toString());
    }
    const memberIds = await this.resolveMemberIds(audience);
    if (!memberIds.length) return [];
    const members = await Member.find({ _id: { $in: memberIds } }).select('userId').lean();
    return members.map(m => m.userId?.toString()).filter((v): v is string => Boolean(v));
  }

  /** Resolve recipient email addresses (decrypted), de-duplicated. */
  async resolveEmails(audience: IMessageAudience): Promise<string[]> {
    const userIds = await this.resolveUserIds(audience);
    if (!userIds.length) return [];

    // Read through toJSON so the encrypted email field is decrypted.
    const users = await User.find({ _id: { $in: userIds }, active: true });
    const emails = users
      .map(u => (u.toJSON() as { email?: string }).email)
      .filter((e): e is string => Boolean(e));
    return [...new Set(emails)];
  }

  async countRecipients(audience: IMessageAudience): Promise<number> {
    if (audience.type === 'role') {
      return User.countDocuments({ role: { $in: audience.roles ?? [] } });
    }
    const ids = await this.resolveMemberIds(audience);
    return ids.length;
  }
}

export const audienceService = new AudienceService();

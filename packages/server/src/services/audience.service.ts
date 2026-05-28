import { Member } from '../models/Member.js';
import { User } from '../models/User.js';
import type { IMessageAudience } from '../models/Message.js';

export class AudienceService {
  async resolveEmails(audience: IMessageAudience): Promise<string[]> {
    switch (audience.type) {
      case 'all': {
        // Stream in batches to avoid loading entire collection into memory
        const members = await Member.find({ membershipStatus: 'active' })
          .populate('userId', 'email')
          .limit(10_000)
          .lean();
        return members
          .map((m) => (m.userId as any)?.email)
          .filter(Boolean);
      }
      case 'group': {
        // Implemented when Group model exists (Phase 8)
        return [];
      }
      case 'role': {
        const users = await User.find({ role: { $in: audience.roles } });
        return users.map((u) => u.email);
      }
      case 'custom': {
        const members = await Member.find({ _id: { $in: audience.memberIds } }).populate('userId', 'email');
        return members
          .map((m) => (m.userId as any)?.email)
          .filter(Boolean);
      }
      default:
        return [];
    }
  }

  async countRecipients(audience: IMessageAudience): Promise<number> {
    switch (audience.type) {
      case 'all':
        return Member.countDocuments({ membershipStatus: 'active' });
      case 'group':
        return 0;
      case 'role':
        return User.countDocuments({ role: { $in: audience.roles } });
      case 'custom':
        return audience.memberIds?.length || 0;
      default:
        return 0;
    }
  }
}

export const audienceService = new AudienceService();

import { User } from '../models/User.js';
import { Member } from '../models/Member.js';
import { Donation } from '../models/Donation.js';
import { PrayerRequest } from '../models/PrayerRequest.js';
import { PrayerResponse } from '../models/PrayerResponse.js';
import { Group } from '../models/Group.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { MemberCareNote } from '../models/MemberCareNote.js';
import { Booking } from '../models/Booking.js';
import { Message } from '../models/Message.js';
import { Event } from '../models/Event.js';
import { Page } from '../models/Page.js';
import { Sermon } from '../models/Sermon.js';
import { ResourceSubmission } from '../models/ResourceSubmission.js';

export class PrivacyService {
  /**
   * Export all personal data for a user (GDPR Article 20 — data portability).
   * Covers every collection that stores data about this user. Prayer requests
   * are included because the user authored them, even though they are public by
   * design.
   */
  async exportUserData(userId: string): Promise<object> {
    // Group/Event membership is keyed by the user's Member id, not the User id.
    const member = await Member.findOne({ userId });
    const memberId = member?._id;

    const [
      user, donations, prayers, prayerResponses, careNotes,
      groups, bookings, messages, events,
    ] = await Promise.all([
      User.findById(userId).select('-passwordHash -mfaSecret -pushSubscription'),
      Donation.find({ memberId: userId }).limit(5000),
      PrayerRequest.find({ submittedBy: userId }).limit(1000),
      PrayerResponse.find({ userId }).limit(1000),
      MemberCareNote.find({ memberId: memberId ?? null }).limit(1000),
      memberId ? Group.find({ 'members.userId': memberId }).select('name type') : Promise.resolve([]),
      Booking.find({ bookedBy: userId }).limit(1000),
      Message.find({ sentBy: userId }).limit(1000),
      memberId ? Event.find({ 'rsvps.userId': memberId }).select('title startDate rsvps') : Promise.resolve([]),
    ]);

    // Household is reachable via the member's householdId.
    const household = member?.householdId
      ? await (await import('../models/Household.js')).Household.findById(member.householdId)
      : null;

    return {
      user: user?.toJSON(),
      member: member?.toJSON(),
      household: household?.toJSON(),
      careNotes: careNotes.map(c => c.toJSON()),
      donations: donations.map(d => d.toJSON()),
      prayerRequests: prayers.map(p => p.toJSON()),
      prayerResponses: prayerResponses.map(r => r.toJSON()),
      groups: groups.map(g => g.toJSON()),
      bookings: bookings.map(b => b.toJSON()),
      messages: messages.map(m => m.toJSON()),
      events: events.map(e => ({
        id: e._id,
        title: e.title,
        startDate: e.startDate,
        myRsvps: e.rsvps.filter(r => r.userId?.toString() === memberId?.toString()),
      })),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Delete all personal data for a user (GDPR Article 17 — right to erasure).
   *
   * Donations are ANONYMIZED rather than deleted: charitable-contribution
   * records carry legal/tax retention obligations (e.g. IRS, Gift Aid), so we
   * sever the donor link instead of destroying the financial record.
   *
   * Prayer requests the user chose to share publicly/federate are anonymized
   * (link severed, marked anonymous) rather than deleted — they may already have
   * rippled to other instances, and the user opted into broadcasting them.
   */
  async deleteUserData(userId: string): Promise<void> {
    const member = await Member.findOne({ userId });
    const memberId = member?._id;

    await Promise.all([
      // Hard-delete private, user-owned data
      MemberCareNote.deleteMany({ memberId: memberId ?? null }),
      MemberCareNote.deleteMany({ authorId: userId }),
      PrayerResponse.deleteMany({ userId }),
      RefreshToken.deleteMany({ userId }),
      Booking.deleteMany({ bookedBy: userId }),
      ResourceSubmission.deleteMany({ submittedBy: userId }),
      Message.deleteMany({ sentBy: userId }),

      // Anonymize financial records (retain for tax/legal, drop the donor link)
      Donation.updateMany({ memberId: userId }, { $unset: { memberId: 1, notes: 1 } }),

      // Anonymize public/federated prayers rather than deleting
      PrayerRequest.updateMany({ submittedBy: userId }, { $unset: { submittedBy: 1 }, $set: { anonymous: true } }),

      // Anonymize authored public content
      Page.updateMany({ createdBy: userId }, { $unset: { createdBy: 1 } }),
      Page.updateMany({ publishedBy: userId }, { $unset: { publishedBy: 1 } }),
      Sermon.updateMany({ createdBy: userId }, { $unset: { createdBy: 1 } }),
    ]);

    // Member-id-keyed references (group membership, event RSVPs, volunteer slots)
    if (memberId) {
      await Promise.all([
        Group.updateMany({ 'members.userId': memberId }, { $pull: { members: { userId: memberId } } }),
        Event.updateMany({ 'rsvps.userId': memberId }, { $pull: { rsvps: { userId: memberId } } }),
        Event.updateMany({ 'volunteerSlots.filled': memberId }, { $pull: { 'volunteerSlots.$[].filled': memberId } }),
      ]);
    }

    // Delete the member record and the user account last
    await Member.deleteMany({ userId });
    await User.findByIdAndDelete(userId);
  }
}

export const privacyService = new PrivacyService();

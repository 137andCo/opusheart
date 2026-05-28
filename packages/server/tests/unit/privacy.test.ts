import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import { privacyService } from '../../src/services/privacy.service.js';
import { User } from '../../src/models/User.js';
import { Member } from '../../src/models/Member.js';
import { MemberCareNote } from '../../src/models/MemberCareNote.js';
import { Donation } from '../../src/models/Donation.js';
import { Fund } from '../../src/models/Fund.js';
import { Message } from '../../src/models/Message.js';
import { Group } from '../../src/models/Group.js';
import { PrayerRequest } from '../../src/models/PrayerRequest.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('PrivacyService (GDPR export & erasure)', () => {
  beforeAll(async () => {
    await connectTestDb('privacy');
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await cleanTestDb();
  });

  async function seedUser() {
    const user = await User.create({
      email: 'jane@church.org', emailHash: 'jh', passwordHash: 'h',
      firstName: 'Jane', lastName: 'Doe', role: 'member',
    });
    const member = await Member.create({ userId: user._id });
    return { user, member };
  }

  describe('export', () => {
    it('includes care notes and messages (regression: was querying wrong field)', async () => {
      const { user, member } = await seedUser();
      await MemberCareNote.create({ memberId: member._id, authorId: user._id, type: 'visit', content: 'home visit' });
      await Message.create({
        subject: 'Hi', body: 'body', channel: 'announcement',
        audience: { type: 'all' }, sentBy: user._id, status: 'sent',
      });

      const data = await privacyService.exportUserData(user._id.toString()) as any;

      expect(data.careNotes).toHaveLength(1);
      expect(data.messages).toHaveLength(1); // would be 0 with the old createdBy bug
      expect(data.user.email).toBe('jane@church.org'); // decrypted in export
    });
  });

  describe('erasure', () => {
    it('deletes the user, member, and care notes', async () => {
      const { user, member } = await seedUser();
      await MemberCareNote.create({ memberId: member._id, authorId: user._id, type: 'visit', content: 'x' });

      await privacyService.deleteUserData(user._id.toString());

      expect(await User.findById(user._id)).toBeNull();
      expect(await Member.findOne({ userId: user._id })).toBeNull();
      expect(await MemberCareNote.countDocuments({ memberId: member._id })).toBe(0);
    });

    it('anonymizes donations instead of deleting them (tax retention)', async () => {
      const { user } = await seedUser();
      const fund = await Fund.create({ name: 'General', active: true });
      await Donation.create({ memberId: user._id, amount: 100, fund: fund._id, method: 'online', status: 'completed', date: new Date() });

      await privacyService.deleteUserData(user._id.toString());

      const donations = await Donation.find();
      expect(donations).toHaveLength(1);          // record retained
      expect(donations[0]?.memberId).toBeUndefined(); // donor link severed
      expect(donations[0]?.amount).toBe(100);     // financial data intact
    });

    it('anonymizes public prayer requests rather than deleting them', async () => {
      const { user } = await seedUser();
      await PrayerRequest.create({ content: 'pray for me', category: 'health', submittedBy: user._id, visibility: 'mesh' });

      await privacyService.deleteUserData(user._id.toString());

      const prayers = await PrayerRequest.find();
      expect(prayers).toHaveLength(1);            // public/federated prayer stays
      expect(prayers[0]?.submittedBy).toBeUndefined();
      expect(prayers[0]?.anonymous).toBe(true);
    });

    it('removes the user from group membership (member-id keyed)', async () => {
      const { user, member } = await seedUser();
      await Group.create({
        name: 'Bible Study', description: 'Weekly study', type: 'bible_study', createdBy: user._id,
        members: [{ userId: member._id, role: 'member', joinedAt: new Date() }],
      });

      await privacyService.deleteUserData(user._id.toString());

      const group = await Group.findOne({ name: 'Bible Study' });
      expect(group?.members ?? []).toHaveLength(0);
    });
  });
});

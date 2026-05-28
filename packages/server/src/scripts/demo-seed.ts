import 'dotenv/config';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { sha256 } from '@opusheart/shared';
import { loadConfig } from '../config/index.js';
import { User } from '../models/User.js';
import { Member } from '../models/Member.js';
import { Event } from '../models/Event.js';
import { Sermon } from '../models/Sermon.js';
import { SermonSeries } from '../models/SermonSeries.js';
import { Group } from '../models/Group.js';
import { FeatureConfig } from '../models/FeatureConfig.js';
import { InstanceSettings } from '../models/InstanceSettings.js';
import { PageTemplate } from '../models/PageTemplate.js';
import { Theme } from '../models/Theme.js';
import { Resource } from '../models/Resource.js';
import { BookableResource } from '../models/BookableResource.js';
import { PrayerRequest } from '../models/PrayerRequest.js';
import { Fund } from '../models/Fund.js';
import { Booking } from '../models/Booking.js';
import { Donation } from '../models/Donation.js';
import { Household } from '../models/Household.js';
import { MemberCareNote } from '../models/MemberCareNote.js';
import { Message } from '../models/Message.js';
import { Page } from '../models/Page.js';
import { ResourceSubmission } from '../models/ResourceSubmission.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AuditLog } from '../models/AuditLog.js';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function nextDay(dayOfWeek: number, hour: number, minute: number): Date {
  const now = new Date();
  const current = now.getDay();
  let daysAhead = dayOfWeek - current;
  if (daysAhead <= 0) daysAhead += 7;
  const d = new Date(now);
  d.setDate(now.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(days: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function weeksAgo(weeks: number, dayOfWeek: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  const current = d.getDay();
  let diff = dayOfWeek - current;
  if (diff > 3) diff -= 7;
  if (diff < -3) diff += 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Member data
// ---------------------------------------------------------------------------

const memberNames: Array<{ firstName: string; lastName: string }> = [
  { firstName: 'Marcus', lastName: 'Williams' },
  { firstName: 'Rachel', lastName: 'Nguyen' },
  { firstName: 'James', lastName: 'Patterson' },
  { firstName: 'Priya', lastName: 'Sharma' },
  { firstName: 'Michael', lastName: 'Rodriguez' },
  { firstName: 'Aisha', lastName: 'Johnson' },
  { firstName: 'Thomas', lastName: 'Kim' },
  { firstName: 'Elena', lastName: 'Vasquez' },
  { firstName: 'Robert', lastName: 'Thompson' },
  { firstName: 'Grace', lastName: 'Okafor' },
  { firstName: 'Daniel', lastName: 'Lee' },
  { firstName: 'Catherine', lastName: 'Brooks' },
  { firstName: 'Samuel', lastName: 'Adeyemi' },
  { firstName: 'Jennifer', lastName: 'Martinez' },
  { firstName: 'Andrew', lastName: 'Nakamura' },
  { firstName: 'Olivia', lastName: 'Foster' },
  { firstName: 'Christopher', lastName: 'Wright' },
  { firstName: 'Hannah', lastName: 'Petrov' },
  { firstName: 'Nathan', lastName: 'Garcia' },
  { firstName: 'Megan', lastName: 'Sullivan' },
  { firstName: 'Isaiah', lastName: 'Washington' },
  { firstName: 'Emily', lastName: 'Johansson' },
  { firstName: 'Kevin', lastName: 'Patel' },
  { firstName: 'Sophia', lastName: 'Morales' },
  { firstName: 'Brian', lastName: 'Tanaka' },
  { firstName: 'Rebecca', lastName: 'Anderson' },
  { firstName: 'Derek', lastName: 'Campbell' },
  { firstName: 'Lillian', lastName: 'Park' },
  { firstName: 'Victor', lastName: 'Barnes' },
  { firstName: 'Amara', lastName: 'Diallo' },
];

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const config = loadConfig();
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB');

  // Clear ALL data — this is a full demo reset
  console.log('\nClearing all existing data...');
  await Promise.all([
    User.deleteMany({}),
    Member.deleteMany({}),
    Event.deleteMany({}),
    Sermon.deleteMany({}),
    SermonSeries.deleteMany({}),
    Group.deleteMany({}),
    FeatureConfig.deleteMany({}),
    InstanceSettings.deleteMany({}),
    PageTemplate.deleteMany({}),
    Theme.deleteMany({}),
    Resource.deleteMany({}),
    BookableResource.deleteMany({}),
    PrayerRequest.deleteMany({}),
    Fund.deleteMany({}),
    Booking.deleteMany({}),
    Donation.deleteMany({}),
    Household.deleteMany({}),
    MemberCareNote.deleteMany({}),
    Message.deleteMany({}),
    Page.deleteMany({}),
    ResourceSubmission.deleteMany({}),
    RefreshToken.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('All collections cleared.');

  // ------------------------------------------------------------------
  // Shared password hash (one hash, reused for all 32 users)
  // ------------------------------------------------------------------
  const passwordHash = await argon2.hash('ChangeMe123!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // ------------------------------------------------------------------
  // 1. Users (32 total)
  // ------------------------------------------------------------------
  console.log('\nCreating users...');

  const adminEmail = 'admin@gracecommunity.church';
  const pastorEmail = 'pastor@gracecommunity.church';

  const adminUser = await User.create({
    email: adminEmail,
    emailHash: sha256(adminEmail),
    passwordHash,
    firstName: 'Sarah',
    lastName: 'Mitchell',
    role: 'admin',
    active: true,
  });

  const pastorUser = await User.create({
    email: pastorEmail,
    emailHash: sha256(pastorEmail),
    passwordHash,
    firstName: 'David',
    lastName: 'Chen',
    role: 'pastor',
    active: true,
  });

  const memberUsers = [];
  for (const m of memberNames) {
    const email = `${m.firstName.toLowerCase()}.${m.lastName.toLowerCase()}@example.com`;
    const user = await User.create({
      email,
      emailHash: sha256(email),
      passwordHash,
      firstName: m.firstName,
      lastName: m.lastName,
      role: 'member',
      active: true,
    });
    memberUsers.push(user);
  }

  const allUsers = [adminUser, pastorUser, ...memberUsers];
  console.log(`  Created ${allUsers.length} users (1 admin, 1 pastor, ${memberUsers.length} members)`);

  // ------------------------------------------------------------------
  // 2. Member records (32)
  // ------------------------------------------------------------------
  console.log('\nCreating member records...');

  const memberRecords = [];
  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i]!;
    // 80% active, 20% visitor
    const isActive = i < Math.floor(allUsers.length * 0.8);
    // 70% attendance opt-in
    const optIn = Math.random() < 0.7;
    // Stagger join dates over the past 2 years
    const joinedAt = new Date();
    joinedAt.setDate(joinedAt.getDate() - Math.floor(Math.random() * 730));

    const record = await Member.create({
      userId: user._id,
      joinedAt,
      membershipStatus: isActive ? 'active' : 'visitor',
      attendanceOptIn: optIn,
    });
    memberRecords.push(record);
  }
  console.log(`  Created ${memberRecords.length} member records`);

  // ------------------------------------------------------------------
  // 3. Events (12)
  // ------------------------------------------------------------------
  console.log('\nCreating events...');

  const events = [
    {
      title: 'Sunday Morning Worship',
      description: 'Join us for a time of praise, prayer, and teaching from God\'s Word. Nursery and children\'s ministry available for ages 0 through fifth grade.',
      startDate: nextDay(0, 10, 0),
      endDate: nextDay(0, 12, 0),
      location: 'Main Sanctuary',
      visibility: 'public' as const,
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'weekly' as const, interval: 1, dayOfWeek: [0], exceptions: [] },
      volunteerSlots: [
        { role: 'Greeter', needed: 4, filled: [] },
        { role: 'Sound Tech', needed: 2, filled: [] },
        { role: 'Nursery Volunteer', needed: 3, filled: [] },
      ],
      createdBy: pastorUser._id,
    },
    {
      title: 'Wednesday Evening Bible Study',
      description: 'Midweek study through the book of Romans. All are welcome, whether you\'ve been studying the Bible for decades or are picking it up for the first time.',
      startDate: nextDay(3, 19, 0),
      endDate: nextDay(3, 20, 30),
      location: 'Fellowship Hall',
      visibility: 'public' as const,
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'weekly' as const, interval: 1, dayOfWeek: [3], exceptions: [] },
      createdBy: pastorUser._id,
    },
    {
      title: 'Youth Group: Friday Night Live',
      description: 'Games, worship, and a short message designed for students in grades 6 through 12. Snacks provided. Invite your friends!',
      startDate: nextDay(5, 19, 0),
      endDate: nextDay(5, 21, 0),
      location: 'Youth Center',
      visibility: 'public' as const,
      maxAttendees: 60,
      registrationRequired: true,
      allDay: false,
      recurring: { frequency: 'weekly' as const, interval: 1, dayOfWeek: [5], exceptions: [] },
      volunteerSlots: [
        { role: 'Youth Leader', needed: 3, filled: [] },
        { role: 'Snack Coordinator', needed: 1, filled: [] },
      ],
      createdBy: adminUser._id,
    },
    {
      title: 'Community Food Drive',
      description: 'Help us stock the shelves at Springfield Community Pantry. Drop off non-perishable items at the church lobby or volunteer to help sort and deliver donations to families in need.',
      startDate: addDays(10, 9, 0),
      endDate: addDays(10, 14, 0),
      location: 'Church Parking Lot & Fellowship Hall',
      visibility: 'public' as const,
      registrationRequired: false,
      allDay: false,
      volunteerSlots: [
        { role: 'Sorting Volunteer', needed: 8, filled: [] },
        { role: 'Delivery Driver', needed: 4, filled: [] },
        { role: 'Registration Table', needed: 2, filled: [] },
      ],
      createdBy: adminUser._id,
    },
    {
      title: 'Financial Peace Workshop',
      description: 'A three-session workshop on biblical stewardship, budgeting, and getting out of debt. Materials provided free of charge. Open to the community.',
      startDate: addDays(14, 18, 30),
      endDate: addDays(14, 20, 30),
      location: 'Room 204',
      visibility: 'public' as const,
      maxAttendees: 30,
      registrationRequired: true,
      allDay: false,
      createdBy: adminUser._id,
    },
    {
      title: 'Elder Board Meeting',
      description: 'Monthly meeting of the elder board to review ministry progress, approve the quarterly budget, and discuss upcoming initiatives.',
      startDate: addDays(7, 18, 0),
      endDate: addDays(7, 20, 0),
      location: 'Conference Room',
      visibility: 'leaders' as const,
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'monthly' as const, interval: 1, exceptions: [] },
      createdBy: adminUser._id,
    },
    {
      title: 'Worship Team Rehearsal',
      description: 'Weekly rehearsal for vocalists and instrumentalists serving on the Sunday morning worship team. Please review the set list sent via email before arriving.',
      startDate: nextDay(4, 19, 0),
      endDate: nextDay(4, 21, 0),
      location: 'Main Sanctuary',
      visibility: 'members' as const,
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'weekly' as const, interval: 1, dayOfWeek: [4], exceptions: [] },
      createdBy: pastorUser._id,
    },
    {
      title: "Men's Breakfast",
      description: 'Pancakes, sausage, and fellowship. We will continue our conversation through the book of Proverbs. All men are welcome, bring a friend.',
      startDate: addDays(12, 7, 30),
      endDate: addDays(12, 9, 0),
      location: 'Fellowship Hall',
      visibility: 'public' as const,
      maxAttendees: 40,
      registrationRequired: true,
      allDay: false,
      createdBy: pastorUser._id,
    },
    {
      title: "Women's Prayer Circle",
      description: 'A space for women to gather in prayer, share burdens, and encourage one another. Childcare available upon request.',
      startDate: nextDay(2, 10, 0),
      endDate: nextDay(2, 11, 30),
      location: 'Prayer Chapel',
      visibility: 'members' as const,
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'weekly' as const, interval: 1, dayOfWeek: [2], exceptions: [] },
      createdBy: adminUser._id,
    },
    {
      title: 'New Member Welcome Lunch',
      description: 'If you are new to Grace Community Church, we would love to get to know you over a meal. Learn about our ministries, meet the staff, and find out how to get connected.',
      startDate: addDays(17, 12, 15),
      endDate: addDays(17, 14, 0),
      location: 'Fellowship Hall',
      visibility: 'public' as const,
      maxAttendees: 25,
      registrationRequired: true,
      allDay: false,
      createdBy: adminUser._id,
    },
    {
      title: 'Baptism Sunday',
      description: 'Celebrate with those who are publicly declaring their faith through baptism. If you are interested in being baptized, please contact the church office by Wednesday.',
      startDate: addDays(21, 10, 0),
      endDate: addDays(21, 12, 30),
      location: 'Main Sanctuary',
      visibility: 'public' as const,
      registrationRequired: false,
      allDay: false,
      createdBy: pastorUser._id,
    },
    {
      title: 'Grief Support Group',
      description: 'A safe, confidential space for those walking through loss. Facilitated by licensed counselor Dr. Linda Harris. No registration needed, just come as you are.',
      startDate: nextDay(1, 19, 0),
      endDate: nextDay(1, 20, 30),
      location: 'Room 108',
      visibility: 'members' as const,
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'weekly' as const, interval: 1, dayOfWeek: [1], exceptions: [] },
      createdBy: adminUser._id,
    },
  ];

  for (const eventData of events) {
    await Event.create(eventData);
  }
  console.log(`  Created ${events.length} events`);

  // ------------------------------------------------------------------
  // 4. Sermon Series (3)
  // ------------------------------------------------------------------
  console.log('\nCreating sermon series...');

  const parablesSeries = await SermonSeries.create({
    title: 'The Parables of Jesus',
    description: 'Jesus was the master storyteller. In this five-week series we unpack the parables He used to reveal the nature of God\'s kingdom and challenge the way we live.',
    startDate: weeksAgo(10, 0, 10, 0),
    endDate: weeksAgo(6, 0, 10, 0),
    createdBy: pastorUser._id,
  });

  const rootedSeries = await SermonSeries.create({
    title: 'Rooted: Growing Deep in Faith',
    description: 'What does it look like to build a faith that lasts? Over six weeks we explore the spiritual disciplines that anchor us when the winds of life pick up.',
    startDate: weeksAgo(7, 0, 10, 0),
    endDate: weeksAgo(2, 0, 10, 0),
    createdBy: pastorUser._id,
  });

  const hopeSeries = await SermonSeries.create({
    title: 'Unshakeable Hope',
    description: 'When the world feels uncertain, where do we place our confidence? This ongoing series walks through the promises of God that hold firm no matter what.',
    startDate: weeksAgo(1, 0, 10, 0),
    createdBy: pastorUser._id,
  });

  console.log('  Created 3 sermon series');

  // ------------------------------------------------------------------
  // 5. Sermons (15)
  // ------------------------------------------------------------------
  console.log('\nCreating sermons...');

  const sermonData: Array<{
    title: string;
    speaker: string;
    date: Date;
    series?: mongoose.Types.ObjectId;
    seriesOrder?: number;
    description: string;
    scriptureReferences: string[];
    tags: string[];
    published: boolean;
  }> = [
    // --- Parables of Jesus (5, completed) ---
    {
      title: 'The Sower and the Soil',
      speaker: 'David Chen',
      date: weeksAgo(10, 0, 10, 0),
      series: parablesSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 1,
      description: 'Jesus tells a story about a farmer scattering seed on four types of ground. The parable is really about the condition of our hearts and how we receive God\'s Word.',
      scriptureReferences: ['Matthew 13:1-23', 'Mark 4:1-20'],
      tags: ['parables', 'heart', 'spiritual growth'],
      published: true,
    },
    {
      title: 'The Prodigal Son',
      speaker: 'David Chen',
      date: weeksAgo(9, 0, 10, 0),
      series: parablesSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 2,
      description: 'A father\'s relentless love for a son who wanted nothing to do with him. This story reveals more about the heart of God than almost any other passage in Scripture.',
      scriptureReferences: ['Luke 15:11-32'],
      tags: ['parables', 'grace', 'forgiveness', 'love'],
      published: true,
    },
    {
      title: 'The Good Samaritan',
      speaker: 'Rev. Angela Morris',
      date: weeksAgo(8, 0, 10, 0),
      series: parablesSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 3,
      description: 'Who is my neighbor? Jesus answers with a story that shattered the social boundaries of His day and still challenges ours. True compassion crosses every divide.',
      scriptureReferences: ['Luke 10:25-37'],
      tags: ['parables', 'compassion', 'service', 'love'],
      published: true,
    },
    {
      title: 'The Mustard Seed',
      speaker: 'David Chen',
      date: weeksAgo(7, 0, 10, 0),
      series: parablesSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 4,
      description: 'The kingdom of God starts impossibly small and grows beyond anything we could predict. What does that mean for our faith and for the church?',
      scriptureReferences: ['Matthew 13:31-32', 'Mark 4:30-32'],
      tags: ['parables', 'faith', 'kingdom'],
      published: true,
    },
    {
      title: 'The Unmerciful Servant',
      speaker: 'David Chen',
      date: weeksAgo(6, 0, 10, 0),
      series: parablesSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 5,
      description: 'Forgiven people forgive people. Jesus tells a jarring story about a man who received an ocean of mercy but refused to offer a drop. The implications hit close to home.',
      scriptureReferences: ['Matthew 18:21-35'],
      tags: ['parables', 'forgiveness', 'mercy', 'grace'],
      published: true,
    },
    // --- Rooted: Growing Deep in Faith (6, completed) ---
    {
      title: 'The Discipline of Prayer',
      speaker: 'David Chen',
      date: weeksAgo(7, 0, 10, 0),
      series: rootedSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 1,
      description: 'Prayer is not just talking at God; it is learning to be present with Him. We look at how Jesus modeled prayer and what it means to develop a sustainable prayer life.',
      scriptureReferences: ['Matthew 6:5-13', 'Luke 11:1-4'],
      tags: ['spiritual disciplines', 'prayer', 'intimacy with God'],
      published: true,
    },
    {
      title: 'Feasting on the Word',
      speaker: 'David Chen',
      date: weeksAgo(6, 0, 10, 0),
      series: rootedSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 2,
      description: 'The Bible is not just a book of rules. It is a living conversation with the God who made us. Practical strategies for reading Scripture in a way that transforms.',
      scriptureReferences: ['Psalm 119:105', 'Hebrews 4:12', '2 Timothy 3:16-17'],
      tags: ['spiritual disciplines', 'Bible', 'Scripture'],
      published: true,
    },
    {
      title: 'The Rhythm of Rest',
      speaker: 'Dr. Marcus Thompson',
      date: weeksAgo(5, 0, 10, 0),
      series: rootedSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 3,
      description: 'Sabbath is not laziness; it is an act of trust. In a culture that celebrates hustle, God invites us to stop and remember that He is the one holding everything together.',
      scriptureReferences: ['Genesis 2:2-3', 'Exodus 20:8-11', 'Mark 2:27'],
      tags: ['spiritual disciplines', 'rest', 'sabbath'],
      published: true,
    },
    {
      title: 'Generous Living',
      speaker: 'David Chen',
      date: weeksAgo(4, 0, 10, 0),
      series: rootedSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 4,
      description: 'Generosity is not about the size of your bank account. It is about the posture of your heart. When we give freely, we reflect the character of a God who gave everything.',
      scriptureReferences: ['2 Corinthians 9:6-8', 'Proverbs 11:25', 'Acts 20:35'],
      tags: ['spiritual disciplines', 'generosity', 'stewardship'],
      published: true,
    },
    {
      title: 'Life in Community',
      speaker: 'David Chen',
      date: weeksAgo(3, 0, 10, 0),
      series: rootedSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 5,
      description: 'Faith was never meant to be a solo project. We explore what the early church looked like and why authentic community is essential for spiritual growth.',
      scriptureReferences: ['Acts 2:42-47', 'Hebrews 10:24-25', 'Ecclesiastes 4:9-12'],
      tags: ['spiritual disciplines', 'community', 'church'],
      published: true,
    },
    {
      title: 'Rooted and Reaching',
      speaker: 'David Chen',
      date: weeksAgo(2, 0, 10, 0),
      series: rootedSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 6,
      description: 'A tree with deep roots does not just survive storms; it bears fruit. As we wrap up this series, we ask: what does it look like to be deeply rooted and actively reaching out?',
      scriptureReferences: ['Colossians 2:6-7', 'Jeremiah 17:7-8', 'John 15:5'],
      tags: ['spiritual disciplines', 'mission', 'fruit'],
      published: true,
    },
    // --- Unshakeable Hope (2: 1 published, 1 draft) ---
    {
      title: 'Hope That Holds',
      speaker: 'David Chen',
      date: weeksAgo(1, 0, 10, 0),
      series: hopeSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 1,
      description: 'Biblical hope is not wishful thinking. It is a confident expectation grounded in the character of God. We begin this new series by looking at what makes Christian hope different.',
      scriptureReferences: ['Romans 5:1-5', 'Hebrews 6:19', '1 Peter 1:3'],
      tags: ['hope', 'faith', 'promises of God'],
      published: true,
    },
    {
      title: 'When the Ground Shakes',
      speaker: 'David Chen',
      date: addDays(0, 10, 0),
      series: hopeSeries._id as mongoose.Types.ObjectId,
      seriesOrder: 2,
      description: 'Suffering has a way of exposing what we have built our lives on. This message explores how God meets us in the rubble and rebuilds us from the inside out.',
      scriptureReferences: ['Psalm 46:1-3', 'Matthew 7:24-27', 'Romans 8:28'],
      tags: ['hope', 'suffering', 'trust'],
      published: false,
    },
    // --- Standalone published ---
    {
      title: 'A Heart of Gratitude',
      speaker: 'Rev. Angela Morris',
      date: weeksAgo(12, 0, 10, 0),
      description: 'Gratitude is more than politeness. It rewires our perspective and opens our eyes to the faithfulness of God. A Thanksgiving message on choosing thankfulness in every season.',
      scriptureReferences: ['1 Thessalonians 5:16-18', 'Psalm 107:1', 'Colossians 3:15-17'],
      tags: ['gratitude', 'thanksgiving', 'worship'],
      published: true,
    },
    // --- Standalone draft ---
    {
      title: 'Sent: Living on Mission Every Day',
      speaker: 'David Chen',
      date: addDays(7, 10, 0),
      description: 'You do not have to board a plane to live on mission. Jesus sends us into our neighborhoods, offices, and schools as ambassadors of His kingdom. What does that look like on a Tuesday afternoon?',
      scriptureReferences: ['John 20:21', 'Matthew 28:18-20', 'Acts 1:8'],
      tags: ['mission', 'evangelism', 'discipleship'],
      published: false,
    },
  ];

  for (const s of sermonData) {
    await Sermon.create({
      ...s,
      podcastInclude: s.published,
      createdBy: pastorUser._id,
    });
  }
  console.log(`  Created ${sermonData.length} sermons across 3 series + 2 standalone`);

  // ------------------------------------------------------------------
  // 6. Groups (6)
  // ------------------------------------------------------------------
  console.log('\nCreating groups...');

  // Distribute member user IDs for group membership
  const mIds = memberUsers.map((u) => u._id);

  const groupsData = [
    {
      name: 'Thursday Night Small Group',
      description: 'A home-based gathering for adults in their 20s and 30s. We share a meal, study Scripture together, and pray for one another. Currently working through the Gospel of John.',
      type: 'small_group' as const,
      visibility: 'public' as const,
      meetingSchedule: 'Thursdays at 7:00 PM',
      location: '1842 Elm Street (the Chen home)',
      members: [
        { userId: pastorUser._id, role: 'leader' as const, joinedAt: new Date() },
        ...mIds.slice(0, 10).map((id) => ({ userId: id, role: 'member' as const, joinedAt: new Date() })),
      ],
      createdBy: pastorUser._id,
      active: true,
    },
    {
      name: "Women's Bible Study: Steadfast",
      description: 'An in-depth, verse-by-verse study of the Psalms. Open to women of all ages. Workbooks are provided, and childcare is available during the session.',
      type: 'bible_study' as const,
      visibility: 'public' as const,
      meetingSchedule: 'Tuesdays at 10:00 AM',
      location: 'Library',
      members: [
        { userId: pastorUser._id, role: 'leader' as const, joinedAt: new Date() },
        ...mIds.slice(1, 13).filter((_, i) => i % 2 === 0).map((id) => ({ userId: id, role: 'member' as const, joinedAt: new Date() })),
      ],
      createdBy: pastorUser._id,
      active: true,
    },
    {
      name: 'Outreach and Missions Ministry',
      description: 'Coordinates local service projects, international mission partnerships, and community outreach events. We are the hands and feet of Jesus in Springfield and beyond.',
      type: 'ministry' as const,
      visibility: 'public' as const,
      meetingSchedule: 'Second Saturday of each month at 9:00 AM',
      location: 'Fellowship Hall',
      members: [
        { userId: pastorUser._id, role: 'leader' as const, joinedAt: new Date() },
        ...mIds.slice(5, 21).map((id) => ({ userId: id, role: 'member' as const, joinedAt: new Date() })),
      ],
      createdBy: adminUser._id,
      active: true,
    },
    {
      name: 'Finance Committee',
      description: 'Oversees the annual budget, reviews monthly financial reports, and ensures faithful stewardship of the resources entrusted to Grace Community Church.',
      type: 'committee' as const,
      visibility: 'members' as const,
      meetingSchedule: 'First Monday of each month at 6:30 PM',
      location: 'Conference Room',
      members: [
        { userId: adminUser._id, role: 'leader' as const, joinedAt: new Date() },
        ...mIds.slice(2, 8).map((id) => ({ userId: id, role: 'member' as const, joinedAt: new Date() })),
      ],
      createdBy: adminUser._id,
      active: true,
    },
    {
      name: 'Worship Team',
      description: 'Vocalists and musicians who lead the congregation in worship each Sunday. Rehearsals are Thursday evenings. New members audition quarterly.',
      type: 'team' as const,
      visibility: 'members' as const,
      meetingSchedule: 'Thursdays at 7:00 PM (rehearsal), Sundays at 8:30 AM (sound check)',
      location: 'Main Sanctuary',
      members: [
        { userId: pastorUser._id, role: 'leader' as const, joinedAt: new Date() },
        ...mIds.slice(10, 20).map((id) => ({ userId: id, role: 'member' as const, joinedAt: new Date() })),
      ],
      createdBy: pastorUser._id,
      active: true,
    },
    {
      name: 'New Believers Class',
      description: 'An eight-week course covering the foundations of the Christian faith: who God is, what the Bible says, how to pray, and what it means to follow Jesus every day.',
      type: 'class' as const,
      visibility: 'public' as const,
      meetingSchedule: 'Sundays at 9:00 AM',
      location: 'Room 201',
      maxMembers: 20,
      members: [
        { userId: pastorUser._id, role: 'leader' as const, joinedAt: new Date() },
        ...mIds.slice(20, 28).map((id) => ({ userId: id, role: 'member' as const, joinedAt: new Date() })),
      ],
      createdBy: pastorUser._id,
      active: true,
    },
  ];

  const createdGroups = [];
  for (const g of groupsData) {
    const created = await Group.create(g);
    createdGroups.push(created);
  }
  console.log(`  Created ${createdGroups.length} groups`);

  // ------------------------------------------------------------------
  // 7. Messages (4)
  // ------------------------------------------------------------------
  console.log('\nCreating messages...');

  const messagesData = [
    {
      subject: 'Easter Service Schedule and Volunteer Sign-Up',
      body: '<p>Dear Grace Community family,</p><p>We are excited to share our Easter service schedule with you. This year we will hold three services: sunrise at 6:30 AM, traditional at 9:00 AM, and contemporary at 11:00 AM.</p><p>We still need volunteers for greeting, nursery, and parking. Please reply to this email or sign up at the welcome desk this Sunday.</p><p>He is risen!</p><p>Pastor David Chen</p>',
      bodyPlain: 'Dear Grace Community family, We are excited to share our Easter service schedule with you. This year we will hold three services: sunrise at 6:30 AM, traditional at 9:00 AM, and contemporary at 11:00 AM. We still need volunteers for greeting, nursery, and parking. Please reply to this email or sign up at the welcome desk this Sunday. He is risen! Pastor David Chen',
      channel: 'email' as const,
      audience: { type: 'all' as const },
      sentBy: pastorUser._id,
      status: 'sent' as const,
      sentAt: weeksAgo(1, 1, 9, 0),
      deliveryStats: { total: 32, delivered: 30, failed: 2, opened: 22 },
    },
    {
      subject: 'Reminder: Community Food Drive Next Saturday',
      body: '<p>Grace Community Church will be hosting a community food drive next Saturday from 9 AM to 2 PM. We need non-perishable food items and volunteers to help sort and distribute donations.</p><p>Drop-off location: Church parking lot and Fellowship Hall.</p>',
      bodyPlain: 'Grace Community Church will be hosting a community food drive next Saturday from 9 AM to 2 PM. We need non-perishable food items and volunteers to help sort and distribute donations. Drop-off location: Church parking lot and Fellowship Hall.',
      channel: 'announcement' as const,
      audience: { type: 'all' as const },
      sentBy: adminUser._id,
      status: 'scheduled' as const,
      scheduledFor: addDays(7, 8, 0),
    },
    {
      subject: 'New Sermon Series Starting This Sunday',
      body: 'Join us this Sunday as Pastor David begins the new series "Unshakeable Hope." Invite a friend and come expectant!',
      bodyPlain: 'Join us this Sunday as Pastor David begins the new series "Unshakeable Hope." Invite a friend and come expectant!',
      channel: 'push' as const,
      audience: { type: 'all' as const },
      sentBy: pastorUser._id,
      status: 'draft' as const,
    },
    {
      subject: 'Worship Team Rehearsal Update',
      body: '<p>Hey team,</p><p>Quick update on this week\'s rehearsal: we will be learning two new songs for the upcoming series. Please listen to the tracks shared in our group chat before Thursday.</p><p>Also, we have a new sound tech joining us — please welcome Brian Tanaka!</p>',
      bodyPlain: 'Hey team, Quick update on this week\'s rehearsal: we will be learning two new songs for the upcoming series. Please listen to the tracks shared in our group chat before Thursday. Also, we have a new sound tech joining us — please welcome Brian Tanaka!',
      channel: 'email' as const,
      audience: { type: 'group' as const, groupIds: [createdGroups[4]!._id] },
      sentBy: pastorUser._id,
      status: 'sent' as const,
      sentAt: weeksAgo(0, 1, 14, 0),
      deliveryStats: { total: 11, delivered: 11, failed: 0, opened: 8 },
    },
  ];

  for (const msg of messagesData) {
    await Message.create(msg);
  }
  console.log(`  Created ${messagesData.length} messages`);

  // ------------------------------------------------------------------
  // 8. Funds (3) + Donations (12)
  // ------------------------------------------------------------------
  console.log('\nCreating funds and donations...');

  const generalFund = await Fund.create({
    name: 'General Fund',
    description: 'Supports the day-to-day operations of Grace Community Church including staff salaries, utilities, ministry supplies, and facility maintenance.',
    goal: 50000,
    raised: 32750,
    active: true,
  });

  const buildingFund = await Fund.create({
    name: 'Building Fund',
    description: 'Capital campaign for the new family life center. Phase one includes a gymnasium, commercial kitchen, and multipurpose rooms for youth and children\'s ministry.',
    goal: 200000,
    raised: 87500,
    active: true,
  });

  const missionsFund = await Fund.create({
    name: 'Missions Fund',
    description: 'Supports our local and international mission partners including clean water projects in East Africa and our Springfield Community Pantry partnership.',
    goal: 15000,
    raised: 9200,
    active: true,
  });

  console.log('  Created 3 funds');

  const donationsData = [
    // General Fund donations
    { memberId: memberUsers[0]!._id, amount: 500, fund: generalFund._id, method: 'online' as const, recurring: true, recurringSchedule: 'monthly' as const, status: 'completed' as const, date: weeksAgo(1, 0, 10, 0) },
    { memberId: memberUsers[1]!._id, amount: 250, fund: generalFund._id, method: 'check' as const, recurring: false, status: 'completed' as const, date: weeksAgo(2, 0, 10, 0) },
    { memberId: memberUsers[2]!._id, amount: 100, fund: generalFund._id, method: 'cash' as const, recurring: false, status: 'completed' as const, date: weeksAgo(3, 0, 10, 0) },
    { memberId: memberUsers[5]!._id, amount: 1000, fund: generalFund._id, method: 'online' as const, recurring: true, recurringSchedule: 'monthly' as const, status: 'completed' as const, date: weeksAgo(1, 0, 10, 0) },
    // Building Fund donations
    { memberId: memberUsers[3]!._id, amount: 5000, fund: buildingFund._id, method: 'check' as const, recurring: false, status: 'completed' as const, date: weeksAgo(4, 0, 10, 0), notes: 'Memorial gift in honor of the Johnson family' },
    { memberId: memberUsers[4]!._id, amount: 2500, fund: buildingFund._id, method: 'online' as const, recurring: true, recurringSchedule: 'monthly' as const, status: 'completed' as const, date: weeksAgo(2, 0, 10, 0) },
    { memberId: memberUsers[8]!._id, amount: 750, fund: buildingFund._id, method: 'online' as const, recurring: false, status: 'completed' as const, date: weeksAgo(1, 0, 10, 0) },
    { memberId: memberUsers[10]!._id, amount: 1500, fund: buildingFund._id, method: 'check' as const, recurring: false, status: 'completed' as const, date: weeksAgo(6, 0, 10, 0) },
    // Missions Fund donations
    { memberId: memberUsers[6]!._id, amount: 200, fund: missionsFund._id, method: 'online' as const, recurring: true, recurringSchedule: 'weekly' as const, status: 'completed' as const, date: weeksAgo(1, 0, 10, 0) },
    { memberId: memberUsers[7]!._id, amount: 300, fund: missionsFund._id, method: 'cash' as const, recurring: false, status: 'completed' as const, date: weeksAgo(3, 0, 10, 0) },
    { memberId: memberUsers[9]!._id, amount: 150, fund: missionsFund._id, method: 'online' as const, recurring: true, recurringSchedule: 'biweekly' as const, status: 'completed' as const, date: weeksAgo(2, 0, 10, 0) },
    { memberId: memberUsers[11]!._id, amount: 50, fund: missionsFund._id, method: 'cash' as const, recurring: false, status: 'pending' as const, date: addDays(0, 10, 0) },
  ];

  for (const d of donationsData) {
    await Donation.create({ ...d, currency: 'USD' });
  }
  console.log(`  Created ${donationsData.length} donations`);

  // ------------------------------------------------------------------
  // 9. Pages (4)
  // ------------------------------------------------------------------
  console.log('\nCreating pages...');

  const pagesData = [
    {
      title: 'About Us',
      slug: 'about-us',
      content: [
        { type: 'heading', level: 1, text: 'About Grace Community Church' },
        { type: 'paragraph', text: 'Grace Community Church was founded in 1987 with a simple vision: to be a place where everyone can encounter the love of God and grow in their faith. What started as a small group of twelve families gathering in a living room has grown into a vibrant community of believers serving Springfield and beyond.' },
        { type: 'heading', level: 2, text: 'Our Mission' },
        { type: 'paragraph', text: 'To know God, grow together, and make Him known. We pursue this mission through authentic worship, biblical teaching, meaningful community, and compassionate service.' },
        { type: 'heading', level: 2, text: 'Our Leadership' },
        { type: 'paragraph', text: 'Our church is led by a team of elders and deacons who serve alongside our pastoral staff. Pastor David Chen has served as lead pastor since 2018, and Sarah Mitchell oversees our administrative and operational ministries.' },
      ],
      status: 'published' as const,
      seo: { title: 'About Us | Grace Community Church', description: 'Learn about the history, mission, and leadership of Grace Community Church in Springfield.', noIndex: false },
      publishedAt: weeksAgo(12, 0, 9, 0),
      publishedBy: adminUser._id,
      createdBy: adminUser._id,
    },
    {
      title: 'Statement of Faith',
      slug: 'statement-of-faith',
      content: [
        { type: 'heading', level: 1, text: 'What We Believe' },
        { type: 'paragraph', text: 'Grace Community Church holds to the historic Christian faith as expressed in the Apostles\' Creed and the Nicene Creed. The following statements summarize our core convictions.' },
        { type: 'heading', level: 2, text: 'The Bible' },
        { type: 'paragraph', text: 'We believe the Bible is the inspired, authoritative Word of God, useful for teaching, correction, and training in righteousness.' },
        { type: 'heading', level: 2, text: 'God' },
        { type: 'paragraph', text: 'We believe in one God, eternally existing in three persons: Father, Son, and Holy Spirit.' },
        { type: 'heading', level: 2, text: 'Salvation' },
        { type: 'paragraph', text: 'We believe salvation is a gift of grace received through faith in Jesus Christ, who died for our sins and rose again.' },
      ],
      status: 'published' as const,
      seo: { title: 'Statement of Faith | Grace Community Church', description: 'Our core beliefs and doctrinal positions at Grace Community Church.', noIndex: false },
      publishedAt: weeksAgo(12, 0, 9, 0),
      publishedBy: adminUser._id,
      createdBy: adminUser._id,
    },
    {
      title: 'Upcoming Events',
      slug: 'upcoming-events',
      content: [
        { type: 'heading', level: 1, text: 'Upcoming Events' },
        { type: 'paragraph', text: 'Check back soon for our full calendar of upcoming events and activities.' },
      ],
      status: 'draft' as const,
      seo: { title: 'Events | Grace Community Church', description: 'Upcoming events and activities at Grace Community Church.', noIndex: true },
      createdBy: adminUser._id,
    },
    {
      title: 'Volunteer Opportunities',
      slug: 'volunteer',
      content: [
        { type: 'heading', level: 1, text: 'Serve With Us' },
        { type: 'paragraph', text: 'There are many ways to get involved at Grace Community Church. From greeting on Sunday mornings to serving at our community food pantry, every volunteer makes a difference.' },
      ],
      status: 'archived' as const,
      seo: { title: 'Volunteer | Grace Community Church', description: 'Find volunteer opportunities at Grace Community Church.', noIndex: true },
      createdBy: adminUser._id,
    },
  ];

  for (const p of pagesData) {
    await Page.create(p);
  }
  console.log(`  Created ${pagesData.length} pages`);

  // ------------------------------------------------------------------
  // 10. Resources (6) + Submissions (2)
  // ------------------------------------------------------------------
  console.log('\nCreating community resources and submissions...');

  const resourcesData = [
    {
      name: 'Springfield Community Food Pantry',
      description: 'Provides free groceries to families in need every Tuesday and Thursday. No documentation required. Serves approximately 200 families per week.',
      category: 'food' as const,
      provider: 'Springfield Community Services',
      eligibility: 'Open to all Springfield residents. No income verification required.',
      hours: 'Tuesdays and Thursdays 9:00 AM - 2:00 PM',
      phone: '(555) 234-5678',
      email: 'pantry@springfieldcs.org',
      website: 'https://springfieldcs.org/food-pantry',
      address: { street: '450 Oak Avenue', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
      languages: ['en', 'es'],
      submittedBy: adminUser._id,
      approved: true,
      featured: true,
      tags: ['food', 'groceries', 'emergency assistance'],
    },
    {
      name: 'Good Neighbor Health Clinic',
      description: 'Free medical and dental clinic for uninsured and underinsured individuals. Staffed by volunteer physicians, dentists, and nurses.',
      category: 'medical' as const,
      provider: 'Good Neighbor Health Network',
      eligibility: 'Uninsured or underinsured individuals. Must be a resident of the greater Springfield area.',
      hours: 'Monday, Wednesday, Friday 8:00 AM - 5:00 PM; Saturday 9:00 AM - 1:00 PM',
      phone: '(555) 345-6789',
      email: 'info@goodneighborhealth.org',
      website: 'https://goodneighborhealth.org',
      address: { street: '1200 Health Center Drive', city: 'Springfield', state: 'IL', zip: '62702', country: 'US' },
      languages: ['en', 'es', 'vi'],
      submittedBy: adminUser._id,
      approved: true,
      featured: true,
      tags: ['health', 'medical', 'dental', 'free clinic'],
    },
    {
      name: 'Hope Housing Alliance',
      description: 'Emergency shelter and transitional housing program. Offers case management, job readiness training, and permanent housing placement assistance.',
      category: 'housing' as const,
      provider: 'Hope Housing Alliance',
      eligibility: 'Individuals and families experiencing homelessness. Priority given to families with children and veterans.',
      hours: 'Intake: Monday - Friday 8:00 AM - 4:00 PM. Shelter: 24/7.',
      phone: '(555) 456-7890',
      email: 'intake@hopehousing.org',
      website: 'https://hopehousing.org',
      address: { street: '789 Shelter Road', city: 'Springfield', state: 'IL', zip: '62703', country: 'US' },
      languages: ['en'],
      submittedBy: adminUser._id,
      approved: true,
      featured: false,
      tags: ['housing', 'shelter', 'homeless', 'transitional housing'],
    },
    {
      name: 'Springfield Legal Aid Society',
      description: 'Free legal assistance for low-income residents in civil matters including family law, landlord-tenant disputes, immigration, and consumer protection.',
      category: 'legal' as const,
      provider: 'Springfield Legal Aid Society',
      eligibility: 'Household income at or below 200% of federal poverty level.',
      hours: 'Monday - Friday 9:00 AM - 5:00 PM',
      phone: '(555) 567-8901',
      email: 'help@springfieldlegalaid.org',
      website: 'https://springfieldlegalaid.org',
      address: { street: '320 Justice Boulevard', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
      languages: ['en', 'es'],
      submittedBy: pastorUser._id,
      approved: true,
      featured: false,
      tags: ['legal', 'immigration', 'family law', 'tenant rights'],
    },
    {
      name: 'Workforce Development Center',
      description: 'Job training, resume workshops, interview coaching, and career counseling. Partners with local employers for direct job placement.',
      category: 'employment' as const,
      provider: 'Springfield Workforce Board',
      eligibility: 'Springfield residents age 18 and older. Special programs for veterans and formerly incarcerated individuals.',
      hours: 'Monday - Friday 8:30 AM - 4:30 PM',
      phone: '(555) 678-9012',
      email: 'jobs@springfieldworkforce.org',
      website: 'https://springfieldworkforce.org',
      address: { street: '555 Employment Way', city: 'Springfield', state: 'IL', zip: '62704', country: 'US' },
      languages: ['en'],
      submittedBy: pastorUser._id,
      approved: true,
      featured: false,
      tags: ['jobs', 'employment', 'training', 'career'],
    },
    {
      name: '24/7 Crisis Helpline',
      description: 'Confidential crisis intervention and suicide prevention hotline. Trained counselors available around the clock. Text and chat options also available.',
      category: 'mental_health' as const,
      provider: 'Central Illinois Crisis Center',
      eligibility: 'Anyone in crisis. No eligibility requirements.',
      hours: '24 hours a day, 7 days a week',
      phone: '(555) 789-0123',
      email: 'support@cicrisiscenter.org',
      website: 'https://cicrisiscenter.org',
      address: { street: '100 Crisis Center Lane', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
      languages: ['en', 'es'],
      submittedBy: adminUser._id,
      approved: true,
      featured: true,
      tags: ['crisis', 'mental health', 'suicide prevention', 'counseling', '24/7'],
    },
  ];

  for (const r of resourcesData) {
    await Resource.create(r);
  }
  console.log(`  Created ${resourcesData.length} resources`);

  const submissionsData = [
    {
      name: 'Helping Hands Clothing Closet',
      description: 'Free clothing for individuals and families in need. Accepts donations of gently used clothing, shoes, and accessories.',
      category: 'clothing' as const,
      provider: 'First Baptist Church of Springfield',
      eligibility: 'Open to anyone in need. No documentation required.',
      hours: 'Saturdays 10:00 AM - 2:00 PM',
      phone: '(555) 890-1234',
      address: { street: '200 Church Street', city: 'Springfield', state: 'IL', zip: '62702', country: 'US' },
      languages: ['en'],
      tags: ['clothing', 'free'],
      submitterName: 'Margaret Davis',
      submitterEmail: 'margaret.davis@email.com',
      status: 'pending' as const,
    },
    {
      name: 'Senior Companion Program',
      description: 'Volunteer-based program that pairs seniors with companions for regular visits, errands, and social activities to combat isolation.',
      category: 'senior_services' as const,
      provider: 'Springfield Area Agency on Aging',
      eligibility: 'Adults age 60 and older living independently in Springfield.',
      hours: 'Monday - Friday 9:00 AM - 3:00 PM',
      phone: '(555) 901-2345',
      email: 'companions@springfieldaging.org',
      address: { street: '88 Elder Care Circle', city: 'Springfield', state: 'IL', zip: '62703', country: 'US' },
      languages: ['en'],
      tags: ['seniors', 'companionship', 'social'],
      submitterName: 'Robert Wallace',
      submitterEmail: 'r.wallace@email.com',
      status: 'pending' as const,
    },
  ];

  for (const s of submissionsData) {
    await ResourceSubmission.create(s);
  }
  console.log(`  Created ${submissionsData.length} resource submissions (pending review)`);

  // ------------------------------------------------------------------
  // 11. Households (5)
  // ------------------------------------------------------------------
  console.log('\nCreating households...');

  const householdsData = [
    {
      name: 'Williams Household',
      members: [memberRecords[0]!._id, memberRecords[1]!._id],
      address: { street: '1523 Maple Drive', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
    },
    {
      name: 'Patterson-Sharma Household',
      members: [memberRecords[2]!._id, memberRecords[3]!._id],
      address: { street: '842 Birch Lane', city: 'Springfield', state: 'IL', zip: '62702', country: 'US' },
    },
    {
      name: 'Rodriguez-Johnson Household',
      members: [memberRecords[4]!._id, memberRecords[5]!._id],
      address: { street: '3100 Oakwood Court', city: 'Springfield', state: 'IL', zip: '62703', country: 'US' },
    },
    {
      name: 'Kim-Vasquez Household',
      members: [memberRecords[6]!._id, memberRecords[7]!._id],
      address: { street: '615 Sunset Boulevard', city: 'Springfield', state: 'IL', zip: '62704', country: 'US' },
    },
    {
      name: 'Thompson Household',
      members: [memberRecords[8]!._id, memberRecords[9]!._id],
      address: { street: '2200 Pine Street', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
    },
  ];

  for (const h of householdsData) {
    await Household.create(h);
  }
  console.log(`  Created ${householdsData.length} households`);

  // ------------------------------------------------------------------
  // 12. Care Notes (8)
  // ------------------------------------------------------------------
  console.log('\nCreating care notes...');

  const careNotesData = [
    {
      memberId: memberRecords[0]!._id,
      authorId: pastorUser._id,
      type: 'visit' as const,
      content: 'Visited Marcus at home after his knee surgery. He is recovering well and expects to be back at church within two weeks. His wife Rachel is managing everything at home. Brought a meal from the fellowship team.',
      resolved: true,
    },
    {
      memberId: memberRecords[8]!._id,
      authorId: pastorUser._id,
      type: 'hospital' as const,
      content: 'Robert was admitted to Springfield Memorial for chest pains. Tests came back clear — it was a panic attack related to work stress. He and Grace appreciated the visit. Prayed together before leaving.',
      resolved: true,
    },
    {
      memberId: memberRecords[12]!._id,
      authorId: pastorUser._id,
      type: 'bereavement' as const,
      content: 'Samuel\'s mother passed away last Thursday. Funeral is this Saturday at 11 AM. The church is providing the reception meal. Samuel is leaning heavily on his small group for support.',
      followUpDate: addDays(14, 10, 0),
      resolved: false,
    },
    {
      memberId: memberRecords[5]!._id,
      authorId: adminUser._id,
      type: 'meal_train' as const,
      content: 'Set up a two-week meal train for Aisha after her C-section. Eight families have signed up so far. Meals are being delivered Monday through Friday through the end of the month.',
      followUpDate: addDays(7, 10, 0),
      resolved: false,
    },
    {
      memberId: memberRecords[16]!._id,
      authorId: pastorUser._id,
      type: 'follow_up' as const,
      content: 'Christopher mentioned feeling disconnected from the church community. Suggested he join the Thursday night small group. He seemed interested and said he would try it this week.',
      followUpDate: addDays(10, 10, 0),
      resolved: false,
    },
    {
      memberId: memberRecords[19]!._id,
      authorId: pastorUser._id,
      type: 'general' as const,
      content: 'Megan asked about serving opportunities. She has a background in graphic design and is interested in helping with the church website and social media. Connected her with Sarah Mitchell.',
      resolved: true,
    },
    {
      memberId: memberRecords[3]!._id,
      authorId: adminUser._id,
      type: 'visit' as const,
      content: 'Visited Priya to welcome her after she officially became a member last month. She and James are settling in well. They are interested in hosting a small group in their home next quarter.',
      resolved: true,
    },
    {
      memberId: memberRecords[20]!._id,
      authorId: pastorUser._id,
      type: 'hospital' as const,
      content: 'Isaiah had an emergency appendectomy on Tuesday. Surgery went smoothly and he was discharged Wednesday afternoon. His wife is taking time off work to help him recover. Will check in again next week.',
      followUpDate: addDays(5, 10, 0),
      resolved: false,
    },
  ];

  for (const cn of careNotesData) {
    await MemberCareNote.create(cn);
  }
  console.log(`  Created ${careNotesData.length} care notes`);

  // ------------------------------------------------------------------
  // 13. Bookable Resources (4) + Bookings (6)
  // ------------------------------------------------------------------
  console.log('\nCreating bookable resources and bookings...');

  const fellowshipHall = await BookableResource.create({
    name: 'Fellowship Hall',
    type: 'room',
    description: 'Large multipurpose room with commercial kitchen access. Seats up to 150 people. Includes tables, chairs, and AV equipment.',
    capacity: 150,
    active: true,
  });

  const conferenceRoom = await BookableResource.create({
    name: 'Conference Room',
    type: 'room',
    description: 'Meeting room with conference table seating for 12. Whiteboard, projector, and video conferencing equipment available.',
    capacity: 12,
    active: true,
  });

  const churchVan = await BookableResource.create({
    name: 'Church Van',
    type: 'vehicle',
    description: '15-passenger Ford Transit van. Valid church driver authorization required. Fuel card in glove compartment.',
    capacity: 15,
    active: true,
  });

  const projector = await BookableResource.create({
    name: 'Portable Projector Kit',
    type: 'equipment',
    description: 'Epson projector with portable screen, HDMI cable, and extension cord. Stored in the AV closet (Room 101).',
    active: true,
  });

  console.log('  Created 4 bookable resources');

  const bookingsData = [
    {
      resource: fellowshipHall._id,
      title: 'New Member Welcome Lunch',
      startTime: addDays(17, 12, 0),
      endTime: addDays(17, 14, 30),
      bookedBy: adminUser._id,
      notes: 'Need tables set up for 25 guests. Kitchen access required for catering setup at 11 AM.',
      status: 'confirmed' as const,
    },
    {
      resource: conferenceRoom._id,
      title: 'Elder Board Meeting',
      startTime: addDays(7, 18, 0),
      endTime: addDays(7, 20, 0),
      bookedBy: adminUser._id,
      status: 'confirmed' as const,
    },
    {
      resource: churchVan._id,
      title: 'Youth Group Trip to State Park',
      startTime: addDays(14, 8, 0),
      endTime: addDays(14, 18, 0),
      bookedBy: pastorUser._id,
      notes: 'Need van fueled and cleaned the day before. 12 students plus 2 adult leaders.',
      status: 'confirmed' as const,
    },
    {
      resource: projector._id,
      title: 'Financial Peace Workshop',
      startTime: addDays(14, 18, 0),
      endTime: addDays(14, 21, 0),
      bookedBy: adminUser._id,
      status: 'confirmed' as const,
    },
    {
      resource: fellowshipHall._id,
      title: 'Women\'s Ministry Brunch',
      startTime: weeksAgo(2, 6, 9, 0),
      endTime: weeksAgo(2, 6, 12, 0),
      bookedBy: adminUser._id,
      notes: 'Event completed successfully. 45 attendees.',
      status: 'confirmed' as const,
    },
    {
      resource: conferenceRoom._id,
      title: 'Deacon Meeting (Rescheduled)',
      startTime: addDays(3, 19, 0),
      endTime: addDays(3, 20, 30),
      bookedBy: pastorUser._id,
      notes: 'Cancelled due to scheduling conflict. Will reschedule for next month.',
      status: 'cancelled' as const,
    },
  ];

  for (const b of bookingsData) {
    await Booking.create(b);
  }
  console.log(`  Created ${bookingsData.length} bookings`);

  // ------------------------------------------------------------------
  // Feature config (enable everything for demo)
  // ------------------------------------------------------------------
  console.log('\nSeeding feature config...');
  const features = [
    { key: 'sermons', enabled: true },
    { key: 'groups', enabled: true },
    { key: 'resourceHub', enabled: true },
    { key: 'giving', enabled: true },
    { key: 'attendance', enabled: true },
    { key: 'memberCare', enabled: true },
    { key: 'sms', enabled: false },
    { key: 'connect', enabled: true },
    { key: 'ai', enabled: false },
    { key: 'communication', enabled: true },
    { key: 'events', enabled: true },
  ];
  await FeatureConfig.insertMany(features);
  console.log('  Feature config seeded (most features enabled for demo)');

  // ------------------------------------------------------------------
  // Instance settings
  // ------------------------------------------------------------------
  await InstanceSettings.create({
    instanceName: 'Grace Community Church',
    instanceUrl: config.instance.url,
    vertical: config.vertical,
    locale: 'en',
    timezone: 'America/New_York',
    branding: {
      primaryColor: '#1e40af',
      secondaryColor: '#f59e0b',
    },
  });
  console.log('  Instance settings seeded');

  // ------------------------------------------------------------------
  // Default theme
  // ------------------------------------------------------------------
  await Theme.create({
    primaryColor: '#1e40af',
    secondaryColor: '#f59e0b',
    fontFamily: 'Inter, sans-serif',
  });
  console.log('  Default theme seeded');

  // ------------------------------------------------------------------
  // Done
  // ------------------------------------------------------------------
  console.log('\n========================================');
  console.log('  Demo seed complete!');
  console.log('========================================');
  console.log('');
  console.log('  Users created: 32');
  console.log('  Member records: 32');
  console.log('  Events: 12');
  console.log('  Sermon series: 3');
  console.log('  Sermons: 15');
  console.log('  Groups: 6');
  console.log('  Messages: 4');
  console.log('  Funds: 3');
  console.log('  Donations: 12');
  console.log('  Pages: 4');
  console.log('  Resources: 6');
  console.log('  Resource submissions: 2');
  console.log('  Households: 5');
  console.log('  Care notes: 8');
  console.log('  Bookable resources: 4');
  console.log('  Bookings: 6');
  console.log('');
  console.log('  Login credentials:');
  console.log('    Admin:  admin@gracecommunity.church / ChangeMe123!');
  console.log('    Pastor: pastor@gracecommunity.church / ChangeMe123!');
  console.log('    Member: marcus.williams@example.com / ChangeMe123!');
  console.log('========================================');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

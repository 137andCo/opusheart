import 'dotenv/config';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { blindIndex } from '../utils/blindIndex.js';
import { User } from '../models/User.js';
import { FeatureConfig } from '../models/FeatureConfig.js';
import { InstanceSettings } from '../models/InstanceSettings.js';
import { PageTemplate } from '../models/PageTemplate.js';
import { Theme } from '../models/Theme.js';
import { Resource } from '../models/Resource.js';
import { Event } from '../models/Event.js';
import { Group } from '../models/Group.js';
import { BookableResource } from '../models/BookableResource.js';
import { PrayerRequest } from '../models/PrayerRequest.js';
import { SermonSeries } from '../models/SermonSeries.js';
import { Sermon } from '../models/Sermon.js';
import { Fund } from '../models/Fund.js';
import { loadConfig } from '../config/index.js';

async function seed(): Promise<void> {
  const config = loadConfig();
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB');

  // Clear existing seed data
  await User.deleteMany({
    emailHash: {
      $in: [
        blindIndex('admin@opusheart.local'),
        blindIndex('pastor@opusheart.local'),
        blindIndex('member@opusheart.local'),
      ],
    },
  });

  const passwordHash = await argon2.hash('ChangeMe123!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Seed users
  const users = [
    {
      email: 'admin@opusheart.local',
      emailHash: blindIndex('admin@opusheart.local'),
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
    },
    {
      email: 'pastor@opusheart.local',
      emailHash: blindIndex('pastor@opusheart.local'),
      passwordHash,
      firstName: 'Pastor',
      lastName: 'John',
      role: 'pastor',
    },
    {
      email: 'member@opusheart.local',
      emailHash: blindIndex('member@opusheart.local'),
      passwordHash,
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'member',
      privacySettings: {
        showInDirectory: true,
        showEmail: false,
        showPhone: false,
        allowCareTracking: false,
      },
    },
  ];

  for (const userData of users) {
    await User.create(userData);
    console.log(`  Created ${userData.role}: ${userData.email.split('@')[0]}@... / ChangeMe123!`);
  }

  // Seed default feature config
  const defaultFeatures = [
    { key: 'sermons', enabled: true },
    { key: 'groups', enabled: true },
    { key: 'resourceHub', enabled: true },
    { key: 'giving', enabled: false },
    { key: 'attendance', enabled: false },
    { key: 'memberCare', enabled: false },
    { key: 'sms', enabled: false },
    { key: 'connect', enabled: false },
    { key: 'ai', enabled: false },
    { key: 'communication', enabled: true },
    { key: 'events', enabled: true },
  ];

  await FeatureConfig.deleteMany({});
  await FeatureConfig.insertMany(defaultFeatures);
  console.log('  Feature config seeded (sermons, groups, resourceHub, communication, events enabled)');

  // Seed instance settings
  await InstanceSettings.deleteMany({});
  await InstanceSettings.create({
    instanceName: config.instance.name,
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

  // Seed page templates
  await PageTemplate.deleteMany({});
  const templates = [
    {
      name: 'Church Homepage',
      description: 'A welcoming homepage with hero section, service times, and recent announcements.',
      vertical: 'church',
      category: 'landing',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to Our Church' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Join us for worship every Sunday.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Service Times' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sunday: 9:00 AM & 11:00 AM' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Wednesday: 7:00 PM Bible Study' }] }] },
        ] },
      ],
    },
    {
      name: 'About Us',
      description: 'Tell your community story with sections for mission, vision, and leadership.',
      vertical: 'church',
      category: 'about',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'About Our Church' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Our Mission' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'We exist to love God, love people, and make disciples.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Our Leadership' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Meet the team that serves our community.' }] },
      ],
    },
    {
      name: 'Sermons',
      description: 'A sermon listing page with categories and search.',
      vertical: 'church',
      category: 'content',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Sermons' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Watch or listen to our latest messages.' }] },
      ],
    },
    {
      name: 'Events',
      description: 'Upcoming events calendar page for your community.',
      vertical: 'church',
      category: 'content',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Upcoming Events' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Stay connected with what is happening in our community.' }] },
      ],
    },
  ];
  await PageTemplate.insertMany(templates);
  console.log(`  Seeded ${templates.length} page templates`);

  // Seed default theme
  await Theme.deleteMany({});
  await Theme.create({
    primaryColor: '#1e40af',
    secondaryColor: '#f59e0b',
    fontFamily: 'Inter, sans-serif',
  });
  console.log('  Default theme seeded');

  // Seed community resources
  await Resource.deleteMany({});
  const adminUser = await User.findOne({ emailHash: blindIndex('admin@opusheart.local') });
  const adminId = adminUser?._id;

  const resources = [
    {
      name: 'Community Food Bank',
      description: 'Free groceries and hot meals for families in need. No documentation required.',
      category: 'food',
      provider: 'Hope Food Ministries',
      eligibility: 'Open to all community members. No income verification required.',
      hours: 'Mon-Fri 9am-5pm, Sat 10am-2pm',
      phone: '(555) 123-4567',
      email: 'info@hopefood.org',
      website: 'https://hopefood.example.org',
      address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
      location: { type: 'Point' as const, coordinates: [-89.6501, 39.7817] },
      languages: ['en', 'es'],
      tags: ['food', 'groceries', 'meals', 'free'],
      approved: true,
      featured: true,
      submittedBy: adminId,
      verifiedBy: adminId,
      lastVerified: new Date(),
    },
    {
      name: 'Utility Assistance Program',
      description: 'Help with electric, gas, and water bills for qualifying households.',
      category: 'utilities',
      provider: 'Springfield Community Action',
      eligibility: 'Household income below 150% federal poverty level.',
      hours: 'Mon-Thu 8am-4pm',
      phone: '(555) 234-5678',
      address: { street: '456 Oak Ave', city: 'Springfield', state: 'IL', zip: '62702', country: 'US' },
      location: { type: 'Point' as const, coordinates: [-89.6440, 39.7990] },
      languages: ['en'],
      tags: ['utilities', 'bills', 'assistance'],
      approved: true,
      featured: false,
      submittedBy: adminId,
      verifiedBy: adminId,
      lastVerified: new Date(),
    },
    {
      name: 'Workforce Development Center',
      description: 'Free job training, resume workshops, and career counseling.',
      category: 'employment',
      provider: 'Springfield Jobs Initiative',
      eligibility: 'Adults 18+. Priority for unemployed and underemployed.',
      hours: 'Mon-Fri 8am-6pm',
      phone: '(555) 345-6789',
      email: 'jobs@springfieldjobs.org',
      website: 'https://springfieldjobs.example.org',
      address: { street: '789 Elm St', city: 'Springfield', state: 'IL', zip: '62703', country: 'US' },
      location: { type: 'Point' as const, coordinates: [-89.6365, 39.7700] },
      languages: ['en', 'es', 'fr'],
      tags: ['jobs', 'training', 'career', 'resume'],
      approved: true,
      featured: true,
      submittedBy: adminId,
      verifiedBy: adminId,
      lastVerified: new Date(),
    },
    {
      name: 'Free Health Clinic',
      description: 'Walk-in medical clinic providing basic healthcare, vaccinations, and health screenings at no cost.',
      category: 'medical',
      provider: 'Good Samaritan Health Services',
      eligibility: 'Uninsured or underinsured individuals. No ID required.',
      hours: 'Tue-Sat 9am-3pm',
      phone: '(555) 456-7890',
      email: 'clinic@goodsamhealth.org',
      address: { street: '321 Health Way', city: 'Springfield', state: 'IL', zip: '62704', country: 'US' },
      location: { type: 'Point' as const, coordinates: [-89.6600, 39.7850] },
      languages: ['en', 'es'],
      tags: ['medical', 'healthcare', 'free clinic', 'vaccinations'],
      approved: true,
      featured: true,
      submittedBy: adminId,
      verifiedBy: adminId,
      lastVerified: new Date(),
    },
  ];

  for (const resourceData of resources) {
    await Resource.create(resourceData);
  }
  console.log(`  Seeded ${resources.length} community resources (food bank, utilities, jobs, clinic)`);

  // Seed events
  await Event.deleteMany({});

  // Compute realistic upcoming dates
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  nextSunday.setHours(10, 0, 0, 0);
  const nextSundayEnd = new Date(nextSunday);
  nextSundayEnd.setHours(12, 0, 0, 0);

  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
  nextFriday.setHours(19, 0, 0, 0);
  const nextFridayEnd = new Date(nextFriday);
  nextFridayEnd.setHours(21, 0, 0, 0);

  const firstSatNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  while (firstSatNextMonth.getDay() !== 6) {
    firstSatNextMonth.setDate(firstSatNextMonth.getDate() + 1);
  }
  firstSatNextMonth.setHours(17, 0, 0, 0);
  const firstSatNextMonthEnd = new Date(firstSatNextMonth);
  firstSatNextMonthEnd.setHours(19, 0, 0, 0);

  const events = [
    {
      title: 'Sunday Worship Service',
      description: 'Weekly worship service with praise, prayer, and sermon.',
      startDate: nextSunday,
      endDate: nextSundayEnd,
      location: 'Main Sanctuary',
      visibility: 'public',
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'weekly', interval: 1, dayOfWeek: [0], exceptions: [] },
      volunteerSlots: [
        { role: 'Greeter', needed: 4, filled: [] },
        { role: 'Sound Tech', needed: 2, filled: [] },
      ],
      createdBy: adminUser!._id,
    },
    {
      title: 'Community Potluck',
      description: 'Monthly fellowship meal. Bring a dish to share!',
      startDate: firstSatNextMonth,
      endDate: firstSatNextMonthEnd,
      location: 'Fellowship Hall',
      visibility: 'public',
      registrationRequired: false,
      allDay: false,
      recurring: { frequency: 'monthly', interval: 1, exceptions: [] },
      createdBy: adminUser!._id,
    },
    {
      title: 'Youth Game Night',
      description: 'Fun and fellowship for ages 13-18.',
      startDate: nextFriday,
      endDate: nextFridayEnd,
      location: 'Youth Room',
      visibility: 'members',
      maxAttendees: 30,
      registrationRequired: true,
      allDay: false,
      createdBy: adminUser!._id,
    },
  ];

  for (const eventData of events) {
    await Event.create(eventData);
  }
  console.log(`  Seeded ${events.length} events (worship, potluck, youth night)`);

  // Seed groups
  await Group.deleteMany({});

  const groups = [
    {
      name: 'Young Adults',
      description: 'Community for ages 18-30. Bible study, social events, and service projects.',
      type: 'small_group',
      visibility: 'public',
      meetingSchedule: 'Wednesdays 7:00 PM',
      location: 'Room 201',
      createdBy: adminUser!._id,
      members: [{ userId: adminUser!._id, role: 'leader', joinedAt: new Date() }],
    },
    {
      name: "Women's Bible Study",
      description: 'Deep dive into Scripture with fellowship and prayer.',
      type: 'bible_study',
      visibility: 'public',
      meetingSchedule: 'Tuesdays 10:00 AM',
      location: 'Library',
      createdBy: adminUser!._id,
      members: [{ userId: adminUser!._id, role: 'leader', joinedAt: new Date() }],
    },
    {
      name: 'Finance Committee',
      description: 'Oversight of church finances, budgeting, and stewardship.',
      type: 'committee',
      visibility: 'members',
      meetingSchedule: 'First Monday monthly',
      createdBy: adminUser!._id,
      members: [{ userId: adminUser!._id, role: 'leader', joinedAt: new Date() }],
    },
  ];

  for (const groupData of groups) {
    await Group.create(groupData);
  }
  console.log(`  Seeded ${groups.length} groups (young adults, bible study, committee)`);

  // Seed bookable resources
  await BookableResource.deleteMany({});

  const bookableResources = [
    { name: 'Fellowship Hall', type: 'room', description: 'Large hall with kitchen, seats 200', capacity: 200, active: true },
    { name: 'Church Van', type: 'vehicle', description: '15-passenger van', capacity: 15, active: true },
  ];

  for (const brData of bookableResources) {
    await BookableResource.create(brData);
  }
  console.log(`  Seeded ${bookableResources.length} bookable resources (hall, van)`);

  // Seed prayer requests
  await PrayerRequest.deleteMany({});
  const pastorUser = await User.findOne({ emailHash: blindIndex('pastor@opusheart.local') });
  const memberUser = await User.findOne({ emailHash: blindIndex('member@opusheart.local') });

  const prayerRequests = [
    {
      content: 'Please pray for my mother who is recovering from surgery. She is in good spirits but the road ahead is long.',
      category: 'health' as const,
      submittedBy: memberUser!._id,
      anonymous: false,
      visibility: 'congregation' as const,
      status: 'active' as const,
      prayerCount: 12,
    },
    {
      content: 'Our family is going through a difficult transition with a cross-country move. Pray for peace and direction.',
      category: 'family' as const,
      submittedBy: memberUser!._id,
      anonymous: true,
      visibility: 'pastor_only' as const,
      status: 'active' as const,
      prayerCount: 3,
    },
    {
      content: 'Grateful for answered prayer — my son got the scholarship! Thank you for praying with us.',
      category: 'gratitude' as const,
      submittedBy: pastorUser!._id,
      anonymous: false,
      visibility: 'congregation' as const,
      status: 'answered' as const,
      prayerCount: 24,
    },
  ];

  for (const pr of prayerRequests) {
    await PrayerRequest.create(pr);
  }
  console.log(`  Seeded ${prayerRequests.length} prayer requests (health, family, gratitude)`);

  // Seed sermon series and sermons
  await Sermon.deleteMany({});
  await SermonSeries.deleteMany({});

  const findingPeaceSeries = await SermonSeries.create({
    title: 'Finding Peace',
    description: 'A three-part series exploring how to find peace in troubled times through Scripture.',
    startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    createdBy: pastorUser!._id,
  });

  const sermons = [
    {
      title: 'Peace in the Storm',
      speaker: 'Pastor John',
      date: new Date(now.getFullYear(), now.getMonth() - 1, 5),
      series: findingPeaceSeries._id,
      seriesOrder: 1,
      description: 'When life feels overwhelming, where do we turn? Jesus calmed the storm — and He can calm ours too.',
      scriptureReferences: ['Mark 4:35-41', 'Philippians 4:6-7'],
      tags: ['peace', 'faith', 'storms'],
      published: true,
      podcastInclude: true,
      createdBy: pastorUser!._id,
    },
    {
      title: 'The Peace That Passes Understanding',
      speaker: 'Pastor John',
      date: new Date(now.getFullYear(), now.getMonth() - 1, 12),
      series: findingPeaceSeries._id,
      seriesOrder: 2,
      description: 'Paul wrote about peace from a prison cell. What did he know that we often forget?',
      scriptureReferences: ['Philippians 4:4-9', 'Isaiah 26:3'],
      tags: ['peace', 'contentment', 'trust'],
      published: true,
      podcastInclude: true,
      createdBy: pastorUser!._id,
    },
    {
      title: 'Becoming Peacemakers',
      speaker: 'Pastor John',
      date: new Date(now.getFullYear(), now.getMonth() - 1, 19),
      series: findingPeaceSeries._id,
      seriesOrder: 3,
      description: 'Jesus called peacemakers blessed. How do we carry His peace into our families, workplaces, and communities?',
      scriptureReferences: ['Matthew 5:9', 'Romans 12:18', 'James 3:17-18'],
      tags: ['peace', 'relationships', 'community'],
      published: true,
      podcastInclude: true,
      createdBy: pastorUser!._id,
    },
  ];

  for (const sermon of sermons) {
    await Sermon.create(sermon);
  }
  console.log(`  Seeded ${sermons.length} sermons in "Finding Peace" series`);

  // Seed funds
  await Fund.deleteMany({});

  const funds = [
    {
      name: 'General Fund',
      description: 'Supports day-to-day operations, staff salaries, and facility maintenance.',
      goal: 250000,
      raised: 142500,
      active: true,
    },
    {
      name: 'Missions Fund',
      description: 'Supports local and international mission partners and short-term mission trips.',
      raised: 18750,
      active: true,
    },
  ];

  for (const fund of funds) {
    await Fund.create(fund);
  }
  console.log(`  Seeded ${funds.length} funds (General Fund, Missions Fund)`);

  console.log('\nSeed complete! Dev credentials:');
  console.log('  admin@opusheart.local / ChangeMe123!');
  console.log('  pastor@opusheart.local / ChangeMe123!');
  console.log('  member@opusheart.local / ChangeMe123!');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

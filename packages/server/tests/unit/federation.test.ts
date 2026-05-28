// Set env vars before any imports that might read them
process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);

import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { CryptoService } from '../../src/services/crypto.service.js';
import { FederationPeer } from '../../src/models/FederationPeer.js';
import { EmergencyBroadcast } from '../../src/models/EmergencyBroadcast.js';
import { User } from '../../src/models/User.js';
import type { AppConfig } from '../../src/config/index.js';

let app: ReturnType<typeof createApp>;
let token: string;

const baseConfig: AppConfig = {
  port: 3020,
  nodeEnv: 'test',
  mongo: { uri: '' },
  redis: { url: 'redis://localhost:6379' },
  jwt: {
    secret: 'test-jwt-secret-that-is-long-enough-for-testing',
    issuer: 'opusheart',
    audience: 'opusheart',
    accessExpiresIn: '15m',
    refreshSecret: 'test-refresh-secret-that-is-long-enough',
    refreshExpiresIn: '7d',
  },
  encryption: { key: 'a'.repeat(64) },
  cors: { origins: ['http://localhost:3000'] },
  features: {
    giving: false,
    attendance: false,
    memberCare: false,
    sms: false,
    connect: true,
    ai: false,
    sermons: false,
    groups: false,
    resourceHub: false,
    communication: false,
    events: false,
  },
  instance: { name: 'TestChurch', url: 'http://localhost:3020' },
  vertical: 'church',
};

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...baseConfig, ...overrides };
}

function makeToken(userId: string, role = 'admin'): string {
  return jwt.sign({ sub: userId, role }, baseConfig.jwt.secret, {
    issuer: baseConfig.jwt.issuer,
    audience: baseConfig.jwt.audience,
    expiresIn: '15m',
  });
}

beforeAll(async () => {
  await connectTestDb('federation');
  baseConfig.mongo.uri = 'mongodb://localhost:21001/opusheart_test_federation';
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await cleanTestDb();

  // Create a test user for auth
  const user = await User.create({
    email: 'admin@test.com',
    emailHash: 'testhash123',
    firstName: 'Test',
    lastName: 'Admin',
    passwordHash: 'hashed',
    role: 'admin',
    active: true,
  });
  token = makeToken(user.id);
  app = createApp(makeConfig());
});

// ────────────────────────────────────────────────────────────
// Crypto Tests
// ────────────────────────────────────────────────────────────

describe('CryptoService', () => {
  it('should generate a valid Ed25519 key pair', () => {
    const crypto = new CryptoService();
    const keys = crypto.generateKeyPair();

    expect(keys.publicKey).toBeDefined();
    expect(keys.secretKey).toBeDefined();
    // Ed25519 public key is 32 bytes = 44 base64 chars
    expect(Buffer.from(keys.publicKey, 'base64')).toHaveLength(32);
    // Ed25519 secret key is 64 bytes
    expect(Buffer.from(keys.secretKey, 'base64')).toHaveLength(64);
  });

  it('should sign and verify a message (roundtrip)', () => {
    const crypto = new CryptoService();
    const keys = crypto.generateKeyPair();

    const message = 'Hello, federation!';
    const signature = crypto.sign(message);

    expect(signature).toBeDefined();
    expect(crypto.verify(message, signature, keys.publicKey)).toBe(true);
  });

  it('should reject an invalid signature', () => {
    const crypto = new CryptoService();
    const keys = crypto.generateKeyPair();

    const message = 'Hello, federation!';
    const signature = crypto.sign(message);

    // Tamper with the message
    expect(crypto.verify('Tampered message', signature, keys.publicKey)).toBe(false);
  });

  it('should reject a signature from a different key', () => {
    const crypto1 = new CryptoService();
    const crypto2 = new CryptoService();
    crypto1.generateKeyPair();
    const keys2 = crypto2.generateKeyPair();

    const message = 'Hello, federation!';
    const signature = crypto1.sign(message);

    // Verify with wrong key
    expect(crypto2.verify(message, signature, keys2.publicKey)).toBe(false);
  });

  it('should load an existing key pair', () => {
    const crypto1 = new CryptoService();
    const keys = crypto1.generateKeyPair();

    const crypto2 = new CryptoService();
    crypto2.loadKeyPair(keys.publicKey, keys.secretKey);

    expect(crypto2.getPublicKey()).toBe(keys.publicKey);

    // Sign with loaded key, verify with original
    const message = 'test message';
    const sig = crypto2.sign(message);
    expect(crypto1.verify(message, sig, keys.publicKey)).toBe(true);
  });

  it('should throw when signing without a key pair', () => {
    const crypto = new CryptoService();
    expect(() => crypto.sign('test')).toThrow('No key pair loaded');
  });

  it('should throw when getting public key without a key pair', () => {
    const crypto = new CryptoService();
    expect(() => crypto.getPublicKey()).toThrow('No key pair loaded');
  });
});

// ────────────────────────────────────────────────────────────
// Federation Peer Tests
// ────────────────────────────────────────────────────────────

describe('Federation Peers', () => {
  const peerData = {
    instanceUrl: 'https://partner-church.example.com',
    instanceName: 'Partner Church',
    publicKey: Buffer.from(new Uint8Array(32)).toString('base64'),
    participationLevel: 'prayer_only',
  };

  it('POST /api/federation/peers — should create a pending peer', async () => {
    const res = await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send(peerData)
      .expect(201);

    expect(res.body.peer).toBeDefined();
    expect(res.body.peer.trustLevel).toBe('pending');
    expect(res.body.peer.instanceUrl).toBe(peerData.instanceUrl);
    expect(res.body.peer.instanceName).toBe(peerData.instanceName);
    expect(res.body.peer.active).toBe(true);
  });

  it('POST /api/federation/peers — should reject duplicate instanceUrl', async () => {
    await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send(peerData)
      .expect(201);

    await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send(peerData)
      .expect(409);
  });

  it('PATCH /api/federation/peers/:id/approve — should set trustLevel to trusted', async () => {
    const createRes = await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send(peerData)
      .expect(201);

    const peerId = createRes.body.peer.id;

    const res = await request(app)
      .patch(`/api/federation/peers/${peerId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.peer.trustLevel).toBe('trusted');
  });

  it('PATCH /api/federation/peers/:id/block — should set trustLevel to blocked', async () => {
    const createRes = await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send(peerData)
      .expect(201);

    const peerId = createRes.body.peer.id;

    const res = await request(app)
      .patch(`/api/federation/peers/${peerId}/block`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.peer.trustLevel).toBe('blocked');
    expect(res.body.peer.active).toBe(false);
  });

  it('DELETE /api/federation/peers/:id — should remove peer', async () => {
    const createRes = await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send(peerData)
      .expect(201);

    const peerId = createRes.body.peer.id;

    await request(app)
      .delete(`/api/federation/peers/${peerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Verify peer is gone
    const peer = await FederationPeer.findById(peerId);
    expect(peer).toBeNull();
  });

  it('GET /api/federation/peers — should list peers', async () => {
    await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send(peerData)
      .expect(201);

    const res = await request(app)
      .get('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.peers).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────
// Emergency Broadcast Tests
// ────────────────────────────────────────────────────────────

describe('Emergency Broadcasts', () => {
  const broadcastData = {
    severity: 'urgent',
    title: 'Flood Relief Needed',
    description: 'Major flooding in the area, families displaced',
    needs: [
      { type: 'supplies', description: 'Bottled water', quantity: 100, unit: 'cases' },
      { type: 'volunteers', description: 'Cleanup crew', quantity: 20 },
    ],
    location: { city: 'Springfield', state: 'IL', country: 'US' },
    contactMethod: 'Call 555-0123',
    maxHops: 3,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  it('POST /api/federation/emergency — should create a signed broadcast', async () => {
    const res = await request(app)
      .post('/api/federation/emergency')
      .set('Authorization', `Bearer ${token}`)
      .send(broadcastData)
      .expect(201);

    expect(res.body.broadcast).toBeDefined();
    expect(res.body.broadcast.title).toBe(broadcastData.title);
    expect(res.body.broadcast.severity).toBe('urgent');
    expect(res.body.broadcast.signature).toBeDefined();
    expect(res.body.broadcast.hopCount).toBe(0);
    expect(res.body.broadcast.needs).toHaveLength(2);
    expect(res.body.broadcast.needs[0].fulfilled).toBe(0);
    expect(res.body.broadcast.needs[0].pledges).toEqual([]);
  });

  it('GET /api/federation/emergency — should list only active (not expired) broadcasts', async () => {
    // Create an active broadcast
    await request(app)
      .post('/api/federation/emergency')
      .set('Authorization', `Bearer ${token}`)
      .send(broadcastData)
      .expect(201);

    // Create an expired broadcast directly in DB
    await EmergencyBroadcast.create({
      originInstanceId: 'http://localhost:3020',
      originInstanceName: 'TestChurch',
      severity: 'need',
      title: 'Expired Request',
      description: 'This has expired',
      needs: [{ type: 'food', description: 'Canned goods', fulfilled: 0, pledges: [] }],
      location: { city: 'Old Town', state: 'CA', country: 'US' },
      contactMethod: 'email',
      expiresAt: new Date(Date.now() - 1000), // already expired
      hopCount: 0,
      maxHops: 3,
      signature: 'expired-sig',
    });

    const res = await request(app)
      .get('/api/federation/emergency')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.broadcasts).toHaveLength(1);
    expect(res.body.broadcasts[0].title).toBe('Flood Relief Needed');
  });

  it('POST /api/federation/emergency/:id/pledge — should add a pledge to a need', async () => {
    const createRes = await request(app)
      .post('/api/federation/emergency')
      .set('Authorization', `Bearer ${token}`)
      .send(broadcastData)
      .expect(201);

    const broadcastId = createRes.body.broadcast.id;

    const res = await request(app)
      .post(`/api/federation/emergency/${broadcastId}/pledge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ needIndex: 0, quantity: 25, unit: 'cases' })
      .expect(200);

    expect(res.body.broadcast.needs[0].pledges).toHaveLength(1);
    expect(res.body.broadcast.needs[0].pledges[0].quantity).toBe(25);
    expect(res.body.broadcast.needs[0].pledges[0].status).toBe('pledged');
    expect(res.body.broadcast.needs[0].fulfilled).toBe(25);
  });

  it('POST /api/federation/emergency/:id/pledge — should reject invalid need index', async () => {
    const createRes = await request(app)
      .post('/api/federation/emergency')
      .set('Authorization', `Bearer ${token}`)
      .send(broadcastData)
      .expect(201);

    const broadcastId = createRes.body.broadcast.id;

    await request(app)
      .post(`/api/federation/emergency/${broadcastId}/pledge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ needIndex: 99, quantity: 10 })
      .expect(400);
  });
});

// ────────────────────────────────────────────────────────────
// Feature Gate Tests
// ────────────────────────────────────────────────────────────

describe('Feature Gate (connect disabled)', () => {
  let disabledApp: ReturnType<typeof createApp>;

  beforeEach(() => {
    disabledApp = createApp(makeConfig({
      features: { ...baseConfig.features, connect: false },
    }));
  });

  it('GET /api/federation/peers — should 404 when connect is disabled', async () => {
    await request(disabledApp)
      .get('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('POST /api/federation/peers — should 404 when connect is disabled', async () => {
    await request(disabledApp)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        instanceUrl: 'https://example.com',
        instanceName: 'Example',
        publicKey: 'abc',
      })
      .expect(404);
  });

  it('POST /api/federation/emergency — should 404 when connect is disabled', async () => {
    await request(disabledApp)
      .post('/api/federation/emergency')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404);
  });

  it('GET /api/federation/config — should 404 when connect is disabled', async () => {
    await request(disabledApp)
      .get('/api/federation/config')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('public peer endpoints bypass the feature gate (validation, not 404)', async () => {
    // /emergency/receive is a public peer endpoint placed before the feature
    // gate. With an empty body it must fail VALIDATION (400), proving it is
    // reachable — not blocked by the disabled-feature 404.
    const res = await request(disabledApp)
      .post('/api/federation/emergency/receive')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
// Auth Tests
// ────────────────────────────────────────────────────────────

describe('Authentication', () => {
  it('GET /api/federation/peers — should 401 without token', async () => {
    await request(app)
      .get('/api/federation/peers')
      .expect(401);
  });

  it('POST /api/federation/peers — should 401 without token', async () => {
    await request(app)
      .post('/api/federation/peers')
      .send({
        instanceUrl: 'https://example.com',
        instanceName: 'Example',
        publicKey: 'abc',
      })
      .expect(401);
  });

  it('POST /api/federation/emergency — should 401 without token', async () => {
    await request(app)
      .post('/api/federation/emergency')
      .send({})
      .expect(401);
  });

  it('GET /api/federation/config — should 401 without token', async () => {
    await request(app)
      .get('/api/federation/config')
      .expect(401);
  });
});

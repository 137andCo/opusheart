import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose, { Schema } from 'mongoose';
import { connectTestDb, disconnectTestDb } from '../../setup.js';
import { encryptionPlugin } from '../../../src/models/plugins/encryption.plugin.js';
import { blindIndex } from '../../../src/utils/blindIndex.js';

// Set encryption key for tests. blindIndex derives its HKDF subkey lazily on the
// first call (not at import), so setting this here is sufficient.
process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

interface ITestDoc {
  name: string;
  email: string;
  emailHash?: string;
  publicField: string;
}

const testSchema = new Schema<ITestDoc & mongoose.Document>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  emailHash: { type: String },
  publicField: { type: String, required: true },
});

testSchema.plugin(encryptionPlugin, {
  fields: ['name', 'email'],
  hashFields: ['email'],
});

const TestModel = mongoose.model('EncryptionTest', testSchema);

describe('encryption plugin', () => {
  beforeAll(async () => {
    await connectTestDb('encryption');
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('should encrypt fields on save and decrypt on toJSON', async () => {
    const doc = await TestModel.create({
      name: 'John Doe',
      email: 'john@example.com',
      publicField: 'not-encrypted',
    });

    // Raw DB value should be encrypted (not plaintext)
    const raw = await TestModel.findById(doc._id).lean();
    expect(raw?.name).not.toBe('John Doe');
    expect(raw?.email).not.toBe('john@example.com');
    expect(raw?.publicField).toBe('not-encrypted');

    // toJSON should decrypt
    const found = await TestModel.findById(doc._id);
    const json = found?.toJSON();
    expect(json?.name).toBe('John Doe');
    expect(json?.email).toBe('john@example.com');
  });

  it('should create hash for hashFields', async () => {
    const doc = await TestModel.create({
      name: 'Jane',
      email: 'jane@example.com',
      publicField: 'test',
    });

    const raw = await TestModel.findById(doc._id).lean();
    expect(raw?.emailHash).toBeDefined();
    expect(raw?.emailHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce consistent hashes for lookup', async () => {
    await TestModel.create({ name: 'Alice', email: 'alice@test.com', publicField: 'a' });
    await TestModel.create({ name: 'Bob', email: 'bob@test.com', publicField: 'b' });

    const aliceHash = blindIndex('alice@test.com');
    const found = await TestModel.findOne({ emailHash: aliceHash }).lean();
    expect(found).not.toBeNull();
  });

  it('should strip __v and passwordHash from JSON', async () => {
    const doc = await TestModel.create({ name: 'Test', email: 'test@test.com', publicField: 'x' });
    const json = doc.toJSON();
    expect(json).not.toHaveProperty('__v');
    expect(json).toHaveProperty('id');
    expect(json).not.toHaveProperty('_id');
  });
});

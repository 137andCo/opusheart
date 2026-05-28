/**
 * Shared test setup — connects to a real MongoDB instance instead of MongoMemoryServer.
 *
 * Each test suite gets its own database (based on a unique suffix) so suites can
 * run in parallel without stepping on each other.
 *
 * Requires: MongoDB running on localhost:21001 (no auth).
 * Override with TEST_MONGO_URL env var if needed.
 */
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

const TEST_MONGO_URL = process.env['TEST_MONGO_URL'] || 'mongodb://localhost:21001';

/**
 * Connect to a unique test database. Call in beforeAll.
 * Returns the database name for reference.
 */
export async function connectTestDb(suiteName?: string): Promise<string> {
  const suffix = suiteName || randomBytes(4).toString('hex');
  const dbName = `opusheart_test_${suffix}`;
  const uri = `${TEST_MONGO_URL}/${dbName}`;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri);
  return dbName;
}

/**
 * Drop all collections in the current database. Call in beforeEach.
 */
export async function cleanTestDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.listCollections().toArray();
  await Promise.all(
    collections.map(c => db.dropCollection(c.name).catch(() => {})),
  );
}

/**
 * Drop the test database and disconnect. Call in afterAll.
 */
export async function disconnectTestDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (db) {
    await db.dropDatabase();
  }
  await mongoose.disconnect();
}

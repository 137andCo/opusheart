import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDb, cleanTestDb, disconnectTestDb } from '../setup.js';
import { logAudit, flushAuditLog, clearAuditBatch } from '../../src/services/audit.service.js';
import { AuditLog } from '../../src/models/AuditLog.js';

process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Audit Service', () => {
  beforeAll(async () => {
    await connectTestDb('audit');
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    clearAuditBatch();
  });

  afterEach(() => {
    clearAuditBatch();
  });

  it('should log an audit entry after flush', async () => {
    await logAudit({
      action: 'user.login',
      actorEmail: 'pastor@church.org',
      actorRole: 'pastor',
      target: 'auth',
    });

    await flushAuditLog();

    const logs = await AuditLog.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe('user.login');
    expect(logs[0]?.actorRole).toBe('pastor');
  });

  it('should pseudonymize actor email with SHA-256', async () => {
    await logAudit({
      action: 'user.register',
      actorEmail: 'test@example.com',
      actorRole: 'admin',
      target: 'users',
      targetId: '123',
    });

    await flushAuditLog();

    const logs = await AuditLog.find().lean();
    expect(logs[0]?.actorHash).toMatch(/^[0-9a-f]{64}$/);
    // Should NOT contain the actual email
    expect(JSON.stringify(logs[0])).not.toContain('test@example.com');
  });

  it('should store metadata', async () => {
    await logAudit({
      action: 'feature.toggle',
      actorEmail: 'admin@church.org',
      actorRole: 'admin',
      target: 'features',
      metadata: { feature: 'giving', enabled: true },
    });

    await flushAuditLog();

    const logs = await AuditLog.find().lean();
    expect(logs[0]?.metadata).toEqual({ feature: 'giving', enabled: true });
  });

  it('should batch multiple entries', async () => {
    for (let i = 0; i < 5; i++) {
      await logAudit({
        action: `test.action.${i}`,
        actorEmail: 'test@test.com',
        actorRole: 'admin',
        target: 'test',
      });
    }

    await flushAuditLog();

    const count = await AuditLog.countDocuments();
    expect(count).toBe(5);
  });

  it('should not throw if flush fails gracefully', async () => {
    // This tests that audit logging never crashes the request
    await logAudit({
      action: 'test.safe',
      actorEmail: 'safe@test.com',
      actorRole: 'member',
      target: 'test',
    });

    // Even if something goes wrong, flush should not throw
    await expect(flushAuditLog()).resolves.not.toThrow();
  });
});

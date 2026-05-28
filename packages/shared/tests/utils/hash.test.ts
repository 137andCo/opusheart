import { describe, it, expect } from '@jest/globals';
import { sha256, timingSafeCompare } from '../../src/utils/hash.js';

describe('hash', () => {
  describe('sha256', () => {
    it('should produce consistent hash for same input', () => {
      const hash1 = sha256('test@example.com');
      const hash2 = sha256('test@example.com');
      expect(hash1).toBe(hash2);
    });

    it('should normalize to lowercase', () => {
      expect(sha256('Test@Example.COM')).toBe(sha256('test@example.com'));
    });

    it('should trim whitespace', () => {
      expect(sha256('  test@example.com  ')).toBe(sha256('test@example.com'));
    });

    it('should produce a 64-character hex string', () => {
      const hash = sha256('anything');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce different hashes for different inputs', () => {
      expect(sha256('alice@example.com')).not.toBe(sha256('bob@example.com'));
    });
  });

  describe('timingSafeCompare', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeCompare('abc123', 'abc123')).toBe(true);
    });

    it('should return false for different strings of same length', () => {
      expect(timingSafeCompare('abc123', 'xyz789')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(timingSafeCompare('short', 'longer string')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      expect(timingSafeCompare(null as unknown as string, 'test')).toBe(false);
      expect(timingSafeCompare('test', undefined as unknown as string)).toBe(false);
    });
  });
});

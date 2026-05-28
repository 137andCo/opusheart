import { describe, it, expect } from '@jest/globals';
import { encrypt, decrypt, generateEncryptionKey } from '../../src/utils/crypto.js';

describe('crypto', () => {
  const testKey = generateEncryptionKey();

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext, testKey);
      expect(encrypted).not.toBe(plaintext);
      expect(decrypt(encrypted, testKey)).toBe(plaintext);
    });

    it('should encrypt and decrypt unicode text', () => {
      const plaintext = 'Hola mundo! Привет мир! 你好世界!';
      const encrypted = encrypt(plaintext, testKey);
      expect(decrypt(encrypted, testKey)).toBe(plaintext);
    });

    it('should encrypt and decrypt empty string', () => {
      const encrypted = encrypt('', testKey);
      expect(decrypt(encrypted, testKey)).toBe('');
    });

    it('should encrypt and decrypt long text', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext, testKey);
      expect(decrypt(encrypted, testKey)).toBe(plaintext);
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const plaintext = 'same input';
      const enc1 = encrypt(plaintext, testKey);
      const enc2 = encrypt(plaintext, testKey);
      expect(enc1).not.toBe(enc2);
      expect(decrypt(enc1, testKey)).toBe(plaintext);
      expect(decrypt(enc2, testKey)).toBe(plaintext);
    });
  });

  describe('key validation', () => {
    it('should reject invalid key length on encrypt', () => {
      expect(() => encrypt('test', 'tooshort')).toThrow('32 bytes');
    });

    it('should reject invalid key length on decrypt', () => {
      const encrypted = encrypt('test', testKey);
      expect(() => decrypt(encrypted, 'tooshort')).toThrow('32 bytes');
    });
  });

  describe('tamper detection', () => {
    it('should fail to decrypt with wrong key', () => {
      const encrypted = encrypt('secret', testKey);
      const wrongKey = generateEncryptionKey();
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('should fail on truncated ciphertext', () => {
      expect(() => decrypt('dG9vc2hvcnQ=', testKey)).toThrow('too short');
    });

    it('should fail on tampered ciphertext', () => {
      const encrypted = encrypt('secret', testKey);
      const data = Buffer.from(encrypted, 'base64');
      const lastIdx = data.length - 1;
      data[lastIdx] = (data[lastIdx] ?? 0) ^ 0xff;
      const tampered = data.toString('base64');
      expect(() => decrypt(tampered, testKey)).toThrow();
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });
});

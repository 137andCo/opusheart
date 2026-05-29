import { createHmac, hkdfSync } from 'node:crypto';

/**
 * Keyed blind index for low-entropy PII (email, phone, ZIP, actor identity).
 *
 * A plain SHA-256 over an email/phone/ZIP is trivially brute-forceable from a
 * stolen DB dump — the keyspace is tiny (every phone number, every leaked
 * email). We therefore key the hash with a secret derived from ENCRYPTION_KEY,
 * so an attacker who only has the database (but not the key) cannot reverse or
 * confirm-guess the indexed value. Equality lookups still work because the same
 * input + key always yields the same digest.
 *
 * The HMAC key is HKDF-derived from the master ENCRYPTION_KEY with a distinct
 * `info` label, giving domain separation: the blind-index key is independent of
 * the AES field-encryption key even though both originate from one secret.
 */
const BLIND_INDEX_INFO = 'opusheart/blind-index/v1';

let cachedKey: Buffer | null = null;

function blindIndexKey(): Buffer {
  if (cachedKey) return cachedKey;
  const master = process.env['ENCRYPTION_KEY'];
  if (!master || !/^[0-9a-fA-F]{64}$/.test(master)) {
    throw new Error('ENCRYPTION_KEY (64 hex chars) must be set to compute blind indexes');
  }
  const masterBuf = Buffer.from(master, 'hex');
  cachedKey = Buffer.from(
    hkdfSync('sha256', masterBuf, Buffer.alloc(0), Buffer.from(BLIND_INDEX_INFO), 32),
  );
  return cachedKey;
}

/** Normalize then keyed-hash an indexed value. Stable for equality lookups. */
export function blindIndex(input: string): string {
  return createHmac('sha256', blindIndexKey())
    .update(input.toLowerCase().trim())
    .digest('hex');
}

/** Test helper: drop the memoized key (e.g. after rotating ENCRYPTION_KEY in a test). */
export function _resetBlindIndexKey(): void {
  cachedKey = null;
}

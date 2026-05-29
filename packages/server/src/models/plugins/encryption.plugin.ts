import { Schema } from 'mongoose';
import { encrypt, decrypt } from '@opusheart/shared';
import { blindIndex } from '../../utils/blindIndex.js';

interface EncryptionPluginOptions {
  fields: string[];        // fields to encrypt
  hashFields?: string[];   // fields to create keyed blind-index lookups for (e.g., email -> emailHash)
}

/**
 * Encrypt the string values of a key/value record (e.g. Member.customFields),
 * returning a plain object. Non-string values (numbers, booleans) are passed
 * through unchanged — only free text can carry the sensitive data we must
 * protect, and keeping scalar types intact avoids lossy round-trips.
 *
 * Pure and DB-independent so it can be unit-tested directly; the model hooks
 * that call it are thin wrappers.
 */
export function encryptRecordValues(
  record: Record<string, unknown> | Map<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!record) return out;
  const entries = record instanceof Map ? record.entries() : Object.entries(record);
  for (const [k, v] of entries) {
    out[k] = typeof v === 'string' ? encrypt(v, key) : v;
  }
  return out;
}

/**
 * Inverse of encryptRecordValues. Best-effort: a value that is not valid
 * ciphertext (e.g. legacy plaintext) is left as-is rather than dropped.
 */
export function decryptRecordValues(
  record: Record<string, unknown> | Map<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!record) return out;
  const entries = record instanceof Map ? record.entries() : Object.entries(record);
  for (const [k, v] of entries) {
    if (typeof v === 'string' && v.length > 0) {
      try {
        out[k] = decrypt(v, key);
      } catch {
        out[k] = v;
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function encryptionPlugin(schema: Schema, options: EncryptionPluginOptions): void {
  const { fields, hashFields = [] } = options;

  const getKey = (): string => {
    const key = process.env['ENCRYPTION_KEY'];
    if (!key) throw new Error('ENCRYPTION_KEY not set');
    return key;
  };

  // Encrypt on save
  schema.pre('save', function () {
    const key = getKey();
    for (const field of fields) {
      const value = this.get(field) as string | undefined;
      if (value && this.isModified(field)) {
        this.set(field, encrypt(value, key));
        // Create keyed blind index if this field has a hash counterpart
        if (hashFields.includes(field)) {
          this.set(`${field}Hash`, blindIndex(value));
        }
      }
    }
  });

  // Decrypt on toJSON and toObject
  const decryptFields = (doc: Record<string, unknown>): Record<string, unknown> => {
    const key = getKey();
    for (const field of fields) {
      const value = doc[field];
      if (typeof value === 'string' && value.length > 0) {
        try {
          doc[field] = decrypt(value, key);
        } catch (err) {
          // FAIL CLOSED: a decrypt failure means tampering, key mismatch, or
          // corruption. Returning the raw ciphertext here would silently leak it
          // to the caller as if it were plaintext, so we throw instead. The
          // GCM auth tag makes this a genuine integrity signal, not noise.
          console.error(`[SECURITY] Decryption failed for field "${field}":`, err instanceof Error ? err.message : err);
          throw new Error(`Decryption failed for field "${field}" — possible tampering or key mismatch`, { cause: err });
        }
      }
    }
    return doc;
  };

  schema.set('toJSON', {
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      decryptFields(ret);
      delete ret['__v'];
      ret['id'] = ret['_id'];
      delete ret['_id'];
      // Never expose sensitive auth fields in JSON
      delete ret['passwordHash'];
      delete ret['mfaSecret'];
      delete ret['emailHash'];
      delete ret['phoneHash'];
      return ret;
    },
  });

  schema.set('toObject', {
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      decryptFields(ret);
      ret['id'] = ret['_id'];
      delete ret['_id'];
      return ret;
    },
  });
}

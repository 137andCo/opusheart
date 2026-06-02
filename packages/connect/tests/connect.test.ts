import { describe, it, expect } from '@jest/globals';
import {
  generateSigningKeyPair,
  signMessage,
  verifyMessage,
  signBroadcast,
  verifyBroadcast,
  canonicalBroadcastPayload,
  isPrivateIp,
  isSafePeerUrl,
  MAX_BROADCAST_TTL_MS,
} from '@opusheart/connect';

const sampleBroadcast = {
  originInstanceId: 'https://a.org',
  originInstanceName: 'A',
  severity: 'urgent',
  title: 'Flood relief',
  description: 'Need supplies',
  needs: [{ type: 'water', description: 'bottled', quantity: 10, unit: 'case' }],
  location: { city: 'C', state: 'S', country: 'US' },
  contactMethod: 'mesh',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
  maxHops: 5,
};

describe('@opusheart/connect protocol', () => {
  it('Ed25519 sign/verify roundtrips and rejects tampering', () => {
    const { publicKey, secretKey } = generateSigningKeyPair();
    const sig = signMessage('hello mesh', secretKey);
    expect(verifyMessage('hello mesh', sig, publicKey)).toBe(true);
    expect(verifyMessage('hello MESH', sig, publicKey)).toBe(false);
  });

  it('canonical payload excludes hopCount + signature and normalizes expiresAt', () => {
    const c = canonicalBroadcastPayload(sampleBroadcast);
    expect(c).not.toContain('hopCount');
    expect(c).not.toContain('signature');
    expect(c).toContain('"expiresAt":"2030-01-01T00:00:00.000Z"');
    expect(canonicalBroadcastPayload({ ...sampleBroadcast })).toBe(c); // order-stable
  });

  it('signBroadcast/verifyBroadcast verify over the canonical form and detect edits', () => {
    const { publicKey, secretKey } = generateSigningKeyPair();
    const sig = signBroadcast(sampleBroadcast, secretKey);
    expect(verifyBroadcast(sampleBroadcast, sig, publicKey)).toBe(true);
    expect(verifyBroadcast({ ...sampleBroadcast, title: 'tampered' }, sig, publicKey)).toBe(false);
  });

  it('isPrivateIp flags private/loopback/metadata ranges, passes public', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('isSafePeerUrl rejects non-https, localhost, and private/encoded IPs', async () => {
    expect(await isSafePeerUrl('http://example.org')).toBe(false);
    expect(await isSafePeerUrl('https://localhost')).toBe(false);
    expect(await isSafePeerUrl('https://127.0.0.1')).toBe(false);
    expect(await isSafePeerUrl('https://2130706433')).toBe(false); // decimal 127.0.0.1
    expect(await isSafePeerUrl('https://8.8.8.8')).toBe(true);
  });

  it('MAX_BROADCAST_TTL_MS is 30 days', () => {
    expect(MAX_BROADCAST_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

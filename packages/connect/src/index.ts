import nacl from 'tweetnacl';

/**
 * @opusheart/connect — the federation ("Connect") mesh protocol client.
 *
 * The reusable, instance-agnostic primitives an OpusHeart instance needs to take
 * part in the mesh: Ed25519 signing identity, the canonical wire format for
 * emergency broadcasts (so any two instances sign/verify byte-identically), and
 * the SSRF guard every outbound peer request must pass. The server's stateful
 * crypto/federation services delegate to these.
 */

export const CONNECT_VERSION = '0.1.0';

// Re-export the protocol shapes so consumers can import them from one place.
export type {
  FederationPeer,
  EmergencyBroadcast,
  EmergencyNeed,
  EmergencyPledge,
  BroadcastLocation,
  EmergencySeverity,
  MeshPrayerRequest,
  ParticipationLevel,
  TrustLevel,
} from '@opusheart/shared';

// ── Ed25519 signing (the instance's mesh identity) ─────────────────────────────

export function generateSigningKeyPair(): { publicKey: string; secretKey: string } {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(kp.publicKey).toString('base64'),
    secretKey: Buffer.from(kp.secretKey).toString('base64'),
  };
}

export function signMessage(message: string, secretKeyB64: string): string {
  const sig = nacl.sign.detached(
    new TextEncoder().encode(message),
    new Uint8Array(Buffer.from(secretKeyB64, 'base64')),
  );
  return Buffer.from(sig).toString('base64');
}

export function verifyMessage(message: string, signatureB64: string, publicKeyB64: string): boolean {
  return nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    new Uint8Array(Buffer.from(signatureB64, 'base64')),
    new Uint8Array(Buffer.from(publicKeyB64, 'base64')),
  );
}

// ── Emergency-broadcast protocol ───────────────────────────────────────────────

// A peer broadcast may declare an expiry at most this far in the future. Without
// an upper bound, a replayed broadcast with expiresAt set years out would never
// trip the freshness check.
export const MAX_BROADCAST_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface BroadcastSigningFields {
  originInstanceId: string;
  originInstanceName: string;
  severity: string;
  title: string;
  description: string;
  needs: Array<{ type: string; description: string; quantity?: number; unit?: string }>;
  location: unknown;
  contactMethod: string;
  expiresAt: Date | string;
  maxHops: number;
}

/**
 * Canonical signing payload for an emergency broadcast. BOTH the signer and the
 * verifier must serialize identically, so we pin an explicit field set + order
 * and a normalized expiresAt. Critically this EXCLUDES hopCount (it increments at
 * every hop, so signing it would break verification downstream) and the signature
 * itself.
 */
export function canonicalBroadcastPayload(b: BroadcastSigningFields): string {
  return JSON.stringify({
    originInstanceId: b.originInstanceId,
    originInstanceName: b.originInstanceName,
    severity: b.severity,
    title: b.title,
    description: b.description,
    needs: b.needs.map((n) => ({ type: n.type, description: n.description, quantity: n.quantity, unit: n.unit })),
    location: b.location,
    contactMethod: b.contactMethod,
    expiresAt: new Date(b.expiresAt).toISOString(),
    maxHops: b.maxHops,
  });
}

export function signBroadcast(b: BroadcastSigningFields, secretKeyB64: string): string {
  return signMessage(canonicalBroadcastPayload(b), secretKeyB64);
}

export function verifyBroadcast(b: BroadcastSigningFields, signatureB64: string, publicKeyB64: string): boolean {
  return verifyMessage(canonicalBroadcastPayload(b), signatureB64, publicKeyB64);
}

// ── SSRF guard for outbound peer requests ──────────────────────────────────────

/** True if an IP literal (v4 or v6) is in a private/loopback/link-local/metadata range. */
export function isPrivateIp(ip: string): boolean {
  const addr = ip.toLowerCase();
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1) — unwrap to the v4 tail.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = mapped ? mapped[1]! : addr;
  const v4Patterns = [
    /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
  ];
  if (v4Patterns.some((re) => re.test(v4))) return true;
  // IPv6 loopback / unique-local (fc00::/7 -> fc,fd) / link-local (fe80::/10)
  if (addr === '::1' || addr === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(addr)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(addr)) return true;
  if (addr.includes('::ffff:') && v4Patterns.some((re) => re.test(v4))) return true;
  return false;
}

/**
 * SSRF guard for outbound federation requests. Peer URLs are user-supplied, so
 * before this instance ever fetch()es one we: require HTTPS; reject localhost /
 * .local / mapped-IPv6 / decimal / hex / octal IP literal forms outright; then
 * RESOLVE the hostname via DNS and reject if ANY resolved address is private.
 */
export async function isSafePeerUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;

  // URL.hostname wraps IPv6 literals in brackets (e.g. "[::1]") — strip them.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  // Reject non-DNS integer/hex/octal/mapped encodings of IPs before any lookup.
  if (host.includes('::ffff:')) return false;
  if (/^0x/i.test(host)) return false;          // hex IP (0x7f000001)
  if (/^\d+$/.test(host)) return false;          // decimal IP (2130706433)
  if (/^0\d/.test(host)) return false;           // octal-ish first octet (0177.x)

  // If it's already an IP literal, check it directly; otherwise resolve via DNS.
  if (isPrivateIp(host)) return false;

  try {
    const { lookup } = await import('node:dns/promises');
    const results = await lookup(host, { all: true });
    if (!results.length) return false;
    return !results.some((r) => isPrivateIp(r.address));
  } catch {
    return false; // unresolvable host — refuse
  }
}

import { FederationPeer, type IFederationPeerDocument } from '../models/FederationPeer.js';
import { EmergencyBroadcast, type IEmergencyBroadcastDocument } from '../models/EmergencyBroadcast.js';
import { InstanceSettings } from '../models/InstanceSettings.js';
import { cryptoService } from './crypto.service.js';
import { AppError } from '../utils/errors.js';
import type { FederationRequestInput, EmergencyBroadcastInput, PledgeInput } from '@opusheart/shared/schemas/connect.schema.js';

/**
 * Canonical signing payload for an emergency broadcast. BOTH the signer and the
 * verifier must serialize identically, so we pin an explicit field set + order
 * and a normalized expiresAt. Critically this EXCLUDES hopCount (it increments
 * at every hop, so signing it would break verification downstream) and the
 * signature itself. Previously sign/verify used different field sets and orders,
 * so every interop attempt failed verification.
 */
function canonicalBroadcastPayload(b: {
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
}): string {
  return JSON.stringify({
    originInstanceId: b.originInstanceId,
    originInstanceName: b.originInstanceName,
    severity: b.severity,
    title: b.title,
    description: b.description,
    needs: b.needs.map(n => ({ type: n.type, description: n.description, quantity: n.quantity, unit: n.unit })),
    location: b.location,
    contactMethod: b.contactMethod,
    expiresAt: new Date(b.expiresAt).toISOString(),
    maxHops: b.maxHops,
  });
}

// A peer broadcast may declare an expiry at most this far in the future. Without
// an upper bound, a replayed broadcast with expiresAt set years out would never
// trip the freshness check.
const MAX_BROADCAST_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class FederationService {
  /**
   * Load this instance's signing keypair from persistent storage into the
   * in-memory cryptoService, generating + persisting one on first use. Without
   * this, the keypair regenerated on every restart and invalidated this
   * instance's identity at all peers. Call once at startup and before signing.
   */
  async ensureKeyPair(identity?: { instanceName: string; instanceUrl: string }): Promise<string> {
    try {
      return cryptoService.getPublicKey();
    } catch {
      // not yet loaded into memory — fall through to load/generate
    }

    let settings = await InstanceSettings.findOne();
    const storedSecret = settings ? (settings as unknown as { getDecryptedPrivateKey(): string | null }).getDecryptedPrivateKey() : null;

    if (settings?.federationPublicKey && storedSecret) {
      cryptoService.loadKeyPair(settings.federationPublicKey, storedSecret);
      return settings.federationPublicKey;
    }

    // Generate, persist (private key encrypted by the model hook), and load.
    // If no settings doc exists yet, create one with this instance's identity
    // (instanceUrl is required by the schema).
    const keys = cryptoService.generateKeyPair();
    if (!settings) {
      settings = new InstanceSettings({
        instanceName: identity?.instanceName || process.env['INSTANCE_NAME'] || 'OpusHeart',
        instanceUrl: identity?.instanceUrl || process.env['INSTANCE_URL'] || 'http://localhost:3020',
      });
    }
    settings.federationPublicKey = keys.publicKey;
    settings.federationPrivateKey = keys.secretKey; // encrypted in pre-save
    await settings.save();
    return keys.publicKey;
  }

  async requestPeer(data: FederationRequestInput): Promise<IFederationPeerDocument> {
    const existing = await FederationPeer.findOne({ instanceUrl: data.instanceUrl });
    if (existing) {
      throw new AppError('Peer already exists', 409, 'PEER_EXISTS');
    }
    const peer = await FederationPeer.create({
      ...data,
      trustLevel: 'pending',
      connectedAt: new Date(),
      lastSeenAt: new Date(),
      active: true,
    });
    return peer;
  }

  async approvePeer(peerId: string): Promise<IFederationPeerDocument> {
    const peer = await this.findPeerById(peerId);
    peer.trustLevel = 'trusted';
    peer.lastSeenAt = new Date();
    await peer.save();
    return peer;
  }

  async blockPeer(peerId: string): Promise<IFederationPeerDocument> {
    const peer = await this.findPeerById(peerId);
    peer.trustLevel = 'blocked';
    peer.active = false;
    await peer.save();
    return peer;
  }

  async removePeer(peerId: string): Promise<void> {
    const peer = await this.findPeerById(peerId);
    await peer.deleteOne();
  }

  async listPeers(query: {
    trustLevel?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    peers: IFederationPeerDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};

    if (query.trustLevel) filter['trustLevel'] = query.trustLevel;

    const [peers, total] = await Promise.all([
      FederationPeer.find(filter).sort({ connectedAt: -1 }).skip((page - 1) * limit).limit(limit),
      FederationPeer.countDocuments(filter),
    ]);

    return { peers, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findPeerById(id: string): Promise<IFederationPeerDocument> {
    const peer = await FederationPeer.findById(id);
    if (!peer) throw new AppError('Peer not found', 404, 'PEER_NOT_FOUND');
    return peer;
  }

  async broadcastEmergency(
    data: EmergencyBroadcastInput,
    instanceId: string,
    instanceName: string,
  ): Promise<IEmergencyBroadcastDocument> {
    // Ensure we have a persistent key pair for signing
    await this.ensureKeyPair({ instanceName, instanceUrl: instanceId });

    const signature = cryptoService.sign(canonicalBroadcastPayload({
      ...data,
      originInstanceId: instanceId,
      originInstanceName: instanceName,
    }));

    const broadcast = await EmergencyBroadcast.create({
      originInstanceId: instanceId,
      originInstanceName: instanceName,
      severity: data.severity,
      title: data.title,
      description: data.description,
      needs: data.needs.map(n => ({ ...n, fulfilled: 0, pledges: [] })),
      location: data.location,
      contactMethod: data.contactMethod,
      expiresAt: data.expiresAt,
      hopCount: 0,
      maxHops: data.maxHops,
      signature,
    });

    // Outbound fan-out to peers is intentionally not implemented yet. When it is,
    // every peer.instanceUrl MUST be checked with isSafePeerUrl() before fetch()
    // to prevent SSRF (peer URLs are user-supplied):
    //   const peers = await FederationPeer.find({ trustLevel: 'trusted', active: true });
    //   for (const peer of peers) { if (isSafePeerUrl(peer.instanceUrl)) await post(...) }

    return broadcast;
  }

  async receiveEmergency(broadcastData: {
    originInstanceId: string;
    originInstanceName: string;
    severity: string;
    title: string;
    description: string;
    needs: Array<{ type: string; description: string; quantity?: number; unit?: string }>;
    location: { city: string; state: string; country: string; coordinates?: { lat: number; lng: number } };
    contactMethod: string;
    expiresAt: Date;
    hopCount: number;
    maxHops: number;
    signature: string;
  }): Promise<IEmergencyBroadcastDocument> {
    // Find the originating peer to verify signature (exact match, case-insensitive via lowercase)
    const normalizedOrigin = broadcastData.originInstanceId.toLowerCase().trim();
    const peers = await FederationPeer.find({ trustLevel: 'trusted', active: true });
    const peer = peers.find(p => p.instanceUrl.toLowerCase().trim() === normalizedOrigin);

    if (!peer) {
      throw new AppError('Unknown or untrusted peer', 403, 'UNTRUSTED_PEER');
    }

    const { signature } = broadcastData;
    if (!signature || typeof signature !== 'string') {
      throw new AppError('Missing broadcast signature', 400, 'MISSING_SIGNATURE');
    }
    // Verify against the SAME canonical payload the signer used (excludes hopCount).
    const valid = cryptoService.verify(canonicalBroadcastPayload(broadcastData), signature, peer.publicKey);
    if (!valid) {
      throw new AppError('Invalid broadcast signature', 403, 'INVALID_SIGNATURE');
    }

    if (broadcastData.hopCount >= broadcastData.maxHops) {
      throw new AppError('Broadcast exceeded max hops', 400, 'MAX_HOPS_EXCEEDED');
    }

    // Freshness: reject broadcasts that have already expired (stale replay)...
    const expiresAtMs = new Date(broadcastData.expiresAt).getTime();
    if (expiresAtMs <= Date.now()) {
      throw new AppError('Broadcast already expired', 400, 'BROADCAST_EXPIRED');
    }
    // ...and reject an implausibly far-future expiry, which would otherwise let a
    // replayed broadcast dodge the freshness check indefinitely.
    if (expiresAtMs - Date.now() > MAX_BROADCAST_TTL_MS) {
      throw new AppError('Broadcast expiry too far in the future', 400, 'BROADCAST_TTL_TOO_LONG');
    }

    try {
      const broadcast = await EmergencyBroadcast.create({
        ...broadcastData,
        needs: broadcastData.needs.map(n => ({ ...n, fulfilled: 0, pledges: [] })),
        hopCount: broadcastData.hopCount + 1,
      });
      return broadcast;
    } catch (err: unknown) {
      // Duplicate (origin, signature) — this broadcast was already received.
      // Idempotent: return the existing record instead of erroring on replay.
      if (err && typeof err === 'object' && (err as { code?: number }).code === 11000) {
        const existing = await EmergencyBroadcast.findOne({
          originInstanceId: broadcastData.originInstanceId,
          signature: broadcastData.signature,
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async pledgeToNeed(
    broadcastId: string,
    pledge: PledgeInput & { instanceId: string; instanceName: string },
  ): Promise<IEmergencyBroadcastDocument> {
    const broadcast = await EmergencyBroadcast.findById(broadcastId);
    if (!broadcast) throw new AppError('Broadcast not found', 404, 'BROADCAST_NOT_FOUND');

    if (pledge.needIndex >= broadcast.needs.length || pledge.needIndex < 0) {
      throw new AppError('Invalid need index', 400, 'INVALID_NEED_INDEX');
    }

    const need = broadcast.needs[pledge.needIndex]!;
    need.pledges.push({
      instanceId: pledge.instanceId,
      instanceName: pledge.instanceName,
      quantity: pledge.quantity,
      unit: pledge.unit,
      status: 'pledged',
      pledgedAt: new Date(),
    });
    need.fulfilled += pledge.quantity;

    await broadcast.save();
    return broadcast;
  }

  async listActiveEmergencies(query: {
    page?: number;
    limit?: number;
  }): Promise<{
    broadcasts: IEmergencyBroadcastDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter = { expiresAt: { $gt: new Date() } };

    const [broadcasts, total] = await Promise.all([
      EmergencyBroadcast.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      EmergencyBroadcast.countDocuments(filter),
    ]);

    return { broadcasts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getConfig(): Promise<{ publicKey: string | null; participationLevel: string }> {
    let publicKey: string | null = null;
    try {
      publicKey = cryptoService.getPublicKey();
    } catch {
      // No key pair loaded yet
    }
    return { publicKey, participationLevel: 'isolated' };
  }

  async updateConfig(_participationLevel: string): Promise<{ participationLevel: string; publicKey: string }> {
    // Use the persistent key pair (generated + stored on first use)
    const publicKey = await this.ensureKeyPair();
    return { participationLevel: _participationLevel, publicKey };
  }
}

export const federationService = new FederationService();

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
  if (v4Patterns.some(re => re.test(v4))) return true;
  // IPv6 loopback / unique-local (fc00::/7 -> fc,fd) / link-local (fe80::/10)
  if (addr === '::1' || addr === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(addr)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(addr)) return true;
  if (addr.includes('::ffff:') && v4Patterns.some(re => re.test(v4))) return true;
  return false;
}

/**
 * SSRF guard for outbound federation requests. Peer URLs are user-supplied, so
 * before this instance ever fetch()es one we: require HTTPS; reject localhost /
 * .local / mapped-IPv6 / decimal / hex / octal IP literal forms outright; then
 * RESOLVE the hostname via DNS and reject if ANY resolved address is private.
 * (DNS resolution closes the rebinding + alternate-encoding bypasses a literal
 * pattern match alone would miss.) Async because it does a real lookup; the
 * future outbound fan-out must await this before every peer fetch().
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
    return !results.some(r => isPrivateIp(r.address));
  } catch {
    return false; // unresolvable host — refuse
  }
}

import { FederationPeer, type IFederationPeerDocument } from '../models/FederationPeer.js';
import { EmergencyBroadcast, type IEmergencyBroadcastDocument } from '../models/EmergencyBroadcast.js';
import { InstanceSettings } from '../models/InstanceSettings.js';
import { cryptoService } from './crypto.service.js';
import { AppError } from '../utils/errors.js';
import type { FederationRequestInput, EmergencyBroadcastInput, PledgeInput } from '@opusheart/shared/schemas/connect.schema.js';

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

    const payload = JSON.stringify({
      ...data,
      originInstanceId: instanceId,
      originInstanceName: instanceName,
    });
    const signature = cryptoService.sign(payload);

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

    const { signature, ...payload } = broadcastData;
    if (!signature || typeof signature !== 'string') {
      throw new AppError('Missing broadcast signature', 400, 'MISSING_SIGNATURE');
    }
    const valid = cryptoService.verify(JSON.stringify(payload), signature, peer.publicKey);
    if (!valid) {
      throw new AppError('Invalid broadcast signature', 403, 'INVALID_SIGNATURE');
    }

    if (broadcastData.hopCount >= broadcastData.maxHops) {
      throw new AppError('Broadcast exceeded max hops', 400, 'MAX_HOPS_EXCEEDED');
    }

    // Freshness: reject broadcasts that have already expired (stale replay).
    if (new Date(broadcastData.expiresAt).getTime() <= Date.now()) {
      throw new AppError('Broadcast already expired', 400, 'BROADCAST_EXPIRED');
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

/**
 * SSRF guard for outbound federation requests. Peer URLs are user-supplied, so
 * before this instance ever fetch()es one, reject non-HTTPS schemes and any host
 * that resolves to a private/loopback/link-local range. Used by the (future)
 * outbound peer fan-out; exported now so it isn't forgotten when that lands.
 */
export function isSafePeerUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;

  // URL.hostname wraps IPv6 literals in brackets (e.g. "[::1]") — strip them so
  // the loopback/link-local patterns below match.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;

  // Block obvious private/loopback/link-local IP literals and the cloud metadata IP.
  const privatePatterns = [
    /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i,
    /^169\.254\.169\.254$/,
  ];
  return !privatePatterns.some(re => re.test(host));
}

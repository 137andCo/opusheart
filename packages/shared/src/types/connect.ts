export type TrustLevel = 'pending' | 'trusted' | 'blocked';

export type ParticipationLevel =
  | 'isolated'
  | 'prayer_only'
  | 'mutual_aid'
  | 'full_mesh'
  | 'custom';

export type EmergencySeverity = 'need' | 'urgent' | 'disaster';

export interface FederationPeer {
  id: string;
  instanceUrl: string;
  instanceName: string;
  publicKey: string;
  trustLevel: TrustLevel;
  participationLevel: ParticipationLevel;
  connectedAt: Date;
  lastSeenAt: Date;
  active: boolean;
}

export interface EmergencyBroadcast {
  id: string;
  originInstanceId: string;
  originInstanceName: string;
  severity: EmergencySeverity;
  title: string;
  description: string;
  needs: EmergencyNeed[];
  location: BroadcastLocation;
  contactMethod: string;
  createdAt: Date;
  expiresAt: Date;
  hopCount: number;
  maxHops: number;
  signature: string;
}

export interface BroadcastLocation {
  city: string;
  state: string;
  country: string;
  coordinates?: { lat: number; lng: number };
}

export interface EmergencyNeed {
  type: string;
  description: string;
  quantity?: number;
  unit?: string;
  fulfilled: number;
  pledges: EmergencyPledge[];
}

export interface EmergencyPledge {
  instanceId: string;
  instanceName: string;
  quantity: number;
  unit?: string;
  status: 'pledged' | 'in_transit' | 'delivered';
  pledgedAt: Date;
}

export interface MeshPrayerRequest {
  id: string;
  originInstanceId: string;
  originInstanceName: string;
  content: string;
  category: string;
  prayerCount: number;
  createdAt: Date;
  expiresAt?: Date;
  signature: string;
}

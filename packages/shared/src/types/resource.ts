export type ResourceCategory =
  | 'food'
  | 'housing'
  | 'utilities'
  | 'medical'
  | 'mental_health'
  | 'employment'
  | 'education'
  | 'legal'
  | 'transportation'
  | 'clothing'
  | 'financial'
  | 'childcare'
  | 'senior_services'
  | 'disability'
  | 'substance_abuse'
  | 'domestic_violence'
  | 'veterans'
  | 'other';

export interface CommunityResource {
  id: string;
  name: string;
  description: string;
  category: ResourceCategory;
  subcategory?: string;
  provider: string;
  eligibility: string;
  hours: string;
  phone?: string;
  email?: string;
  website?: string;
  address: ResourceAddress;
  location?: GeoPoint;
  languages: string[];
  lastVerified: Date;
  verifiedBy: string;
  submittedBy: string;
  approved: boolean;
  featured: boolean;
  tags: string[];
  aiSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

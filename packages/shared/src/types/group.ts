export type GroupType =
  | 'small_group'
  | 'bible_study'
  | 'committee'
  | 'ministry'
  | 'team'
  | 'class'
  | 'custom';

export type GroupVisibility = 'public' | 'members' | 'invite_only';

export interface Group {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  visibility: GroupVisibility;
  leaders: string[];
  members: string[];
  meetingSchedule?: string;
  location?: string;
  maxMembers?: number;
  materials: GroupMaterial[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMaterial {
  id: string;
  title: string;
  type: 'document' | 'link' | 'video' | 'file';
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

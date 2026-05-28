import mongoose, { Schema, Document } from 'mongoose';

export interface IGroupMaterial {
  title: string;
  type: 'document' | 'link' | 'video' | 'file';
  url: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
}

export interface IGroupMember {
  userId: mongoose.Types.ObjectId;
  role: 'leader' | 'member';
  joinedAt: Date;
}

export interface IGroup {
  name: string;
  description: string;
  type: 'small_group' | 'bible_study' | 'committee' | 'ministry' | 'team' | 'class' | 'custom';
  visibility: 'public' | 'members' | 'invite_only';
  members: IGroupMember[];
  meetingSchedule?: string;
  location?: string;
  maxMembers?: number;
  materials: IGroupMaterial[];
  active: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupDocument extends IGroup, Document {}

const groupMemberSchema = new Schema<IGroupMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    role: { type: String, required: true, enum: ['leader', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const groupMaterialSchema = new Schema<IGroupMaterial>({
  title: { type: String, required: true },
  type: { type: String, required: true, enum: ['document', 'link', 'video', 'file'] },
  url: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const groupSchema = new Schema<IGroupDocument>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['small_group', 'bible_study', 'committee', 'ministry', 'team', 'class', 'custom'],
      index: true,
    },
    visibility: {
      type: String,
      required: true,
      enum: ['public', 'members', 'invite_only'],
      default: 'members',
      index: true,
    },
    members: { type: [groupMemberSchema], default: [] },
    meetingSchedule: { type: String },
    location: { type: String },
    maxMembers: { type: Number },
    materials: { type: [groupMaterialSchema], default: [] },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ active: 1, type: 1, name: 1 });

groupSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const Group = mongoose.model<IGroupDocument>('Group', groupSchema);

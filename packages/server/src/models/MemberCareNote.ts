import mongoose, { Schema, Document, Types } from 'mongoose';
import { encryptionPlugin } from './plugins/encryption.plugin.js';

export interface IMemberCareNote {
  memberId: Types.ObjectId;
  authorId: Types.ObjectId;
  type: 'visit' | 'hospital' | 'bereavement' | 'meal_train' | 'follow_up' | 'general';
  content: string;
  followUpDate?: Date;
  resolved: boolean;
}

export interface IMemberCareNoteDocument extends IMemberCareNote, Document {}

const memberCareNoteSchema = new Schema<IMemberCareNoteDocument>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['visit', 'hospital', 'bereavement', 'meal_train', 'follow_up', 'general'],
      required: true,
    },
    content: { type: String, required: true },
    followUpDate: { type: Date },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

memberCareNoteSchema.plugin(encryptionPlugin, {
  fields: ['content'],
  hashFields: [],
});

export const MemberCareNote = mongoose.model<IMemberCareNoteDocument>('MemberCareNote', memberCareNoteSchema);
